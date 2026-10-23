import { createPublicClient, erc20Abi, getAddress, http, isAddress, zeroAddress, type Address, type PublicClient } from "viem"
import { bribeVotingRewardAbi, boostVoterAbi, votingEscrowAbi } from "./abis/index.js"
import { analyzeBoost, classifyPosition, summarizeMarket } from "./boost.js"
import { decideCacheReuse, type GaugeMappingCache } from "./cache.js"
import { CHAINS, resolveRpcUrl, type NetworkName } from "./config/chains.js"
import { getDeployment, type MezoDeployment } from "./config/addresses.js"
import { canVoteAt, getEpochInfo } from "./epoch.js"
import {
  createMulticallExecutor,
  viemAggregate3Transport,
  type CallExecutor,
  type CallResult,
  type ContractCall,
} from "./executor.js"
import type {
  BlockRef,
  BoostPosition,
  GaugeIncentives,
  GlobalState,
  IncentiveTokenAmount,
  LockInfo,
  MarketSnapshot,
  ReadFailure,
  VeMezoPosition,
  VeMezoVoteAllocation,
} from "./types.js"

export class ChainMismatchError extends Error {
  constructor(
    readonly network: NetworkName,
    readonly expected: number,
    readonly observed: number,
  ) {
    super(`RPC for ${network} reports chain id ${observed}, expected ${expected}. Refusing to read from the wrong chain.`)
    this.name = "ChainMismatchError"
  }
}

export class GlobalStateReadError extends Error {
  constructor(readonly failures: readonly ReadFailure[]) {
    super(`could not read global protocol state: ${failures.map((f) => `${f.key} (${f.message})`).join("; ")}`)
    this.name = "GlobalStateReadError"
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotFoundError"
  }
}

/** Block access needed by the reader (separate from contract calls so it can be faked in tests). */
export interface ChainAccess {
  getChainId(): Promise<number>
  getBlock(blockNumber?: bigint): Promise<BlockRef>
}

export function viemChainAccess(client: PublicClient): ChainAccess {
  return {
    getChainId: () => client.getChainId(),
    async getBlock(blockNumber) {
      const block = blockNumber === undefined ? await client.getBlock({ blockTag: "latest" }) : await client.getBlock({ blockNumber })
      if (block.number === null) throw new Error("RPC returned a pending block")
      return { number: block.number, timestamp: block.timestamp }
    },
  }
}

export interface MezoReaderOptions {
  readonly network: NetworkName
  /** Explicit RPC; otherwise MEZO_<NETWORK>_RPC_URL from `env`, otherwise the official default. */
  readonly rpcUrl?: string
  readonly env?: Record<string, string | undefined>
  /** Calls per aggregate3 for light views (mappings, weights, locks). Default 150. */
  readonly lightChunkSize?: number
  /** Calls per aggregate3 for heavy views (getBoost, totalVotingPower). Default 20. */
  readonly heavyChunkSize?: number
  /** Parallel aggregate3 requests. Default 3. */
  readonly concurrency?: number
  /** Per-request HTTP timeout. Default 60s. */
  readonly requestTimeoutMs?: number
  /** Test seams. When both are given, no network client is created. */
  readonly chain?: ChainAccess
  readonly executor?: CallExecutor
}

export interface MappingEntry {
  readonly tokenId: bigint
  readonly gauge: Address
}

export interface GaugeMappingScan {
  readonly entries: readonly MappingEntry[]
  readonly failures: readonly ReadFailure[]
  readonly scannedThroughTokenId: bigint
}

export interface PositionsRead {
  readonly positions: readonly BoostPosition[]
  /** Essential-read failures and anomalies; any of these makes a snapshot partial. */
  readonly failures: readonly ReadFailure[]
  /** Non-essential failures (owner, bribe, on-chain getBoost). */
  readonly warnings: readonly ReadFailure[]
}

export interface IncentivesRead {
  readonly byGauge: readonly GaugeIncentives[]
  readonly failures: readonly ReadFailure[]
}

export interface SnapshotOptions {
  /** Pin to this block; defaults to the latest block. */
  readonly blockNumber?: bigint
  /** A cache from a previous snapshot of the same deployment. */
  readonly cache?: GaugeMappingCache
  /** Force a full rescan when the cache is older than this. */
  readonly cacheMaxAgeMs?: number
  /** Read bribe tokens and amounts posted for the current epoch. Default true. */
  readonly includeIncentives?: boolean
  /** Also call BoostVoter.getBoost per position (heavy; used for verification). Default false. */
  readonly includeOnchainBoost?: boolean
}

export interface SnapshotResult {
  readonly snapshot: MarketSnapshot
  /** Cache to pass to the next snapshot, or null if the scan was incomplete. */
  readonly cache: GaugeMappingCache | null
}

export interface MezoReader {
  readonly network: NetworkName
  readonly deployment: MezoDeployment
  /** Resolved RPC URL, or null when a custom ChainAccess/executor was injected. */
  readonly rpcUrl: string | null
  /** eth_chainId must equal the deployment's chain id; throws ChainMismatchError otherwise. */
  assertChainId(): Promise<number>
  getBlock(blockNumber?: bigint): Promise<BlockRef>
  readGlobalState(block: BlockRef): Promise<GlobalState>
  scanGaugeMappings(block: BlockRef, throughTokenId: bigint): Promise<GaugeMappingScan>
  readPositions(
    block: BlockRef,
    global: GlobalState,
    entries: readonly MappingEntry[],
    options?: { readonly includeOnchainBoost?: boolean },
  ): Promise<PositionsRead>
  readIncentives(block: BlockRef, positions: readonly BoostPosition[], epochStart: bigint): Promise<IncentivesRead>
  readMarketSnapshot(options?: SnapshotOptions): Promise<SnapshotResult>
  readVeMezoTokenIds(owner: Address, blockNumber?: bigint): Promise<bigint[]>
  readVeMezoPosition(tokenId: bigint, blockNumber?: bigint): Promise<VeMezoPosition>
  /** This NFT's existing BoostVoter votes, with a completeness proof against usedWeights. */
  readVeMezoVoteAllocation(tokenId: bigint, blockNumber?: bigint): Promise<VeMezoVoteAllocation>
}

/**
 * gaugeVote has no length getter. vote() caps its length at maxVotingNum when it is written, but the
 * governor may lower maxVotingNum later, so the reader probes this many indexes past the current cap.
 */
export const ALLOCATION_PROBE_MARGIN = 16

// ---------- value guards (decoded values are `unknown` until checked) ----------

function asBigInt(value: unknown, key: string): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value)
  throw new TypeError(`${key}: expected integer, got ${typeof value}`)
}

function asBool(value: unknown, key: string): boolean {
  if (typeof value === "boolean") return value
  throw new TypeError(`${key}: expected bool, got ${typeof value}`)
}

function asAddress(value: unknown, key: string): Address {
  if (typeof value === "string" && isAddress(value, { strict: false })) return getAddress(value)
  throw new TypeError(`${key}: expected address, got ${String(value)}`)
}

function asLock(value: unknown, key: string): LockInfo {
  if (typeof value !== "object" || value === null) throw new TypeError(`${key}: expected LockedBalance tuple`)
  const v = value as Record<string, unknown>
  return {
    amount: asBigInt(v["amount"], `${key}.amount`),
    end: asBigInt(v["end"], `${key}.end`),
    isPermanent: asBool(v["isPermanent"], `${key}.isPermanent`),
    storedBoostRaw: asBigInt(v["boost"], `${key}.boost`),
  }
}

function toFailure(result: CallResult & { ok: false }): ReadFailure {
  return { key: result.key, kind: result.kind, message: result.error }
}

class Results {
  private readonly map = new Map<string, CallResult>()
  readonly failures: ReadFailure[] = []
  constructor(results: readonly CallResult[]) {
    for (const r of results) {
      this.map.set(r.key, r)
      if (!r.ok) this.failures.push(toFailure(r))
    }
  }
  /** Decoded value, or undefined if the call failed (the failure is already recorded). */
  get<T>(key: string, guard: (v: unknown, k: string) => T): T | undefined {
    const r = this.map.get(key)
    if (r === undefined) throw new Error(`no result for ${key}`)
    if (!r.ok) return undefined
    try {
      return guard(r.value, key)
    } catch (error) {
      if (!this.failed(key)) {
        this.failures.push({ key, kind: "decode", message: error instanceof Error ? error.message : String(error) })
      }
      return undefined
    }
  }
  failed(key: string): boolean {
    return this.failures.some((f) => f.key === key)
  }
}

export function createMezoReader(options: MezoReaderOptions): MezoReader {
  const network = options.network
  const deployment = getDeployment(network)
  const { contracts } = deployment
  const lightChunkSize = options.lightChunkSize ?? 150
  const heavyChunkSize = options.heavyChunkSize ?? 20

  let rpcUrl: string | null = null
  let chain = options.chain
  let executor = options.executor
  if (chain === undefined || executor === undefined) {
    rpcUrl = resolveRpcUrl(network, {
      ...(options.rpcUrl !== undefined ? { override: options.rpcUrl } : {}),
      ...(options.env !== undefined ? { env: options.env } : {}),
    })
    const client = createPublicClient({
      chain: CHAINS[network],
      transport: http(rpcUrl, { timeout: options.requestTimeoutMs ?? 60_000, retryCount: 2 }),
    })
    chain ??= viemChainAccess(client as PublicClient)
    executor ??= createMulticallExecutor(viemAggregate3Transport(client as PublicClient, contracts.multicall3), {
      concurrency: options.concurrency ?? 3,
    })
  }
  const chainAccess: ChainAccess = chain
  const exec: CallExecutor = executor

  let chainCheck: Promise<number> | undefined
  function assertChainId(): Promise<number> {
    chainCheck ??= chainAccess.getChainId().then((observed) => {
      if (observed !== deployment.chainId) throw new ChainMismatchError(network, deployment.chainId, observed)
      return observed
    })
    chainCheck.catch(() => {
      chainCheck = undefined
    })
    return chainCheck
  }

  async function run(calls: readonly ContractCall[], block: BlockRef, chunkSize: number): Promise<Results> {
    await assertChainId()
    if (calls.length === 0) return new Results([])
    return new Results(await exec.execute(calls, { blockNumber: block.number, chunkSize }))
  }

  const call = (key: string, address: Address, abi: ContractCall["abi"], functionName: string, args?: readonly unknown[]): ContractCall => ({
    key,
    address,
    abi,
    functionName,
    ...(args !== undefined ? { args } : {}),
  })

  async function readGlobalState(block: BlockRef): Promise<GlobalState> {
    const r = await run(
      [
        call("global:veMezo.totalVotingPower", contracts.veMezo, votingEscrowAbi, "totalVotingPower"),
        call("global:veBtc.unboostedTotalVotingPower", contracts.veBtc, votingEscrowAbi, "unboostedTotalVotingPower"),
        call("global:boostVoter.totalWeight", contracts.boostVoter, boostVoterAbi, "totalWeight"),
        call("global:boostVoter.maxVotingNum", contracts.boostVoter, boostVoterAbi, "maxVotingNum"),
        call("global:boostVoter.length", contracts.boostVoter, boostVoterAbi, "length"),
        call("global:veBtc.tokenId", contracts.veBtc, votingEscrowAbi, "tokenId"),
        call("global:veMezo.tokenId", contracts.veMezo, votingEscrowAbi, "tokenId"),
      ],
      block,
      heavyChunkSize,
    )
    const values = {
      totalVeMezoVotingPower: r.get("global:veMezo.totalVotingPower", asBigInt),
      totalUnboostedVeBtcVotingPower: r.get("global:veBtc.unboostedTotalVotingPower", asBigInt),
      boostVoterTotalWeight: r.get("global:boostVoter.totalWeight", asBigInt),
      maxVotingNum: r.get("global:boostVoter.maxVotingNum", asBigInt),
      gaugeCount: r.get("global:boostVoter.length", asBigInt),
      veBtcMaxTokenId: r.get("global:veBtc.tokenId", asBigInt),
      veMezoMaxTokenId: r.get("global:veMezo.tokenId", asBigInt),
    }
    if (r.failures.length > 0) throw new GlobalStateReadError(r.failures)
    return {
      totalVeMezoVotingPower: values.totalVeMezoVotingPower as bigint,
      totalUnboostedVeBtcVotingPower: values.totalUnboostedVeBtcVotingPower as bigint,
      boostVoterTotalWeight: values.boostVoterTotalWeight as bigint,
      maxVotingNum: values.maxVotingNum as bigint,
      gaugeCount: values.gaugeCount as bigint,
      veBtcMaxTokenId: values.veBtcMaxTokenId as bigint,
      veMezoMaxTokenId: values.veMezoMaxTokenId as bigint,
      epoch: getEpochInfo(block.timestamp),
    }
  }

  async function scanGaugeMappings(block: BlockRef, throughTokenId: bigint): Promise<GaugeMappingScan> {
    if (throughTokenId < 0n) throw new RangeError("throughTokenId must be non-negative")
    const calls: ContractCall[] = []
    // veBTC ids are minted as ++tokenId (ve/Escrow.sol:547, :887; ve/ManagedNFT.sol:39), so 1..n is the full id space.
    for (let id = 1n; id <= throughTokenId; id++) {
      calls.push(call(`mapping:${id}`, contracts.boostVoter, boostVoterAbi, "boostableTokenIdToGauge", [id]))
    }
    const r = await run(calls, block, lightChunkSize)
    const entries: MappingEntry[] = []
    for (let id = 1n; id <= throughTokenId; id++) {
      const gauge = r.get(`mapping:${id}`, asAddress)
      if (gauge !== undefined && gauge !== zeroAddress) entries.push({ tokenId: id, gauge })
    }
    return { entries, failures: r.failures, scannedThroughTokenId: throughTokenId }
  }

  async function readPositions(
    block: BlockRef,
    global: GlobalState,
    entries: readonly MappingEntry[],
    opts: { readonly includeOnchainBoost?: boolean } = {},
  ): Promise<PositionsRead> {
    const anomalies: ReadFailure[] = []
    // De-duplicate by tokenId; the contract allows one gauge per veBTC, so conflicting duplicates are anomalies.
    const byId = new Map<bigint, Address>()
    for (const e of entries) {
      const existing = byId.get(e.tokenId)
      if (existing !== undefined && existing !== e.gauge) {
        anomalies.push({ key: `position:${e.tokenId}`, kind: "anomaly", message: `token mapped to two gauges ${existing} and ${e.gauge}` })
        continue
      }
      byId.set(e.tokenId, e.gauge)
    }
    const unique = [...byId.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))

    const calls: ContractCall[] = []
    for (const [id, gauge] of unique) {
      const k = `position:${id}`
      calls.push(
        call(`${k}:mapping`, contracts.boostVoter, boostVoterAbi, "boostableTokenIdToGauge", [id]),
        call(`${k}:alive`, contracts.boostVoter, boostVoterAbi, "isAlive", [gauge]),
        call(`${k}:weight`, contracts.boostVoter, boostVoterAbi, "weights", [gauge]),
        call(`${k}:bribe`, contracts.boostVoter, boostVoterAbi, "gaugeToBribe", [gauge]),
        call(`${k}:power`, contracts.veBtc, votingEscrowAbi, "unboostedVotingPowerOfNFT", [id]),
        call(`${k}:locked`, contracts.veBtc, votingEscrowAbi, "locked", [id]),
        call(`${k}:owner`, contracts.veBtc, votingEscrowAbi, "ownerOf", [id]),
      )
    }
    const r = await run(calls, block, lightChunkSize)
    let heavy: Results | undefined
    if (opts.includeOnchainBoost === true && unique.length > 0) {
      heavy = await run(
        unique.map(([id]) => call(`position:${id}:getBoost`, contracts.boostVoter, boostVoterAbi, "getBoost", [id])),
        block,
        heavyChunkSize,
      )
    }

    const essentialFailures: ReadFailure[] = [...anomalies]
    const warnings: ReadFailure[] = []
    const positions: BoostPosition[] = []
    const gaugeOwners = new Map<Address, bigint>()
    for (const [id, gauge] of unique) {
      const k = `position:${id}`
      const mapped = r.get(`${k}:mapping`, asAddress)
      const alive = r.get(`${k}:alive`, asBool)
      const weight = r.get(`${k}:weight`, asBigInt)
      const power = r.get(`${k}:power`, asBigInt)
      const lock = r.get(`${k}:locked`, asLock)
      const bribe = r.get(`${k}:bribe`, asAddress)
      const owner = r.get(`${k}:owner`, asAddress)
      for (const f of r.failures.filter((f) => f.key.startsWith(`${k}:`))) {
        const isEssential = /:(mapping|alive|weight|power|locked)$/.test(f.key)
        ;(isEssential ? essentialFailures : warnings).push(f)
      }
      if (mapped === undefined || alive === undefined || weight === undefined || power === undefined || lock === undefined) continue
      if (mapped === zeroAddress) continue // veBTC burned since the mapping was recorded; gauge was killed and unmapped.
      if (mapped !== gauge) {
        essentialFailures.push({ key: `${k}:mapping`, kind: "anomaly", message: `gauge changed from ${gauge} to ${mapped}` })
        continue
      }
      const otherId = gaugeOwners.get(gauge)
      if (otherId !== undefined) {
        essentialFailures.push({ key: k, kind: "anomaly", message: `gauge ${gauge} also mapped from veBTC ${otherId}` })
        continue
      }
      gaugeOwners.set(gauge, id)
      let onchainBoost: bigint | null = null
      if (heavy !== undefined) {
        onchainBoost = heavy.get(`${k}:getBoost`, asBigInt) ?? null
        warnings.push(...heavy.failures.filter((f) => f.key === `${k}:getBoost`))
      }
      const analysis = analyzeBoost(
        {
          gaugeWeight: weight,
          totalVeMezoVotingPower: global.totalVeMezoVotingPower,
          totalUnboostedVeBtcVotingPower: global.totalUnboostedVeBtcVotingPower,
          positionUnboostedVotingPower: power,
        },
        lock.storedBoostRaw,
      )
      positions.push({
        tokenId: id,
        gauge,
        bribe: bribe === undefined || bribe === zeroAddress ? null : bribe,
        owner: owner === undefined ? null : owner,
        gaugeAlive: alive,
        lock,
        unboostedVotingPower: power,
        gaugeWeight: weight,
        status: classifyPosition({
          gaugeAlive: alive,
          lockAmount: lock.amount,
          lockEnd: lock.end,
          isPermanent: lock.isPermanent,
          unboostedVotingPower: power,
          timestamp: block.timestamp,
        }),
        analysis,
        onchainBoost,
      })
    }
    return { positions, failures: essentialFailures, warnings }
  }

  async function readIncentives(block: BlockRef, positions: readonly BoostPosition[], epochStart: bigint): Promise<IncentivesRead> {
    const targets = positions.filter((p) => p.gaugeAlive && p.bribe !== null) as (BoostPosition & { bribe: Address })[]
    const lengths = await run(
      targets.map((p) => call(`incentive:${p.gauge}:length`, p.bribe, bribeVotingRewardAbi, "rewardsListLength")),
      block,
      lightChunkSize,
    )
    const tokenCalls: ContractCall[] = []
    for (const p of targets) {
      const n = lengths.get(`incentive:${p.gauge}:length`, asBigInt)
      if (n === undefined) continue
      for (let i = 0n; i < n; i++) tokenCalls.push(call(`incentive:${p.gauge}:token:${i}`, p.bribe, bribeVotingRewardAbi, "rewards", [i]))
    }
    const tokensRead = await run(tokenCalls, block, lightChunkSize)

    const perGauge = new Map<Address, { bribe: Address; tokens: Address[] }>()
    const amountCalls: ContractCall[] = []
    const distinctTokens = new Set<Address>()
    for (const p of targets) {
      const n = lengths.get(`incentive:${p.gauge}:length`, asBigInt)
      if (n === undefined) continue
      const tokens: Address[] = []
      for (let i = 0n; i < n; i++) {
        const token = tokensRead.get(`incentive:${p.gauge}:token:${i}`, asAddress)
        if (token === undefined) continue
        tokens.push(token)
        distinctTokens.add(token)
        amountCalls.push(call(`incentive:${p.gauge}:amount:${token}`, p.bribe, bribeVotingRewardAbi, "tokenRewardsPerEpoch", [token, epochStart]))
      }
      perGauge.set(p.gauge, { bribe: p.bribe, tokens })
    }
    const metaCalls: ContractCall[] = []
    for (const token of distinctTokens) {
      metaCalls.push(call(`token:${token}:symbol`, token, erc20Abi, "symbol"), call(`token:${token}:decimals`, token, erc20Abi, "decimals"))
    }
    const [amounts, meta] = await Promise.all([run(amountCalls, block, lightChunkSize), run(metaCalls, block, lightChunkSize)])

    const byGauge: GaugeIncentives[] = []
    for (const [gauge, { bribe, tokens }] of perGauge) {
      const entries: IncentiveTokenAmount[] = []
      for (const token of tokens) {
        const posted = amounts.get(`incentive:${gauge}:amount:${token}`, asBigInt)
        if (posted === undefined) continue
        const symbol = meta.get(`token:${token}:symbol`, (v, k) => {
          if (typeof v !== "string") throw new TypeError(`${k}: expected string`)
          return v
        })
        const decimals = meta.get(`token:${token}:decimals`, (v, k) => Number(asBigInt(v, k)))
        entries.push({ token, symbol: symbol ?? null, decimals: decimals ?? null, postedForEpoch: posted })
      }
      byGauge.push({ gauge, bribe, epochStart, tokens: entries })
    }
    // Collected last so decode failures raised by get() above are included.
    const failures = [...lengths.failures, ...tokensRead.failures, ...amounts.failures, ...meta.failures]
    return { byGauge, failures }
  }

  async function readMarketSnapshot(opts: SnapshotOptions = {}): Promise<SnapshotResult> {
    await assertChainId()
    const block = await chainAccess.getBlock(opts.blockNumber)
    const global = await readGlobalState(block)

    const decision = decideCacheReuse(
      opts.cache,
      { network, boostVoter: contracts.boostVoter, gaugeCount: global.gaugeCount },
      opts.cacheMaxAgeMs !== undefined ? { maxAgeMs: opts.cacheMaxAgeMs } : {},
    )
    let entries: readonly MappingEntry[]
    let mappingFailures: readonly ReadFailure[] = []
    let scannedThrough: bigint
    if (decision.reuse && opts.cache !== undefined) {
      entries = opts.cache.entries
      scannedThrough = global.veBtcMaxTokenId
    } else {
      const scan = await scanGaugeMappings(block, global.veBtcMaxTokenId)
      entries = scan.entries
      mappingFailures = scan.failures
      scannedThrough = scan.scannedThroughTokenId
    }

    const read = await readPositions(block, global, entries, { includeOnchainBoost: opts.includeOnchainBoost === true })
    const essential = [...mappingFailures, ...read.failures]
    const summary = summarizeMarket(read.positions)

    let incentives: MarketSnapshot["incentives"] = { included: false, completeness: "complete", byGauge: [], failures: [] }
    if (opts.includeIncentives !== false) {
      const inc = await readIncentives(block, read.positions, global.epoch.epochStart)
      incentives = {
        included: true,
        completeness: inc.failures.length === 0 ? "complete" : "partial",
        byGauge: inc.byGauge,
        failures: inc.failures,
      }
    }

    const fetchedAtMs = Date.now()
    const snapshot: MarketSnapshot = {
      meta: {
        network,
        chainId: deployment.chainId,
        blockNumber: block.number,
        blockTimestamp: block.timestamp,
        fetchedAt: new Date(fetchedAtMs).toISOString(),
        ageSeconds: Math.max(0, Math.round(fetchedAtMs / 1000 - Number(block.timestamp))),
        completeness: essential.length === 0 ? "complete" : "partial",
        mappingSource: decision.reuse ? "cache" : "scan",
        failures: [...essential, ...read.warnings],
      },
      global,
      positions: read.positions,
      summary,
      incentives,
    }
    const cache: GaugeMappingCache | null =
      essential.length === 0
        ? {
            network,
            boostVoter: contracts.boostVoter,
            gaugeCount: global.gaugeCount,
            scannedThroughTokenId: scannedThrough,
            scannedAtBlock: decision.reuse && opts.cache !== undefined ? opts.cache.scannedAtBlock : block.number,
            scannedAt: decision.reuse && opts.cache !== undefined ? opts.cache.scannedAt : fetchedAtMs,
            entries: read.positions.map((p) => ({ tokenId: p.tokenId, gauge: p.gauge })),
          }
        : null
    return { snapshot, cache }
  }

  async function readVeMezoTokenIds(owner: Address, blockNumber?: bigint): Promise<bigint[]> {
    const block = await chainAccess.getBlock(blockNumber)
    const who = getAddress(owner)
    const countRead = await run([call("veMezo:balanceOf", contracts.veMezo, votingEscrowAbi, "balanceOf", [who])], block, lightChunkSize)
    const count = countRead.get("veMezo:balanceOf", asBigInt)
    if (count === undefined) throw new GlobalStateReadError(countRead.failures)
    const calls: ContractCall[] = []
    for (let i = 0n; i < count; i++) calls.push(call(`veMezo:list:${i}`, contracts.veMezo, votingEscrowAbi, "ownerToNFTokenIdList", [who, i]))
    const r = await run(calls, block, lightChunkSize)
    if (r.failures.length > 0) throw new GlobalStateReadError(r.failures)
    return calls.map((c) => r.get(c.key, asBigInt) as bigint)
  }

  async function readVeMezoPosition(tokenId: bigint, blockNumber?: bigint): Promise<VeMezoPosition> {
    const block = await chainAccess.getBlock(blockNumber)
    const k = `veMezo:${tokenId}`
    const r = await run(
      [
        call(`${k}:owner`, contracts.veMezo, votingEscrowAbi, "ownerOf", [tokenId]),
        call(`${k}:locked`, contracts.veMezo, votingEscrowAbi, "locked", [tokenId]),
        call(`${k}:power`, contracts.veMezo, votingEscrowAbi, "votingPowerOfNFT", [tokenId]),
        call(`${k}:voted`, contracts.veMezo, votingEscrowAbi, "voted", [tokenId]),
        call(`${k}:lastVoted`, contracts.boostVoter, boostVoterAbi, "lastVoted", [tokenId]),
        call(`${k}:usedWeight`, contracts.boostVoter, boostVoterAbi, "usedWeights", [tokenId]),
      ],
      block,
      lightChunkSize,
    )
    const owner = r.get(`${k}:owner`, asAddress)
    const lock = r.get(`${k}:locked`, asLock)
    const votingPower = r.get(`${k}:power`, asBigInt)
    const voted = r.get(`${k}:voted`, asBool)
    const lastVoted = r.get(`${k}:lastVoted`, asBigInt)
    const usedWeight = r.get(`${k}:usedWeight`, asBigInt)
    if (r.failures.length > 0) throw new GlobalStateReadError(r.failures)
    if (owner === zeroAddress) throw new NotFoundError(`veMEZO #${tokenId} does not exist on ${network}`)
    return {
      tokenId,
      owner: owner as Address,
      lock: lock as LockInfo,
      votingPower: votingPower as bigint,
      votedAnywhere: voted as boolean,
      lastVoted: lastVoted as bigint,
      usedWeight: usedWeight as bigint,
      canVoteThisEpoch: canVoteAt(block.timestamp, lastVoted as bigint),
      blockNumber: block.number,
    }
  }

  async function readVeMezoVoteAllocation(tokenId: bigint, blockNumber?: bigint): Promise<VeMezoVoteAllocation> {
    const block = await chainAccess.getBlock(blockNumber)
    const k = `veMezoVotes:${tokenId}`
    const head = await run(
      [
        call(`${k}:used`, contracts.boostVoter, boostVoterAbi, "usedWeights", [tokenId]),
        call(`${k}:max`, contracts.boostVoter, boostVoterAbi, "maxVotingNum"),
      ],
      block,
      lightChunkSize,
    )
    const usedWeight = head.get(`${k}:used`, asBigInt)
    const maxVotingNum = head.get(`${k}:max`, asBigInt)
    if (usedWeight === undefined || maxVotingNum === undefined) throw new GlobalStateReadError(head.failures)

    const probe = Number(maxVotingNum) + ALLOCATION_PROBE_MARGIN
    const indexCalls: ContractCall[] = []
    for (let i = 0; i < probe; i++) indexCalls.push(call(`${k}:gauge:${i}`, contracts.boostVoter, boostVoterAbi, "gaugeVote", [tokenId, BigInt(i)]))
    const indexes = await run(indexCalls, block, lightChunkSize)
    const issues: string[] = []
    const gauges: Address[] = []
    let ended = false
    for (let i = 0; i < probe; i++) {
      const key = `${k}:gauge:${i}`
      const failure = indexes.failures.find((f) => f.key === key)
      if (failure === undefined) {
        const gauge = indexes.get(key, asAddress)
        if (gauge === undefined) issues.push(`gaugeVote[${i}] could not be decoded`)
        else if (ended) issues.push(`gaugeVote[${i}] returned a value after the array ended`)
        else gauges.push(gauge)
      } else if (failure.kind === "reverted") {
        ended = true // out-of-bounds read of a public array reverts: this is the array's end
      } else {
        issues.push(`gaugeVote[${i}] read failed (${failure.kind}: ${failure.message})`)
      }
    }
    if (!ended) issues.push(`gaugeVote has more than ${probe} entries; allocation not fully read`)

    const voteRead = await run(
      gauges.map((g) => call(`${k}:votes:${g}`, contracts.boostVoter, boostVoterAbi, "votes", [tokenId, g])),
      block,
      lightChunkSize,
    )
    const entries: { gauge: Address; votes: bigint }[] = []
    for (const g of gauges) {
      const v = voteRead.get(`${k}:votes:${g}`, asBigInt)
      if (v === undefined) issues.push(`votes(${tokenId}, ${g}) read failed`)
      else entries.push({ gauge: g, votes: v })
    }
    const sum = entries.reduce((s, e) => s + e.votes, 0n)
    if (issues.length === 0 && sum !== usedWeight) issues.push(`sum of votes (${sum}) does not equal usedWeights (${usedWeight})`)
    return { tokenId, blockNumber: block.number, usedWeight, entries, complete: issues.length === 0, issues }
  }

  return {
    network,
    deployment,
    rpcUrl,
    assertChainId,
    readVeMezoVoteAllocation,
    getBlock: (blockNumber) => chainAccess.getBlock(blockNumber),
    readGlobalState,
    scanGaugeMappings,
    readPositions,
    readIncentives,
    readMarketSnapshot,
    readVeMezoTokenIds,
    readVeMezoPosition,
  }
}

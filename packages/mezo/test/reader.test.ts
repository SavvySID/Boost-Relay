import { encodeErrorResult, encodeFunctionResult, getAddress, zeroAddress, type Address, type Hex } from "viem"
import { beforeEach, describe, expect, it } from "vitest"
import {
  ChainMismatchError,
  DEPLOYMENTS,
  GlobalStateReadError,
  NotFoundError,
  PRECISION,
  boostVoterAbi,
  computeBoost,
  createMezoReader,
  createMulticallExecutor,
  decideCacheReuse,
  deserializeGaugeMappingCache,
  serializeGaugeMappingCache,
  type Aggregate3Call,
  type Aggregate3Transport,
  type CallExecutor,
  type CallResult,
  type ContractCall,
  type MezoReader,
} from "../src/index.js"

const P = PRECISION
const tokens = (n: bigint): bigint => n * P
const C = DEPLOYMENTS.testnet.contracts
const MEZO = DEPLOYMENTS.testnet.tokens.mezo
const T = 1_792_705_788n // inside the voting window of the epoch starting 1_792_627_200
const EPOCH_START = 1_792_627_200n
const BLOCK = 500n
const fakeAddress = (n: number): Address => getAddress(`0x${n.toString(16).padStart(40, "0")}`)
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

interface Lock {
  amount: bigint
  end: bigint
  isPermanent: boolean
  boost: bigint
}

/** In-memory model of the contracts the reader touches; answers decoded values like viem would. */
class FakeMezo {
  Tm = tokens(1000n)
  Tb = tokens(100n)
  totalWeight = 0n
  veBtcMax = 6n
  mapping = new Map<bigint, Address>()
  gauges = new Map<Address, { alive: boolean; weight: bigint; bribe: Address }>()
  veBtc = new Map<bigint, { power: bigint; lock: Lock; owner: Address }>()
  bribes = new Map<Address, { tokens: Address[]; posted: Map<Address, bigint> }>()
  veMezo = new Map<bigint, { owner: Address; lock: Lock; power: bigint; voted: boolean; lastVoted: bigint; used: bigint }>()
  failures = new Map<string, Omit<CallResult & { ok: false }, "key">>()
  log: { key: string; blockNumber: bigint; chunkSize: number }[] = []

  addPosition(id: bigint, gaugeNo: number, o: { alive?: boolean; weight: bigint; power: bigint; end?: bigint; boost?: bigint }): Address {
    const gauge = fakeAddress(0x1000 + gaugeNo)
    const bribe = fakeAddress(0x2000 + gaugeNo)
    this.mapping.set(id, gauge)
    this.gauges.set(gauge, { alive: o.alive ?? true, weight: o.weight, bribe })
    this.bribes.set(bribe, { tokens: [], posted: new Map() })
    this.veBtc.set(id, {
      power: o.power,
      lock: { amount: tokens(1n), end: o.end ?? T + 10_000n, isPermanent: false, boost: o.boost ?? 0n },
      owner: fakeAddress(0x3000 + Number(id)),
    })
    return gauge
  }

  resolve(c: ContractCall): unknown {
    const a = c.args ?? []
    const id = a[0] as bigint
    if (same(c.address, C.veMezo)) {
      switch (c.functionName) {
        case "totalVotingPower":
          return this.Tm
        case "tokenId":
          return 3n
        case "ownerOf":
          return this.veMezo.get(id)?.owner ?? zeroAddress
        case "locked":
          return this.veMezo.get(id)?.lock ?? { amount: 0n, end: 0n, isPermanent: false, boost: 0n }
        case "votingPowerOfNFT":
          return this.veMezo.get(id)?.power ?? 0n
        case "voted":
          return this.veMezo.get(id)?.voted ?? false
        case "balanceOf":
          return BigInt([...this.veMezo.values()].filter((v) => same(v.owner, a[0] as string)).length)
        case "ownerToNFTokenIdList": {
          const ids = [...this.veMezo.entries()].filter(([, v]) => same(v.owner, a[0] as string)).map(([k]) => k)
          return ids[Number(a[1] as bigint)] ?? 0n
        }
      }
    }
    if (same(c.address, C.veBtc)) {
      switch (c.functionName) {
        case "unboostedTotalVotingPower":
          return this.Tb
        case "tokenId":
          return this.veBtcMax
        case "unboostedVotingPowerOfNFT":
          return this.veBtc.get(id)?.power ?? 0n
        case "locked":
          return this.veBtc.get(id)?.lock ?? { amount: 0n, end: 0n, isPermanent: false, boost: 0n }
        case "ownerOf":
          return this.veBtc.get(id)?.owner ?? zeroAddress
      }
    }
    if (same(c.address, C.boostVoter)) {
      const gauge = this.gauges.get(a[0] as Address)
      switch (c.functionName) {
        case "totalWeight":
          return this.totalWeight
        case "maxVotingNum":
          return 30n
        case "length":
          return BigInt(this.gauges.size)
        case "boostableTokenIdToGauge":
          return this.mapping.get(id) ?? zeroAddress
        case "isAlive":
          return gauge?.alive ?? false
        case "weights":
          return gauge?.weight ?? 0n
        case "gaugeToBribe":
          return gauge?.bribe ?? zeroAddress
        case "lastVoted":
          return this.veMezo.get(id)?.lastVoted ?? 0n
        case "usedWeights":
          return this.veMezo.get(id)?.used ?? 0n
        case "getBoost": {
          const g = this.mapping.get(id)
          return computeBoost({
            gaugeWeight: g ? (this.gauges.get(g)?.weight ?? 0n) : 0n,
            totalVeMezoVotingPower: this.Tm,
            totalUnboostedVeBtcVotingPower: this.Tb,
            positionUnboostedVotingPower: this.veBtc.get(id)?.power ?? 0n,
          })
        }
      }
    }
    const bribe = [...this.bribes.entries()].find(([k]) => same(k, c.address))?.[1]
    if (bribe !== undefined) {
      switch (c.functionName) {
        case "rewardsListLength":
          return BigInt(bribe.tokens.length)
        case "rewards":
          return bribe.tokens[Number(id)]
        case "tokenRewardsPerEpoch":
          return a[1] === EPOCH_START ? (bribe.posted.get(a[0] as Address) ?? 0n) : 0n
      }
    }
    if (same(c.address, MEZO)) {
      if (c.functionName === "symbol") return "MEZO"
      if (c.functionName === "decimals") return 18
    }
    throw new Error(`fake has no answer for ${c.address}.${c.functionName}`)
  }

  executor(): CallExecutor {
    return {
      execute: async (calls, { blockNumber, chunkSize }) =>
        calls.map((c): CallResult => {
          this.log.push({ key: c.key, blockNumber, chunkSize })
          const failure = this.failures.get(c.key)
          if (failure !== undefined) return { key: c.key, ...failure }
          try {
            return { key: c.key, ok: true, value: this.resolve(c) }
          } catch (error) {
            return { key: c.key, ok: false, kind: "reverted", error: (error as Error).message }
          }
        }),
    }
  }
}

function makeReader(fake: FakeMezo, chainId = 31611): MezoReader {
  return createMezoReader({
    network: "testnet",
    lightChunkSize: 4,
    heavyChunkSize: 2,
    executor: fake.executor(),
    chain: {
      getChainId: async () => chainId,
      getBlock: async (n) => ({ number: n ?? BLOCK, timestamp: T }),
    },
  })
}

let fake: FakeMezo
let G1: Address
beforeEach(() => {
  fake = new FakeMezo()
  G1 = fake.addPosition(1n, 1, { weight: tokens(25n), power: tokens(10n) }) // 2x, partial
  // id 2 has no gauge
  fake.addPosition(3n, 3, { weight: tokens(130n), power: tokens(10n), boost: 5n * P }) // capped, 30 excess
  fake.addPosition(4n, 4, { weight: tokens(7n), power: 0n, end: T - 10n }) // expired, zero power
  fake.addPosition(5n, 5, { alive: false, weight: 0n, power: tokens(10n) }) // killed gauge
  fake.addPosition(6n, 6, { weight: 0n, power: tokens(10n) }) // unboosted
  const b1 = fake.gauges.get(G1)?.bribe as Address
  fake.bribes.set(b1, { tokens: [MEZO], posted: new Map([[MEZO, tokens(80n)]]) })
})

describe("readMarketSnapshot", () => {
  it("builds a complete, block-pinned snapshot from a full veBTC id scan", async () => {
    const { snapshot, cache } = await makeReader(fake).readMarketSnapshot()
    expect(snapshot.meta).toMatchObject({ network: "testnet", chainId: 31611, blockNumber: BLOCK, completeness: "complete", mappingSource: "scan" })
    expect(snapshot.meta.failures).toEqual([])
    expect(snapshot.positions.map((p) => [p.tokenId, p.status])).toEqual([
      [1n, "active"],
      [3n, "active"],
      [4n, "expired"],
      [5n, "gauge-killed"],
      [6n, "active"],
    ])
    expect(snapshot.positions[0]?.analysis.liveBoost).toBe(2n * P)
    expect(snapshot.positions[1]?.analysis).toMatchObject({ atCap: true, excessWeight: tokens(30n), boostDrift: 0n })
    expect(snapshot.summary).toMatchObject({ livePositions: 3, atCap: 1, partiallyBoosted: 1, unboosted: 1, zeroPowerLiveGauges: 1 })
    expect(snapshot.summary.excessWeightOnLive).toBe(tokens(30n))
    expect(snapshot.global.epoch).toMatchObject({ epochStart: EPOCH_START, phase: "voting" })
    // Every read used the same block.
    expect(new Set(fake.log.map((l) => l.blockNumber))).toEqual(new Set([BLOCK]))
    // ids 1..6 were all scanned with the light chunk size; globals used the heavy chunk size.
    expect(fake.log.filter((l) => l.key.startsWith("mapping:")).map((l) => l.key)).toHaveLength(6)
    expect(fake.log.filter((l) => l.key.startsWith("mapping:")).every((l) => l.chunkSize === 4)).toBe(true)
    expect(fake.log.filter((l) => l.key.startsWith("global:")).every((l) => l.chunkSize === 2)).toBe(true)
    expect(cache?.entries.map((e) => e.tokenId)).toEqual([1n, 3n, 4n, 5n, 6n])
    expect(cache?.gaugeCount).toBe(5n)
  })

  it("reads incentive tokens and amounts posted for the current epoch", async () => {
    const { snapshot } = await makeReader(fake).readMarketSnapshot()
    expect(snapshot.incentives.completeness).toBe("complete")
    const g1 = snapshot.incentives.byGauge.find((g) => g.gauge === G1)
    expect(g1?.tokens).toEqual([{ token: MEZO, symbol: "MEZO", decimals: 18, postedForEpoch: tokens(80n) }])
    expect(snapshot.incentives.byGauge.filter((g) => g.tokens.length > 0)).toHaveLength(1)
    // Killed gauges are not queried for incentives.
    expect(snapshot.incentives.byGauge).toHaveLength(4)
  })

  it("optionally reads on-chain getBoost with the heavy chunk size", async () => {
    const { snapshot } = await makeReader(fake).readMarketSnapshot({ includeOnchainBoost: true, includeIncentives: false })
    for (const p of snapshot.positions) expect(p.onchainBoost).toBe(p.analysis.liveBoost)
    expect(fake.log.filter((l) => l.key.endsWith(":getBoost")).every((l) => l.chunkSize === 2)).toBe(true)
    expect(snapshot.incentives.included).toBe(false)
  })

  it("marks the snapshot partial and withholds the cache when part of the id scan fails", async () => {
    fake.failures.set("mapping:6", { ok: false, kind: "rpc", error: "timeout" })
    const { snapshot, cache } = await makeReader(fake).readMarketSnapshot()
    expect(snapshot.meta.completeness).toBe("partial")
    expect(snapshot.meta.failures).toContainEqual({ key: "mapping:6", kind: "rpc", message: "timeout" })
    expect(snapshot.positions.map((p) => p.tokenId)).not.toContain(6n)
    expect(cache).toBeNull()
  })

  it("excludes a position whose essential read failed and keeps the rest", async () => {
    fake.failures.set("position:3:weight", { ok: false, kind: "reverted", error: "boom" })
    const { snapshot } = await makeReader(fake).readMarketSnapshot()
    expect(snapshot.meta.completeness).toBe("partial")
    expect(snapshot.positions.map((p) => p.tokenId)).toEqual([1n, 4n, 5n, 6n])
    expect(snapshot.summary.positionsConsidered).toBe(4)
  })

  it("keeps a position with a non-essential failure, reports it, and stays complete", async () => {
    fake.failures.set("position:1:owner", { ok: false, kind: "rpc", error: "flaky" })
    const { snapshot } = await makeReader(fake).readMarketSnapshot()
    expect(snapshot.meta.completeness).toBe("complete")
    expect(snapshot.positions[0]?.owner).toBeNull()
    expect(snapshot.meta.failures).toContainEqual({ key: "position:1:owner", kind: "rpc", message: "flaky" })
  })

  it("rejects the wrong chain before reading any contract", async () => {
    await expect(makeReader(fake, 31612).readMarketSnapshot()).rejects.toBeInstanceOf(ChainMismatchError)
    expect(fake.log).toHaveLength(0)
  })

  it("fails loudly when global state cannot be read", async () => {
    fake.failures.set("global:veMezo.totalVotingPower", { ok: false, kind: "rpc", error: "out of gas" })
    await expect(makeReader(fake).readMarketSnapshot()).rejects.toBeInstanceOf(GlobalStateReadError)
  })
})

describe("gauge mapping cache", () => {
  it("reuses the mapping while BoostVoter.length() is unchanged and skips the id scan", async () => {
    const reader = makeReader(fake)
    const first = await reader.readMarketSnapshot({ includeIncentives: false })
    fake.log = []
    fake.veBtcMax = 50n // new veBTC ids without gauges cannot have mappings (length unchanged)
    const second = await reader.readMarketSnapshot({ ...(first.cache ? { cache: first.cache } : {}), includeIncentives: false })
    expect(second.snapshot.meta.mappingSource).toBe("cache")
    expect(fake.log.some((l) => l.key.startsWith("mapping:"))).toBe(false)
    expect(second.snapshot.positions.map((p) => p.tokenId)).toEqual(first.snapshot.positions.map((p) => p.tokenId))
  })

  it("rescans when a new gauge was created", async () => {
    const reader = makeReader(fake)
    const first = await reader.readMarketSnapshot({ includeIncentives: false })
    fake.addPosition(2n, 2, { weight: tokens(1n), power: tokens(10n) })
    const second = await reader.readMarketSnapshot({ ...(first.cache ? { cache: first.cache } : {}), includeIncentives: false })
    expect(second.snapshot.meta.mappingSource).toBe("scan")
    expect(second.snapshot.positions.map((p) => p.tokenId)).toContain(2n)
  })

  it("drops positions burned since the cache was made", async () => {
    const reader = makeReader(fake)
    const first = await reader.readMarketSnapshot({ includeIncentives: false })
    fake.mapping.delete(3n) // notifyBoostableBurned deletes the mapping (gauge count unchanged)
    const second = await reader.readMarketSnapshot({ ...(first.cache ? { cache: first.cache } : {}), includeIncentives: false })
    expect(second.snapshot.meta).toMatchObject({ mappingSource: "cache", completeness: "complete" })
    expect(second.snapshot.positions.map((p) => p.tokenId)).not.toContain(3n)
  })

  it("serializes and restores without losing precision", async () => {
    const { cache } = await makeReader(fake).readMarketSnapshot({ includeIncentives: false })
    if (cache === null) throw new Error("expected a cache")
    const restored = deserializeGaugeMappingCache(serializeGaugeMappingCache(cache))
    expect(restored).toEqual(cache)
    expect(decideCacheReuse(restored, { network: "testnet", boostVoter: C.boostVoter, gaugeCount: 5n })).toEqual({ reuse: true })
    expect(decideCacheReuse(restored, { network: "mainnet", boostVoter: C.boostVoter, gaugeCount: 5n })).toEqual({
      reuse: false,
      reason: "other-deployment",
    })
    expect(decideCacheReuse(restored, { network: "testnet", boostVoter: C.boostVoter, gaugeCount: 6n })).toEqual({
      reuse: false,
      reason: "gauge-count-changed",
    })
    expect(decideCacheReuse(restored, { network: "testnet", boostVoter: C.boostVoter, gaugeCount: 5n }, { maxAgeMs: 0, now: cache.scannedAt + 1 })).toEqual({
      reuse: false,
      reason: "expired",
    })
    expect(() => deserializeGaugeMappingCache('{"version":2}')).toThrow()
  })
})

describe("readPositions duplicate handling", () => {
  it("de-duplicates repeated token ids and flags conflicting or shared gauges", async () => {
    const reader = makeReader(fake)
    const block = await reader.getBlock()
    const global = await reader.readGlobalState(block)
    const G3 = fake.mapping.get(3n) as Address

    const repeated = await reader.readPositions(block, global, [
      { tokenId: 1n, gauge: G1 },
      { tokenId: 1n, gauge: G1 },
      { tokenId: 3n, gauge: G3 },
    ])
    expect(repeated.positions.map((p) => p.tokenId)).toEqual([1n, 3n])
    expect(repeated.failures).toEqual([])

    const conflicting = await reader.readPositions(block, global, [
      { tokenId: 1n, gauge: G1 },
      { tokenId: 1n, gauge: G3 },
    ])
    expect(conflicting.failures.map((f) => f.kind)).toEqual(["anomaly"])

    fake.mapping.set(6n, G1) // two veBTC ids claiming one gauge
    const shared = await reader.readPositions(block, global, [
      { tokenId: 1n, gauge: G1 },
      { tokenId: 6n, gauge: G1 },
    ])
    expect(shared.positions.map((p) => p.tokenId)).toEqual([1n])
    expect(shared.failures[0]).toMatchObject({ key: "position:6", kind: "anomaly" })
  })
})

describe("veMEZO reads", () => {
  const owner = fakeAddress(0xabc)
  beforeEach(() => {
    fake.veMezo.set(924n, {
      owner,
      lock: { amount: tokens(90n), end: 1_918_425_600n, isPermanent: false, boost: 0n },
      power: 89_942_291_952_788_172_340n,
      voted: false,
      lastVoted: 0n,
      used: 0n,
    })
  })

  it("reads a position and whether it can vote in this epoch", async () => {
    const pos = await makeReader(fake).readVeMezoPosition(924n)
    expect(pos).toMatchObject({ tokenId: 924n, owner, votingPower: 89_942_291_952_788_172_340n, canVoteThisEpoch: true, votedAnywhere: false })
    const record = fake.veMezo.get(924n)
    if (record) record.lastVoted = EPOCH_START + 5n
    expect((await makeReader(fake).readVeMezoPosition(924n)).canVoteThisEpoch).toBe(false)
  })

  it("lists a wallet's token ids and rejects unknown tokens", async () => {
    expect(await makeReader(fake).readVeMezoTokenIds(owner)).toEqual([924n])
    await expect(makeReader(fake).readVeMezoPosition(999n)).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe("createMulticallExecutor", () => {
  const callFor = (i: number): ContractCall => ({
    key: `gauge:${i}`,
    address: C.boostVoter,
    abi: boostVoterAbi,
    functionName: "gauges",
    args: [BigInt(i)],
  })
  /** Answers gauges(i) with fakeAddress(i); optionally fails chunks or single calls. */
  function transport(opts: { maxChunk?: number; poisoned?: number; revert?: number; empty?: number } = {}) {
    const sizes: number[] = []
    const t: Aggregate3Transport = {
      async aggregate3(calls: readonly Aggregate3Call[]) {
        sizes.push(calls.length)
        if (opts.maxChunk !== undefined && calls.length > opts.maxChunk) throw new Error("out of gas")
        const indices = calls.map((c) => Number(BigInt(`0x${c.callData.slice(10)}`)))
        if (opts.poisoned !== undefined && indices.includes(opts.poisoned)) throw new Error("deadline exceeded")
        return indices.map((i) => {
          if (i === opts.revert) return { success: false, returnData: encodeErrorResult({ abi: boostVoterAbi, errorName: "TooManyGauges" }) }
          if (i === opts.empty) return { success: true, returnData: "0x" as Hex }
          return { success: true, returnData: encodeFunctionResult({ abi: boostVoterAbi, functionName: "gauges", result: fakeAddress(i) }) }
        })
      },
    }
    return { t, sizes }
  }
  const noSleep = async (): Promise<void> => {}

  it("chunks by count and preserves order", async () => {
    const { t, sizes } = transport()
    const results = await createMulticallExecutor(t, { concurrency: 1 }).execute([0, 1, 2, 3, 4, 5, 6].map(callFor), { blockNumber: 1n, chunkSize: 3 })
    expect(sizes).toEqual([3, 3, 1])
    expect(results.map((r) => (r.ok ? r.value : null))).toEqual([0, 1, 2, 3, 4, 5, 6].map(fakeAddress))
  })

  it("splits chunks that fail at the transport level until they succeed", async () => {
    const { t, sizes } = transport({ maxChunk: 2 })
    const results = await createMulticallExecutor(t, { concurrency: 1 }).execute([0, 1, 2, 3, 4].map(callFor), { blockNumber: 1n, chunkSize: 5 })
    expect(results.every((r) => r.ok)).toBe(true)
    expect(results.map((r) => r.key)).toEqual([0, 1, 2, 3, 4].map((i) => `gauge:${i}`))
    expect(sizes[0]).toBe(5)
  })

  it("isolates a persistently failing call as an rpc failure after retries", async () => {
    const { t } = transport({ poisoned: 2 })
    const results = await createMulticallExecutor(t, { singleCallRetries: 2, sleep: noSleep }).execute([0, 1, 2, 3].map(callFor), {
      blockNumber: 1n,
      chunkSize: 4,
    })
    expect(results.filter((r) => r.ok).map((r) => r.key)).toEqual(["gauge:0", "gauge:1", "gauge:3"])
    expect(results[2]).toMatchObject({ key: "gauge:2", ok: false, kind: "rpc", error: "deadline exceeded" })
  })

  it("separates reverts and empty returns from successes, with decoded error names", async () => {
    const { t } = transport({ revert: 1, empty: 2 })
    const results = await createMulticallExecutor(t).execute([0, 1, 2].map(callFor), { blockNumber: 1n, chunkSize: 10 })
    expect(results[0]).toMatchObject({ ok: true })
    expect(results[1]).toMatchObject({ ok: false, kind: "reverted", error: "TooManyGauges" })
    expect(results[2]).toMatchObject({ ok: false, kind: "decode" })
  })

  it("rejects duplicate keys and invalid chunk sizes", async () => {
    const { t } = transport()
    const exec = createMulticallExecutor(t)
    await expect(exec.execute([callFor(1), callFor(1)], { blockNumber: 1n, chunkSize: 2 })).rejects.toThrow(/duplicate/)
    await expect(exec.execute([callFor(1)], { blockNumber: 1n, chunkSize: 0 })).rejects.toThrow(RangeError)
  })
})

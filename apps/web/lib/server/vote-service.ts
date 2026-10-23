import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  decodeFunctionData,
  encodeFunctionData,
  http,
  isAddress,
  isHash,
  type Address,
  type Hex,
  type PublicClient,
} from "viem"
import { CHAINS, boostVoterAbi, getDeployment, resolveRpcUrl } from "@boost-relay/mezo"
import { recommend, type OptimizerToken, type StrategyId } from "@boost-relay/optimizer"
import { stringifyBigints } from "../optimizer-dto"
import type { PrepareResponse, ReceiptResponse, SimulateResponse, VoteGate } from "../vote-dto"
import { getMarket, readerFor } from "./market-service"
import { assessVote } from "./vote-gates"

/** A prepared vote must be signed within this window or prepared again. */
export const PREPARED_TTL_MS = 120_000

const holderKey = Symbol.for("boost-relay.vote-service")
const holder = globalThis as unknown as Record<symbol, { client?: PublicClient } | undefined>
const state = (holder[holderKey] ??= {})

/** Read-only client for Mezo Testnet. It has no account and cannot sign. */
function testnetClient(): PublicClient {
  state.client ??= createPublicClient({
    chain: CHAINS.testnet,
    transport: http(resolveRpcUrl("testnet", { env: process.env }), { timeout: 30_000, retryCount: 1 }),
  }) as PublicClient
  return state.client
}

const REVERT_TEXT: Record<string, string> = {
  NotApprovedOrOwner: "The connected account does not own this veMEZO NFT.",
  AlreadyVotedOrDeposited: "This NFT already voted this epoch.",
  DistributeWindow: "Voting has not opened yet for this epoch.",
  NotWhitelistedNFT: "The voting window for this epoch has closed.",
  TooManyGauges: "Too many gauges for one vote.",
  NonZeroVotes: "A gauge appears twice.",
  GaugeNotAlive: "A selected gauge is no longer alive.",
  GaugeDoesNotExist: "A selected gauge does not exist.",
  ZeroBalance: "A gauge's share rounds to zero.",
  UnequalLengths: "Gauge and weight lists differ in length.",
  InactiveManagedNFT: "This managed NFT is deactivated.",
}

/** Turns a simulation failure into a plain explanation (custom error name when the contract gives one). */
export function describeRevert(error: unknown): { code: string; message: string } {
  if (error instanceof BaseError) {
    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName ?? "reverted"
      return { code: `revert:${name}`, message: REVERT_TEXT[name] ?? `The contract rejected the vote (${name}).` }
    }
    return { code: "simulation-error", message: error.shortMessage }
  }
  return { code: "simulation-error", message: "The simulation could not be completed." }
}

async function simulate(account: Address, tokenId: bigint, gauges: readonly Address[], weights: readonly bigint[]): Promise<{ ok: true; blockNumber: bigint } | { ok: false; code: string; message: string }> {
  const client = testnetClient()
  const blockNumber = await client.getBlockNumber()
  try {
    // eth_call from the connected account at the latest block: the exact call the wallet would send.
    await client.simulateContract({
      address: getDeployment("testnet").contracts.boostVoter,
      abi: boostVoterAbi,
      functionName: "vote",
      args: [tokenId, [...gauges], [...weights]],
      account,
      blockNumber,
    })
    return { ok: true, blockNumber }
  } catch (error) {
    return { ok: false, ...describeRevert(error) }
  }
}

/**
 * Fresh snapshot, fresh NFT state, recomputed recommendation, gates, then a simulation as the
 * connected account. Returns a description of the call; nothing is signed or sent here.
 */
export async function prepareVote(params: { network: "mainnet" | "testnet"; tokenId: bigint; strategy: StrategyId; account: string }): Promise<PrepareResponse> {
  if (params.network !== "testnet") return { ok: false, error: { code: "mainnet-disabled", message: "Voting is disabled on mainnet during the testnet beta." } }
  if (!isAddress(params.account)) return { ok: false, error: { code: "invalid-account", message: "The connected account is not a valid address." } }
  const account = params.account as Address
  const deployment = getDeployment("testnet")

  const { entry } = await getMarket("testnet", { refresh: true })
  const { snapshot } = entry
  const reader = readerFor("testnet")
  const block = snapshot.meta.blockNumber
  const [position, allocation] = await Promise.all([reader.readVeMezoPosition(params.tokenId, block), reader.readVeMezoVoteAllocation(params.tokenId, block)])
  const token: OptimizerToken = {
    tokenId: params.tokenId,
    owner: position.owner,
    votingPower: position.votingPower,
    lastVoted: position.lastVoted,
    votedAnywhere: position.votedAnywhere,
    lockEnd: position.lock.end,
    isPermanent: position.lock.isPermanent,
    allocation,
    blockNumber: position.blockNumber,
  }
  const rec = recommend({ snapshot, token, strategy: params.strategy, context: { network: "testnet", chainId: deployment.chainId, boostVoter: deployment.contracts.boostVoter } })
  const gates: VoteGate[] = assessVote({ network: "testnet", account, snapshot, token, recommendation: rec, nowSeconds: BigInt(Math.floor(Date.now() / 1000)) })
  const failed = gates.filter((g) => !g.ok)
  if (failed.length > 0 || rec.voteCall === null) {
    return { ok: false, error: { code: "not-eligible", message: failed.map((g) => g.detail).join(" ") || "No vote call could be built." }, gates }
  }

  const call = rec.voteCall
  const sim = await simulate(account, call.tokenId, call.gauges, call.weights)
  if (!sim.ok) return { ok: false, error: { code: sim.code, message: `Simulation failed: ${sim.message}` }, gates }

  const tokenByGauge = new Map(snapshot.positions.map((p) => [p.gauge.toLowerCase(), p.tokenId.toString()]))
  const now = Date.now()
  return {
    ok: true,
    prepared: {
      network: "testnet",
      chainId: deployment.chainId,
      account,
      to: deployment.contracts.boostVoter,
      functionName: "vote",
      signature: "vote(uint256,address[],uint256[])",
      tokenId: call.tokenId.toString(),
      gauges: [...call.gauges],
      gaugeTokenIds: call.gauges.map((g) => tokenByGauge.get(g.toLowerCase()) ?? null),
      weights: call.weights.map((w) => w.toString()),
      calldata: encodeFunctionData({ abi: boostVoterAbi, functionName: "vote", args: [call.tokenId, [...call.gauges], [...call.weights]] }),
      strategy: params.strategy,
      votingPower: token.votingPower.toString(),
      sourceBlock: block.toString(),
      sourceTimestamp: snapshot.meta.blockTimestamp.toString(),
      epochStart: snapshot.global.epoch.epochStart.toString(),
      voteEnd: snapshot.global.epoch.voteEnd.toString(),
      preparedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + PREPARED_TTL_MS).toISOString(),
      simulation: { ok: true, blockNumber: sim.blockNumber.toString(), simulatedAt: new Date().toISOString() },
      gates,
      recommendation: { ...stringifyBigints(rec), calldata: null },
      existingVotes: allocation.entries.map((e) => ({ gauge: e.gauge, tokenId: tokenByGauge.get(e.gauge.toLowerCase()) ?? null, votes: e.votes.toString() })),
    },
  }
}

/** Re-checks ownership and epoch eligibility, then re-simulates the exact calldata as the account. */
export async function simulateVote(request: { network: string; account: string; to: string; data: string }): Promise<SimulateResponse> {
  if (request.network !== "testnet") return { ok: false, error: { code: "mainnet-disabled", message: "Voting is disabled on mainnet during the testnet beta." } }
  if (!isAddress(request.account)) return { ok: false, error: { code: "invalid-account", message: "The connected account is not a valid address." } }
  const deployment = getDeployment("testnet")
  if (request.to.toLowerCase() !== deployment.contracts.boostVoter.toLowerCase()) return { ok: false, error: { code: "wrong-contract", message: "The call does not target the verified BoostVoter contract." } }
  let args: readonly [bigint, readonly Address[], readonly bigint[]]
  try {
    const decoded = decodeFunctionData({ abi: boostVoterAbi, data: request.data as Hex })
    if (decoded.functionName !== "vote") return { ok: false, error: { code: "wrong-function", message: "Only BoostVoter.vote() can be simulated here." } }
    args = decoded.args as unknown as readonly [bigint, readonly Address[], readonly bigint[]]
  } catch {
    return { ok: false, error: { code: "bad-calldata", message: "The calldata does not decode with the verified BoostVoter ABI." } }
  }
  const [tokenId, gauges, weights] = args
  const position = await readerFor("testnet").readVeMezoPosition(tokenId)
  if (position.owner.toLowerCase() !== request.account.toLowerCase()) return { ok: false, error: { code: "not-owner", message: `veMEZO #${tokenId} is not owned by the connected account.` } }
  if (!position.canVoteThisEpoch) return { ok: false, error: { code: "cannot-vote", message: "This NFT cannot vote right now (already voted or outside the voting window)." } }
  const sim = await simulate(request.account as Address, tokenId, gauges, weights)
  if (!sim.ok) return { ok: false, error: { code: sim.code, message: sim.message } }
  return { ok: true, blockNumber: sim.blockNumber.toString(), simulatedAt: new Date().toISOString() }
}

/** Receipt lookup only. A missing receipt is "pending", never "failed". */
export async function readReceipt(network: string, hash: string): Promise<ReceiptResponse> {
  if (network !== "testnet") return { ok: false, error: { code: "mainnet-disabled", message: "Receipts are tracked on testnet only during the beta." } }
  if (!isHash(hash)) return { ok: false, error: { code: "bad-hash", message: "Not a transaction hash." } }
  try {
    const receipt = await testnetClient().getTransactionReceipt({ hash })
    return { ok: true, status: receipt.status === "success" ? "success" : "reverted", blockNumber: receipt.blockNumber.toString(), gasUsed: receipt.gasUsed.toString() }
  } catch (error) {
    if (error instanceof BaseError && error.name === "TransactionReceiptNotFoundError") return { ok: true, status: "pending", blockNumber: null, gasUsed: null }
    return { ok: false, error: { code: "receipt-unavailable", message: "The receipt could not be read from the RPC." } }
  }
}

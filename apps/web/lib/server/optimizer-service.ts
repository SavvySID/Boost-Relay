import { CHAINS, NotFoundError, boostVoterAbi, getDeployment, type NetworkName } from "@boost-relay/mezo"
import { STRATEGIES, recommendAll, type OptimizerToken, type Recommendation, type StrategyId } from "@boost-relay/optimizer"
import { encodeFunctionData } from "viem"
import { stringifyBigints, type OptimizerDto, type RecommendationDto } from "../optimizer-dto"
import { describeError, getMarket, readerFor } from "./market-service"

/** A computed recommendation is re-served for this long for the same NFT and network. */
const RESULT_TTL_MS = 15_000

interface Cached {
  readonly dto: OptimizerDto
  readonly computedAt: number
}
const holderKey = Symbol.for("boost-relay.optimizer-service")
const holder = globalThis as unknown as Record<symbol, { results: Map<string, Cached>; inflight: Map<string, Promise<Cached>> } | undefined>
const state = (holder[holderKey] ??= { results: new Map(), inflight: new Map() })

/** Encodes the proposed call with the verified ABI. Display only: Boost Relay never sends it. */
function calldataFor(r: Recommendation): string | null {
  if (r.voteCall === null) return null
  return encodeFunctionData({ abi: boostVoterAbi, functionName: "vote", args: [r.voteCall.tokenId, [...r.voteCall.gauges], [...r.voteCall.weights]] })
}

async function compute(network: NetworkName, tokenId: bigint, fresh: boolean): Promise<Cached> {
  const { entry } = await getMarket(network, { refresh: fresh })
  const { snapshot } = entry
  const reader = readerFor(network)
  const block = snapshot.meta.blockNumber
  // Both reads are pinned to the snapshot's block so the NFT and the market describe the same state.
  const [position, allocation] = await Promise.all([reader.readVeMezoPosition(tokenId, block), reader.readVeMezoVoteAllocation(tokenId, block)])
  const deployment = getDeployment(network)
  const token: OptimizerToken = {
    tokenId,
    owner: position.owner,
    votingPower: position.votingPower,
    lastVoted: position.lastVoted,
    votedAnywhere: position.votedAnywhere,
    lockEnd: position.lock.end,
    isPermanent: position.lock.isPermanent,
    allocation,
    blockNumber: position.blockNumber,
  }
  const recs = recommendAll({ snapshot, token, context: { network, chainId: deployment.chainId, boostVoter: deployment.contracts.boostVoter } })
  const toDto = (r: Recommendation): RecommendationDto => ({ ...stringifyBigints(r), calldata: calldataFor(r) })
  const tokenByGauge = new Map(snapshot.positions.map((p) => [p.gauge.toLowerCase(), p.tokenId.toString()]))
  const dto: OptimizerDto = {
    network,
    chainId: deployment.chainId,
    sourceBlock: block.toString(),
    blockTimestamp: snapshot.meta.blockTimestamp.toString(),
    explorerUrl: CHAINS[network].blockExplorers?.default.url ?? "",
    boostVoter: deployment.contracts.boostVoter,
    maxVotingNum: snapshot.global.maxVotingNum.toString(),
    totalVeMezoVotingPower: snapshot.global.totalVeMezoVotingPower.toString(),
    epoch: stringifyBigints({
      epochStart: snapshot.global.epoch.epochStart,
      epochNext: snapshot.global.epoch.epochNext,
      voteStart: snapshot.global.epoch.voteStart,
      voteEnd: snapshot.global.epoch.voteEnd,
      phase: snapshot.global.epoch.phase,
    }),
    snapshotCompleteness: snapshot.meta.completeness,
    candidateMarket: { activePositions: snapshot.summary.livePositions, positionsRead: snapshot.positions.length },
    token: {
      tokenId: tokenId.toString(),
      owner: position.owner,
      votingPower: position.votingPower.toString(),
      lockAmount: position.lock.amount.toString(),
      lockEnd: position.lock.end.toString(),
      isPermanent: position.lock.isPermanent,
      lastVoted: position.lastVoted.toString(),
      votedAnywhere: position.votedAnywhere,
      canVoteThisEpoch: position.canVoteThisEpoch,
      allocation: {
        usedWeight: allocation.usedWeight.toString(),
        entries: allocation.entries.map((e) => ({ gauge: e.gauge, votes: e.votes.toString(), tokenId: tokenByGauge.get(e.gauge.toLowerCase()) ?? null })),
        complete: allocation.complete,
        issues: allocation.issues,
      },
    },
    strategies: STRATEGIES,
    recommendations: { "max-boosted-power": toDto(recs["max-boosted-power"]), "max-capped-positions": toDto(recs["max-capped-positions"]) } as Record<StrategyId, RecommendationDto>,
  }
  return { dto, computedAt: Date.now() }
}

/** fresh: bypass the recommendation cache and ask for a market re-read (used right after a confirmed vote). */
export async function getRecommendation(network: NetworkName, tokenId: bigint, options: { readonly fresh?: boolean } = {}): Promise<{ readonly result: Cached; readonly source: "fresh" | "cache" }> {
  const key = `${network}:${tokenId}`
  const cached = state.results.get(key)
  if (options.fresh !== true && cached !== undefined && Date.now() - cached.computedAt < RESULT_TTL_MS) return { result: cached, source: "cache" }
  let pending = state.inflight.get(key)
  if (pending === undefined) {
    pending = compute(network, tokenId, options.fresh === true)
      .then((r) => {
        state.results.set(key, r)
        return r
      })
      .finally(() => state.inflight.delete(key))
    state.inflight.set(key, pending)
  }
  return { result: await pending, source: "fresh" }
}

export function describeOptimizerError(error: unknown, network: NetworkName, tokenId: bigint): { status: number; code: string; message: string } {
  if (error instanceof NotFoundError) return { status: 404, code: "token-not-found", message: `veMEZO #${tokenId} does not exist on Mezo ${network === "mainnet" ? "Mainnet" : "Testnet"}.` }
  const d = describeError(error, network)
  return { status: 502, ...d }
}

import type { Recommendation, StrategyId } from "@boost-relay/optimizer"
import type { NetworkName } from "./market-dto"

/** Lossless JSON form of a value: every bigint becomes a base-10 string, recursively. */
export type Stringified<T> = T extends bigint
  ? string
  : T extends readonly (infer U)[]
    ? readonly Stringified<U>[]
    : T extends object
      ? { readonly [K in keyof T]: Stringified<T[K]> }
      : T

export function stringifyBigints<T>(value: T): Stringified<T> {
  if (typeof value === "bigint") return value.toString() as Stringified<T>
  if (Array.isArray(value)) return value.map((v) => stringifyBigints(v)) as Stringified<T>
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stringifyBigints(v)])) as Stringified<T>
  }
  return value as Stringified<T>
}

export type RecommendationDto = Stringified<Recommendation> & {
  /** ABI-encoded vote() calldata from the verified boostVoterAbi, for display. Never sent by Boost Relay. */
  readonly calldata: string | null
}

export interface OptimizerTokenDto {
  readonly tokenId: string
  readonly owner: string
  readonly votingPower: string
  readonly lockAmount: string
  readonly lockEnd: string
  readonly isPermanent: boolean
  readonly lastVoted: string
  readonly votedAnywhere: boolean
  readonly canVoteThisEpoch: boolean
  readonly allocation: {
    readonly usedWeight: string
    readonly entries: readonly { readonly gauge: string; readonly votes: string; readonly tokenId: string | null }[]
    readonly complete: boolean
    readonly issues: readonly string[]
  }
}

export interface OptimizerDto {
  readonly network: NetworkName
  readonly chainId: number
  readonly sourceBlock: string
  readonly blockTimestamp: string
  readonly explorerUrl: string
  readonly boostVoter: string
  readonly maxVotingNum: string
  /** veMEZO.totalVotingPower() at the source block, for context on how large this NFT is. */
  readonly totalVeMezoVotingPower: string
  readonly epoch: { readonly epochStart: string; readonly epochNext: string; readonly voteStart: string; readonly voteEnd: string; readonly phase: string }
  readonly snapshotCompleteness: "complete" | "partial"
  readonly candidateMarket: { readonly activePositions: number; readonly positionsRead: number }
  readonly token: OptimizerTokenDto
  readonly strategies: Readonly<Record<StrategyId, { readonly label: string; readonly objective: string; readonly guarantee: string }>>
  readonly recommendations: Readonly<Record<StrategyId, RecommendationDto>>
}

export type OptimizerResponse =
  | { readonly ok: true; readonly data: OptimizerDto; readonly served: { readonly source: "fresh" | "cache"; readonly computedAt: string } }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

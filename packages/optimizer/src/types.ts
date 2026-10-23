import type { MarketSnapshot } from "@boost-relay/mezo"

export type Address = `0x${string}`

/**
 * - "max-boosted-power": maximize the increase in boosted veBTC voting power (sum of unboosted
 *   power x live boost over affected positions). Optimal under the gauge limit, up to rounding.
 * - "max-capped-positions": maximize the number of positions that newly reach 5x. Optimal for
 *   that count; the remainder of the NFT's power is placed by a fixed rule.
 */
export type StrategyId = "max-boosted-power" | "max-capped-positions"

/** The veMEZO NFT being optimized, read on-chain at the snapshot block. */
export interface OptimizerToken {
  readonly tokenId: bigint
  readonly owner: Address
  /** veMEZO.votingPowerOfNFT(tokenId): the weight vote() splits across gauges. */
  readonly votingPower: bigint
  /** BoostVoter.lastVoted(tokenId), unix seconds. */
  readonly lastVoted: bigint
  /** veMEZO.voted(tokenId): true while any voter (boost or third-party) holds votes for it. */
  readonly votedAnywhere: boolean
  readonly lockEnd: bigint
  readonly isPermanent: boolean
  /** This NFT's current BoostVoter allocation; vote() resets all of it first. */
  readonly allocation: {
    readonly usedWeight: bigint
    readonly entries: readonly { readonly gauge: Address; readonly votes: bigint }[]
    readonly complete: boolean
    readonly issues: readonly string[]
  }
  /** Block the token and allocation were read at; must equal the snapshot block. */
  readonly blockNumber: bigint
}

export interface OptimizerContext {
  readonly network: "mainnet" | "testnet"
  readonly chainId: number
  /** BoostVoter address the proposed vote() call targets. */
  readonly boostVoter: Address
}

export interface OptimizerInput {
  readonly snapshot: MarketSnapshot
  readonly token: OptimizerToken
  readonly strategy: StrategyId
  readonly context: OptimizerContext
  /** Smallest allocation placed on a gauge (avoids ZeroBalance reverts after power decays). Default 1e12 wei. */
  readonly minAllocation?: bigint
}

/** A veBTC position that can receive this NFT's votes. */
export interface Candidate {
  readonly tokenId: bigint
  readonly gauge: Address
  readonly unboostedVotingPower: bigint
  /** BoostVoter.weights(gauge) at the snapshot (includes this NFT's prior votes). */
  readonly currentWeight: bigint
  /** votes(tokenId, gauge) for the optimized NFT. */
  readonly nftPriorVotes: bigint
  /** currentWeight - nftPriorVotes: the weight that remains after vote() resets this NFT. */
  readonly baseWeight: bigint
  /** Exact minimum gauge weight for 5x (requiredWeightForBoost). */
  readonly required5x: bigint
  /** max(0, required5x - baseWeight): weight this NFT can add before hitting the cap. */
  readonly headroom: bigint
  readonly currentBoost: bigint
  readonly lockEnd: bigint
  readonly isPermanent: boolean
}

export type ReasonCode =
  | "below-cap"
  | "reaches-5x"
  | "largest-headroom"
  | "smallest-headroom"
  | "partial-fill"
  | "leftover-excess"
  | "replaces-prior-vote"

export interface Reason {
  readonly code: ReasonCode
  readonly text: string
}

export interface AllocationLine {
  readonly rank: number
  readonly tokenId: bigint
  readonly gauge: Address
  readonly currentGaugeWeight: bigint
  readonly nftPriorVotes: bigint
  readonly baseGaugeWeight: bigint
  readonly headroomTo5x: bigint
  /** Value passed in vote()'s weights[]: a relative weight. At the source block it equals the absolute votes. */
  readonly recommendedWeight: bigint
  /** floor(weight x votingPower / sum(weights)), exactly as NonStakingVoter._vote computes it. */
  readonly predictedVotes: bigint
  readonly projectedGaugeWeight: bigint
  readonly currentBoost: bigint
  readonly projectedBoost: bigint
  /** Predicted votes past this position's 5x requirement (no boost from them). */
  readonly excessAbove5x: bigint
  readonly role: "fills-to-5x" | "partial" | "leftover"
  readonly reasons: readonly Reason[]
}

/** A gauge where this NFT has prior votes that the new vote would remove. */
export interface RemovedVoteLine {
  readonly gauge: Address
  /** null when the gauge is not a live position in the snapshot (e.g. its veBTC was burned). */
  readonly tokenId: bigint | null
  readonly priorVotes: bigint
  readonly currentBoost: bigint | null
  readonly projectedBoost: bigint | null
}

export interface Issue {
  readonly code: string
  readonly text: string
}

export interface RecommendationSummary {
  readonly votingPower: bigint
  readonly totalRecommendedWeight: bigint
  readonly predictedVotesUsed: bigint
  /** votingPower - predictedVotesUsed: integer dust vote() leaves unallocated. 0 when weights sum to the power. */
  readonly roundingRemainder: bigint
  readonly gaugesUsed: number
  readonly maxGauges: number
  readonly candidateCount: number
  /** Selected positions below 5x before and at 5x after. */
  readonly positionsReaching5x: number
  readonly positionsImproved: number
  /** Positions whose boost falls because this NFT's prior votes are removed. */
  readonly positionsLosingBoost: number
  readonly excessAbove5x: bigint
  /** Sum of unboosted power x boost / 1e18 over every affected position, before and after. */
  readonly boostedPowerBefore: bigint
  readonly boostedPowerAfter: bigint
  readonly boostedPowerChange: bigint
  /** Sum of headroom over all candidates: the most weight that could add boost if there were no gauge limit. */
  readonly totalCandidateHeadroom: bigint
  readonly objectiveNote: string
}

/**
 * - "actionable": every precondition and post-check passed; a vote could be prepared later.
 * - "informational": computed correctly, but the NFT cannot vote right now (epoch rules).
 * - "blocked": not computed or not trustworthy; see blockers.
 */
export type RecommendationStatus = "actionable" | "informational" | "blocked"

export interface CheckResult {
  readonly name: string
  readonly ok: boolean
  readonly detail: string
}

export interface ProposedVoteCall {
  readonly network: "mainnet" | "testnet"
  readonly chainId: number
  readonly to: Address
  readonly functionName: "vote"
  readonly signature: "vote(uint256,address[],uint256[])"
  readonly tokenId: bigint
  readonly gauges: readonly Address[]
  readonly weights: readonly bigint[]
  readonly sourceBlock: bigint
  readonly weightSemantics: string
  /** False unless the recommendation is actionable. This package never sends anything. */
  readonly executable: boolean
}

export interface Recommendation {
  readonly strategy: StrategyId
  readonly status: RecommendationStatus
  readonly tokenId: bigint
  readonly sourceBlock: bigint
  readonly lines: readonly AllocationLine[]
  readonly removed: readonly RemovedVoteLine[]
  readonly summary: RecommendationSummary | null
  readonly blockers: readonly Issue[]
  readonly warnings: readonly Issue[]
  readonly checks: readonly CheckResult[]
  readonly voteCall: ProposedVoteCall | null
}

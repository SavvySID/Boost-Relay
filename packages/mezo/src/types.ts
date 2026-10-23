import type { Address } from "viem"
import type { NetworkName } from "./config/chains.js"
import type { BoostAnalysis, MarketSummary, PositionStatus } from "./boost.js"
import type { EpochInfo } from "./epoch.js"

/** A block every read in a snapshot is pinned to. */
export interface BlockRef {
  readonly number: bigint
  /** Unix seconds. */
  readonly timestamp: bigint
}

/** One read that did not produce a usable value. Never silently dropped. */
export interface ReadFailure {
  /** Stable identifier, e.g. `position:812:weights` or `mapping:1043`. */
  readonly key: string
  readonly kind: "reverted" | "decode" | "rpc" | "anomaly"
  readonly message: string
}

export interface GlobalState {
  /** veMEZO.totalVotingPower() (18 decimals). Denominator for the votes ratio. */
  readonly totalVeMezoVotingPower: bigint
  /** veBTC.unboostedTotalVotingPower() (18 decimals). */
  readonly totalUnboostedVeBtcVotingPower: bigint
  /** BoostVoter.totalWeight(): all veMEZO weight currently allocated, live or dead gauges. */
  readonly boostVoterTotalWeight: bigint
  /** BoostVoter.maxVotingNum(): gauges allowed in one vote (enforced on-chain). */
  readonly maxVotingNum: bigint
  /** BoostVoter.length(): number of boost gauges ever created. */
  readonly gaugeCount: bigint
  /** veBTC.tokenId(): highest minted veBTC id. Ids are minted as ++tokenId, so 1..n covers all. */
  readonly veBtcMaxTokenId: bigint
  /** veMEZO.tokenId(). */
  readonly veMezoMaxTokenId: bigint
  readonly epoch: EpochInfo
}

export interface LockInfo {
  /** LockedBalance.amount (int128 on-chain, physical tokens locked). */
  readonly amount: bigint
  /** LockedBalance.end, unix seconds. 0 for permanent locks. */
  readonly end: bigint
  readonly isPermanent: boolean
  /** LockedBalance.boost as stored (1e18 precision; 0 means 1x). */
  readonly storedBoostRaw: bigint
}

/** A veBTC position that has a BoostVoter boost gauge, read at the snapshot block. */
export interface BoostPosition {
  readonly tokenId: bigint
  readonly gauge: Address
  /** BribeVotingReward for the gauge, or null if the read failed. */
  readonly bribe: Address | null
  /** veBTC.ownerOf(tokenId), or null if the read failed. */
  readonly owner: Address | null
  readonly gaugeAlive: boolean
  readonly lock: LockInfo
  /** veBTC.unboostedVotingPowerOfNFT(tokenId). */
  readonly unboostedVotingPower: bigint
  /** BoostVoter.weights(gauge): veMEZO votes on this position's gauge. */
  readonly gaugeWeight: bigint
  readonly status: PositionStatus
  readonly analysis: BoostAnalysis
  /** BoostVoter.getBoost(tokenId) when requested; null when not requested or failed. */
  readonly onchainBoost: bigint | null
}

export interface IncentiveTokenAmount {
  readonly token: Address
  readonly symbol: string | null
  readonly decimals: number | null
  /**
   * tokenRewardsPerEpoch(token, epochStart): amount deposited for the epoch so far.
   * It is what has been posted, not what any voter will earn.
   */
  readonly postedForEpoch: bigint
}

export interface GaugeIncentives {
  readonly gauge: Address
  readonly bribe: Address
  readonly epochStart: bigint
  readonly tokens: readonly IncentiveTokenAmount[]
}

export interface SnapshotMeta {
  readonly network: NetworkName
  readonly chainId: number
  readonly blockNumber: bigint
  readonly blockTimestamp: bigint
  /** Wall-clock time the snapshot finished, ISO-8601. */
  readonly fetchedAt: string
  /** Seconds between the block timestamp and fetchedAt. */
  readonly ageSeconds: number
  /**
   * "complete" only if every veBTC id was scanned and every essential position read succeeded.
   * A "partial" snapshot must not be presented as the whole market.
   */
  readonly completeness: "complete" | "partial"
  readonly mappingSource: "scan" | "cache"
  readonly failures: readonly ReadFailure[]
}

export interface MarketSnapshot {
  readonly meta: SnapshotMeta
  readonly global: GlobalState
  readonly positions: readonly BoostPosition[]
  readonly summary: MarketSummary
  readonly incentives: {
    readonly included: boolean
    readonly completeness: "complete" | "partial"
    readonly byGauge: readonly GaugeIncentives[]
    readonly failures: readonly ReadFailure[]
  }
}

/**
 * A veMEZO NFT's current BoostVoter allocation, read at one block.
 *
 * BoostVoter keeps `gaugeVote[tokenId]` (gauges this NFT voted for) and `votes[tokenId][gauge]`
 * (absolute weight on each). The next vote() first resets all of these (NonStakingVoter._vote calls
 * _reset), so an optimizer must subtract them from current gauge weights.
 */
export interface VeMezoVoteAllocation {
  readonly tokenId: bigint
  readonly blockNumber: bigint
  /** BoostVoter.usedWeights(tokenId): sum of this NFT's votes across gauges. */
  readonly usedWeight: bigint
  readonly entries: readonly { readonly gauge: Address; readonly votes: bigint }[]
  /**
   * True only if the gaugeVote array was read to its end and sum(entries.votes) == usedWeight.
   * When false, the allocation must not be used for an actionable recommendation.
   */
  readonly complete: boolean
  readonly issues: readonly string[]
}

/** A veMEZO NFT as read for a wallet (voting side). */
export interface VeMezoPosition {
  readonly tokenId: bigint
  readonly owner: Address
  readonly lock: LockInfo
  /** veMEZO.votingPowerOfNFT(tokenId): the weight BoostVoter.vote() would use now. */
  readonly votingPower: bigint
  /** veMEZO.voted(tokenId): true while any voter (boost or third-party) holds votes for it. */
  readonly votedAnywhere: boolean
  /** BoostVoter.lastVoted(tokenId), unix seconds; 0 if never voted. */
  readonly lastVoted: bigint
  /** BoostVoter.usedWeights(tokenId). */
  readonly usedWeight: bigint
  /** True if a BoostVoter.vote() would pass the epoch checks at this block (ignores whitelisting). */
  readonly canVoteThisEpoch: boolean
  readonly blockNumber: bigint
}

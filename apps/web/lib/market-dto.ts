/**
 * JSON-safe market snapshot sent from /api/market to the browser.
 *
 * Every on-chain integer (uint256, token amounts with 18 decimals, 1e18-precision boosts,
 * unix timestamps, block numbers) is a base-10 string. Convert with BigInt(value); never
 * with Number(), which loses precision above 2^53.
 */

export type NetworkName = "mainnet" | "testnet"

/** Base-10 string of a non-negative bigint. */
export type Uint = string
/** Base-10 string of a signed bigint (may start with "-"). */
export type Int = string

export type PositionStatus = "active" | "gauge-killed" | "no-lock" | "expired" | "no-power"

export interface FailureDto {
  readonly key: string
  readonly kind: "reverted" | "decode" | "rpc" | "anomaly"
  readonly message: string
}

export type TargetDto =
  | {
      readonly reachable: true
      readonly requiredWeight: Uint
      readonly additionalWeight: Uint
      readonly alreadyMet: boolean
      readonly exceedsTotalVotingPower: boolean
    }
  | { readonly reachable: false; readonly reason: "above-cap" | "no-position-power" | "no-vemezo-power" | "zero-boostable-ratio" }

export interface IncentiveTokenDto {
  readonly token: string
  /** null when the token's symbol() read failed. */
  readonly symbol: string | null
  /** null when the token's decimals() read failed. */
  readonly decimals: number | null
  /** tokenRewardsPerEpoch(token, epochStart): posted for this epoch so far, not an earnings figure. */
  readonly postedForEpoch: Uint
}

/**
 * - "posted": the bribe contract was read and at least one token has a non-zero amount this epoch.
 * - "none-posted": read successfully; nothing posted this epoch (confirmed zero).
 * - "unavailable": the gauge has no bribe address or an incentive read failed.
 * - "not-read": the gauge is killed, so incentives were not queried.
 */
export type IncentiveStatus = "posted" | "none-posted" | "unavailable" | "not-read"

export interface PositionDto {
  readonly tokenId: Uint
  readonly gauge: string
  readonly bribe: string | null
  /** null when the ownerOf read failed. */
  readonly owner: string | null
  readonly gaugeAlive: boolean
  readonly status: PositionStatus
  readonly lock: {
    readonly amount: Uint
    /** Unix seconds; 0 for permanent locks. */
    readonly end: Uint
    readonly isPermanent: boolean
  }
  readonly unboostedVotingPower: Uint
  /** veMEZO weight voted onto this position's boost gauge. */
  readonly gaugeWeight: Uint
  /** 1e18 precision (1x = 1e18). */
  readonly liveBoost: Uint
  /** Boost currently applied on veBTC (1e18 precision, 0 normalized to 1x). */
  readonly storedBoost: Uint
  /** liveBoost - storedBoost; non-zero means a permissionless poke would change the applied boost. */
  readonly boostDrift: Int
  readonly atCap: boolean
  readonly canIncreaseWithMoreVotes: boolean
  readonly targets: { readonly "2x": TargetDto; readonly "3x": TargetDto; readonly "5x": TargetDto }
  /** Weight that adds no boost: above the 5x requirement, or all weight if the position has no power. */
  readonly excessWeight: Uint
  readonly incentives: { readonly status: IncentiveStatus; readonly tokens: readonly IncentiveTokenDto[] }
}

export interface RatioDto {
  readonly numerator: Uint
  readonly denominator: Uint
}

export interface BoostBucketDto {
  readonly label: string
  /** Inclusive lower bound, 1e18 precision. */
  readonly from: Uint
  /** Exclusive upper bound, 1e18 precision; equal to `from` for the exact 1x and 5x buckets. */
  readonly to: Uint
  readonly count: number
}

export interface MarketDto {
  readonly meta: {
    readonly network: NetworkName
    readonly chainId: number
    readonly blockNumber: Uint
    readonly blockTimestamp: Uint
    readonly fetchedAt: string
    readonly ageSeconds: number
    readonly completeness: "complete" | "partial"
    readonly mappingSource: "scan" | "cache"
    readonly failures: readonly FailureDto[]
    readonly explorerUrl: string
  }
  readonly global: {
    readonly totalVeMezoVotingPower: Uint
    readonly totalUnboostedVeBtcVotingPower: Uint
    readonly boostVoterTotalWeight: Uint
    readonly maxVotingNum: Uint
    readonly gaugeCount: Uint
    readonly veBtcMaxTokenId: Uint
    readonly epoch: {
      readonly epochStart: Uint
      readonly epochNext: Uint
      readonly voteStart: Uint
      readonly voteEnd: Uint
      readonly phase: "distribution" | "voting" | "whitelist-only"
    }
  }
  /** From @boost-relay/mezo summarizeMarket: "live" means gauge alive and veBTC unboosted power > 0. */
  readonly summary: {
    readonly livePositions: number
    readonly atCap: number
    readonly partiallyBoosted: number
    readonly unboosted: number
    readonly weightOnLivePositions: Uint
    readonly weightNeededToMaxAll: Uint
    readonly excessWeightOnLive: Uint
    readonly excessShareOfLive: RatioDto
    readonly zeroPowerLiveGauges: number
    readonly weightOnZeroPowerLiveGauges: Uint
    readonly excessShareIncludingZeroPower: RatioDto
    readonly positionsConsidered: number
  }
  /** Values derived on the server from the same snapshot (no extra RPC reads). */
  readonly derived: {
    readonly statusCounts: Readonly<Record<PositionStatus, number>>
    /** Sum of the extra weight live, below-cap positions need for 5x (where 5x is reachable). */
    readonly additionalWeightToMaxBelowCap: Uint
    /** Live, below-cap positions whose 5x requirement exceeds all veMEZO or is unreachable. */
    readonly belowCapNotMaxable: number
    /** Weight on gauges of killed positions read in this snapshot. */
    readonly weightOnKilledGauges: Uint
    /** BoostVoter.totalWeight minus weight attributed to read positions (e.g. gauges of burned veBTC). */
    readonly weightUnattributed: Uint
    /** Live positions by boost level. */
    readonly boostBuckets: readonly BoostBucketDto[]
    /** True if summary.livePositions equals the count of positions with status "active". */
    readonly liveMatchesActive: boolean
  }
  readonly incentives: {
    readonly included: boolean
    readonly completeness: "complete" | "partial"
    readonly epochStart: Uint
    readonly epochNext: Uint
    readonly failures: readonly FailureDto[]
  }
  readonly positions: readonly PositionDto[]
}

export interface MarketServed {
  /** "cache": an earlier snapshot is being re-served; its block and fetchedAt are unchanged. */
  readonly source: "fresh" | "cache"
  readonly cachedAt: string
  /** How long the snapshot took to read. */
  readonly durationMs: number
}

export type MarketResponse =
  | { readonly ok: true; readonly data: MarketDto; readonly served: MarketServed }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

/**
 * Boost mathematics, mirrored from BoostVoter._getBoost (contracts/BoostVoter.sol, lines 182-229 of
 * the verified implementation; identical on testnet and mainnet):
 *
 *   uint256 votingVeWeight      = weights[gauge];                          // Wg
 *   uint256 votingVeTotalWeight = IVotingEscrow(ve).totalVotingPower();    // Tm (veMEZO)
 *   uint256 votingVeRatio = 0;
 *   if (votingVeTotalWeight > 0)
 *       votingVeRatio = (votingVeWeight * PRECISION) / votingVeTotalWeight;
 *   uint256 boostableVeTotalWeight = IVotingEscrow(boostableVe).unboostedTotalVotingPower(); // Tb
 *   uint256 boostableVeWeight = IVotingEscrow(boostableVe).unboostedVotingPowerOfNFT(id);  // p
 *   uint256 boostableVeRatio = 0;
 *   if (boostableVeWeight > 0)
 *       boostableVeRatio = (boostableVeTotalWeight * PRECISION) / boostableVeWeight;
 *   uint256 boostFraction = (4 * boostableVeRatio * votingVeRatio) / PRECISION;
 *   return Math.min(5 * PRECISION, PRECISION + boostFraction);
 *
 * Units: every voting-power value is an 18-decimal token amount; ratios and boosts use
 * PRECISION = 1e18 (so 1x = 1e18, 5x = 5e18). Division truncates (Solidity floor for uint).
 * Checked arithmetic reverts on uint256 overflow; those cases throw BoostMathOverflowError here.
 */

export const PRECISION = 10n ** 18n
export const MIN_BOOST = PRECISION
export const MAX_BOOST = 5n * PRECISION
const MAX_UINT256 = (1n << 256n) - 1n

export class BoostMathOverflowError extends Error {
  constructor(operation: string) {
    super(`uint256 overflow in ${operation}; the deployed contract would revert`)
    this.name = "BoostMathOverflowError"
  }
}

function assertUint256(name: string, value: bigint): void {
  if (typeof value !== "bigint") throw new TypeError(`${name} must be a bigint`)
  if (value < 0n || value > MAX_UINT256) throw new RangeError(`${name} must be a uint256, got ${value}`)
}

function mul(a: bigint, b: bigint, operation: string): bigint {
  const r = a * b
  if (r > MAX_UINT256) throw new BoostMathOverflowError(operation)
  return r
}

function add(a: bigint, b: bigint, operation: string): bigint {
  const r = a + b
  if (r > MAX_UINT256) throw new BoostMathOverflowError(operation)
  return r
}

function ceilDiv(a: bigint, b: bigint): bigint {
  return a === 0n ? 0n : (a - 1n) / b + 1n
}

/** Inputs to the boost of one veBTC position. All uint256, 18 decimals. */
export interface BoostInputs {
  /** BoostVoter.weights(gauge): veMEZO weight on the position's boost gauge (0 if no gauge). */
  readonly gaugeWeight: bigint
  /** veMEZO.totalVotingPower(). */
  readonly totalVeMezoVotingPower: bigint
  /** veBTC.unboostedTotalVotingPower(). */
  readonly totalUnboostedVeBtcVotingPower: bigint
  /** veBTC.unboostedVotingPowerOfNFT(tokenId). */
  readonly positionUnboostedVotingPower: bigint
}

/** The per-position context that does not depend on the gauge weight. */
export type BoostContext = Omit<BoostInputs, "gaugeWeight">

function validateContext(ctx: BoostContext): void {
  assertUint256("totalVeMezoVotingPower", ctx.totalVeMezoVotingPower)
  assertUint256("totalUnboostedVeBtcVotingPower", ctx.totalUnboostedVeBtcVotingPower)
  assertUint256("positionUnboostedVotingPower", ctx.positionUnboostedVotingPower)
}

/** votingVeRatio exactly as in the contract (0 when the denominator is 0). */
export function votingVeRatio(gaugeWeight: bigint, totalVeMezoVotingPower: bigint): bigint {
  if (totalVeMezoVotingPower === 0n) return 0n
  return mul(gaugeWeight, PRECISION, "votingVeWeight * PRECISION") / totalVeMezoVotingPower
}

/** boostableVeRatio exactly as in the contract (0 when the position has no power). */
export function boostableVeRatio(totalUnboosted: bigint, positionUnboosted: bigint): bigint {
  if (positionUnboosted === 0n) return 0n
  return mul(totalUnboosted, PRECISION, "boostableVeTotalWeight * PRECISION") / positionUnboosted
}

/** The boost BoostVoter.getBoost() returns for these inputs, in 1e18 precision, within [1e18, 5e18]. */
export function computeBoost(inputs: BoostInputs): bigint {
  assertUint256("gaugeWeight", inputs.gaugeWeight)
  validateContext(inputs)
  const vR = votingVeRatio(inputs.gaugeWeight, inputs.totalVeMezoVotingPower)
  const bR = boostableVeRatio(inputs.totalUnboostedVeBtcVotingPower, inputs.positionUnboostedVotingPower)
  // Solidity evaluates `4 * boostableVeRatio * votingVeRatio` left to right with checked math.
  const product = mul(mul(4n, bR, "4 * boostableVeRatio"), vR, "4 * boostableVeRatio * votingVeRatio")
  const boostFraction = product / PRECISION
  const uncapped = add(PRECISION, boostFraction, "PRECISION + boostFraction")
  return uncapped < MAX_BOOST ? uncapped : MAX_BOOST
}

export type UnreachableReason =
  /** Target above the 5x cap. */
  | "above-cap"
  /** veBTC position has zero unboosted power (expired or empty); boost is fixed at 1x. */
  | "no-position-power"
  /** veMEZO total voting power is zero; votingVeRatio is fixed at 0. */
  | "no-vemezo-power"
  /** Total unboosted veBTC power is so small relative to the position that boostableVeRatio floors to 0. */
  | "zero-boostable-ratio"

export type WeightRequirement =
  | {
      readonly reachable: true
      /** Minimum BoostVoter.weights(gauge) such that computeBoost(...) >= target. */
      readonly requiredWeight: bigint
      /** requiredWeight exceeds all veMEZO voting power in existence, so it cannot be met in practice. */
      readonly exceedsTotalVotingPower: boolean
    }
  | { readonly reachable: false; readonly reason: UnreachableReason }

/**
 * Smallest gauge weight W with computeBoost({gaugeWeight: W, ...ctx}) >= target.
 *
 * Derivation under the contract's flooring (bR fixed for the position):
 *   floor(4*bR*vR / P) >= target - P   <=>  4*bR*vR >= (target - P) * P      (target - P is an integer)
 *                                       <=>  vR >= ceil((target - P) * P / (4*bR))
 *   floor(W*P / Tm) >= vRneed           <=>  W >= ceil(vRneed * Tm / P)
 * Both steps are exact, so W is minimal: W - 1 gives a strictly smaller boost than target.
 */
export function requiredWeightForBoost(target: bigint, ctx: BoostContext): WeightRequirement {
  assertUint256("target", target)
  validateContext(ctx)
  if (target <= MIN_BOOST) return { reachable: true, requiredWeight: 0n, exceedsTotalVotingPower: false }
  if (target > MAX_BOOST) return { reachable: false, reason: "above-cap" }
  if (ctx.positionUnboostedVotingPower === 0n) return { reachable: false, reason: "no-position-power" }
  if (ctx.totalVeMezoVotingPower === 0n) return { reachable: false, reason: "no-vemezo-power" }
  const bR = boostableVeRatio(ctx.totalUnboostedVeBtcVotingPower, ctx.positionUnboostedVotingPower)
  if (bR === 0n) return { reachable: false, reason: "zero-boostable-ratio" }
  const vRneed = ceilDiv((target - PRECISION) * PRECISION, 4n * bR)
  const requiredWeight = ceilDiv(vRneed * ctx.totalVeMezoVotingPower, PRECISION)
  return {
    reachable: true,
    requiredWeight,
    exceedsTotalVotingPower: requiredWeight > ctx.totalVeMezoVotingPower,
  }
}

/** Stored LockedBalance.boost uses 0 to mean "never set" = 1x (BoostLibrary.boostedAmount). */
export function normalizeStoredBoost(storedBoostRaw: bigint): bigint {
  assertUint256("storedBoostRaw", storedBoostRaw)
  return storedBoostRaw === 0n ? PRECISION : storedBoostRaw
}

export const BOOST_TARGETS = {
  "2x": 2n * PRECISION,
  "3x": 3n * PRECISION,
  "5x": 5n * PRECISION,
} as const

export type BoostTargetLabel = keyof typeof BOOST_TARGETS

export type TargetStatus =
  | {
      readonly reachable: true
      readonly requiredWeight: bigint
      /** max(0, requiredWeight - current gauge weight). */
      readonly additionalWeight: bigint
      readonly alreadyMet: boolean
      readonly exceedsTotalVotingPower: boolean
    }
  | { readonly reachable: false; readonly reason: UnreachableReason }

export interface BoostAnalysis {
  /** computeBoost() at the snapshot inputs (what getBoost() returns). */
  readonly liveBoost: bigint
  /** Boost currently applied to the veBTC (normalized; 1x when never set). */
  readonly storedBoost: bigint
  /** liveBoost - storedBoost. Non-zero means a permissionless pokeBoost would change the applied boost. */
  readonly boostDrift: bigint
  readonly atCap: boolean
  /** True when more votes could raise the boost (below cap and the position can be boosted at all). */
  readonly canIncreaseWithMoreVotes: boolean
  readonly targets: { readonly [K in BoostTargetLabel]: TargetStatus }
  /**
   * Gauge weight that adds no boost: max(0, weight - requiredWeight(5x)).
   * If the position cannot be boosted at all (no power), the entire weight is excess.
   */
  readonly excessWeight: bigint
}

export function analyzeBoost(inputs: BoostInputs, storedBoostRaw: bigint): BoostAnalysis {
  const liveBoost = computeBoost(inputs)
  const storedBoost = normalizeStoredBoost(storedBoostRaw)
  const targets = {} as { [K in BoostTargetLabel]: TargetStatus }
  for (const label of Object.keys(BOOST_TARGETS) as BoostTargetLabel[]) {
    const req = requiredWeightForBoost(BOOST_TARGETS[label], inputs)
    targets[label] = req.reachable
      ? {
          reachable: true,
          requiredWeight: req.requiredWeight,
          additionalWeight: req.requiredWeight > inputs.gaugeWeight ? req.requiredWeight - inputs.gaugeWeight : 0n,
          alreadyMet: inputs.gaugeWeight >= req.requiredWeight,
          exceedsTotalVotingPower: req.exceedsTotalVotingPower,
        }
      : { reachable: false, reason: req.reason }
  }
  const max = targets["5x"]
  let excessWeight: bigint
  if (max.reachable) {
    excessWeight = inputs.gaugeWeight > max.requiredWeight ? inputs.gaugeWeight - max.requiredWeight : 0n
  } else if (max.reason === "no-position-power" || max.reason === "zero-boostable-ratio") {
    excessWeight = inputs.gaugeWeight
  } else {
    excessWeight = 0n
  }
  return {
    liveBoost,
    storedBoost,
    boostDrift: liveBoost - storedBoost,
    atCap: liveBoost === MAX_BOOST,
    canIncreaseWithMoreVotes: liveBoost < MAX_BOOST && max.reachable,
    targets,
    excessWeight,
  }
}

/**
 * - "active": gauge alive, lock present and not expired, unboosted power > 0.
 * - "gauge-killed": BoostVoter.isAlive(gauge) == false; it cannot receive votes.
 * - "no-lock": LockedBalance.amount <= 0.
 * - "expired": non-permanent lock with end <= block timestamp (pokeBoost reverts LockExpired).
 * - "no-power": lock not expired but unboosted power reads 0 (e.g. ownership changed in this block).
 */
export type PositionStatus = "active" | "gauge-killed" | "no-lock" | "expired" | "no-power"

export function classifyPosition(p: {
  readonly gaugeAlive: boolean
  readonly lockAmount: bigint
  readonly lockEnd: bigint
  readonly isPermanent: boolean
  readonly unboostedVotingPower: bigint
  readonly timestamp: bigint
}): PositionStatus {
  if (!p.gaugeAlive) return "gauge-killed"
  if (p.lockAmount <= 0n) return "no-lock"
  if (!p.isPermanent && p.lockEnd <= p.timestamp) return "expired"
  if (p.unboostedVotingPower === 0n) return "no-power"
  return "active"
}

export interface Ratio {
  readonly numerator: bigint
  readonly denominator: bigint
}

export interface MarketSummary {
  /** Positions with a live gauge and unboosted power > 0. */
  readonly livePositions: number
  readonly atCap: number
  /** Live positions with weight > 0 but below the cap. */
  readonly partiallyBoosted: number
  /** Live positions with zero weight. */
  readonly unboosted: number
  readonly weightOnLivePositions: bigint
  /** Sum of requiredWeight(5x) over live positions where 5x is reachable. */
  readonly weightNeededToMaxAll: bigint
  /** Sum of excessWeight over live positions. */
  readonly excessWeightOnLive: bigint
  /** excessWeightOnLive / weightOnLivePositions. */
  readonly excessShareOfLive: Ratio
  /** Live gauges whose veBTC has zero unboosted power. */
  readonly zeroPowerLiveGauges: number
  readonly weightOnZeroPowerLiveGauges: bigint
  /** (excess on live + weight on zero-power live gauges) / (both weights). */
  readonly excessShareIncludingZeroPower: Ratio
  /** Number of positions the summary was computed from (see MarketSnapshot.meta.completeness). */
  readonly positionsConsidered: number
}

export function summarizeMarket(
  positions: readonly {
    readonly gaugeAlive: boolean
    readonly unboostedVotingPower: bigint
    readonly gaugeWeight: bigint
    readonly analysis: BoostAnalysis
  }[],
): MarketSummary {
  let livePositions = 0
  let atCap = 0
  let partiallyBoosted = 0
  let unboosted = 0
  let weightOnLive = 0n
  let needed = 0n
  let excess = 0n
  let zeroPower = 0
  let zeroPowerWeight = 0n
  for (const p of positions) {
    if (!p.gaugeAlive) continue
    if (p.unboostedVotingPower === 0n) {
      zeroPower++
      zeroPowerWeight += p.gaugeWeight
      continue
    }
    livePositions++
    weightOnLive += p.gaugeWeight
    excess += p.analysis.excessWeight
    const max = p.analysis.targets["5x"]
    if (max.reachable) needed += max.requiredWeight
    if (p.analysis.atCap) atCap++
    else if (p.gaugeWeight === 0n) unboosted++
    else partiallyBoosted++
  }
  return {
    livePositions,
    atCap,
    partiallyBoosted,
    unboosted,
    weightOnLivePositions: weightOnLive,
    weightNeededToMaxAll: needed,
    excessWeightOnLive: excess,
    excessShareOfLive: { numerator: excess, denominator: weightOnLive },
    zeroPowerLiveGauges: zeroPower,
    weightOnZeroPowerLiveGauges: zeroPowerWeight,
    excessShareIncludingZeroPower: {
      numerator: excess + zeroPowerWeight,
      denominator: weightOnLive + zeroPowerWeight,
    },
    positionsConsidered: positions.length,
  }
}

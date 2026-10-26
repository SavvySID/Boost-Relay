import type { RecommendationDto } from "./optimizer-dto"

const FIVE_X = 5n * 10n ** 18n

export interface OutcomeComparison {
  /** Sum of unboosted power x live boost over every position the vote touches, before and after. */
  readonly boostedBefore: bigint
  readonly boostedAfter: bigint
  readonly boostedChange: bigint
  /** boostedChange as basis points of boostedBefore; null when there was nothing before. */
  readonly boostedChangeBps: number | null
  /** Positions this vote touches (new gauges and gauges whose prior votes are removed). */
  readonly affected: number
  readonly affectedAtCapBefore: number
  readonly affectedAtCapAfter: number
  /** Active positions at 5x across the whole market, before and after (null without market data). */
  readonly marketAtCapBefore: number | null
  readonly marketAtCapAfter: number | null
  readonly votingPower: bigint
  readonly votesUsed: bigint
  /** Power vote() leaves unallocated because of integer rounding. */
  readonly unused: bigint
  /** Each gauge's share of the NFT's voting power, in basis points. */
  readonly sharesBps: ReadonlyMap<string, number>
}

const bps = (part: bigint, whole: bigint): number => (whole === 0n ? 0 : Number((part * 10_000n) / whole))

/**
 * Before / after numbers for one recommendation, all derived from the optimizer's own projection at
 * the source block. They are projections, not confirmed outcomes: other votes and decaying power move them.
 */
export function compareOutcome(rec: RecommendationDto, marketAtCap: number | null): OutcomeComparison | null {
  const s = rec.summary
  if (s === null) return null
  const touched = new Map<string, { before: bigint; after: bigint }>()
  for (const l of rec.lines) touched.set(l.gauge.toLowerCase(), { before: BigInt(l.currentBoost), after: BigInt(l.projectedBoost) })
  for (const r of rec.removed) {
    if (r.currentBoost === null || r.projectedBoost === null || touched.has(r.gauge.toLowerCase())) continue
    touched.set(r.gauge.toLowerCase(), { before: BigInt(r.currentBoost), after: BigInt(r.projectedBoost) })
  }
  let atCapBefore = 0
  let atCapAfter = 0
  for (const t of touched.values()) {
    if (t.before >= FIVE_X) atCapBefore++
    if (t.after >= FIVE_X) atCapAfter++
  }
  const before = BigInt(s.boostedPowerBefore)
  const after = BigInt(s.boostedPowerAfter)
  const power = BigInt(s.votingPower)
  const sharesBps = new Map<string, number>()
  for (const l of rec.lines) sharesBps.set(l.gauge.toLowerCase(), bps(BigInt(l.predictedVotes), power))
  return {
    boostedBefore: before,
    boostedAfter: after,
    boostedChange: after - before,
    boostedChangeBps: before === 0n ? null : bps(after - before, before),
    affected: touched.size,
    affectedAtCapBefore: atCapBefore,
    affectedAtCapAfter: atCapAfter,
    marketAtCapBefore: marketAtCap,
    marketAtCapAfter: marketAtCap === null ? null : marketAtCap - atCapBefore + atCapAfter,
    votingPower: power,
    votesUsed: BigInt(s.predictedVotesUsed),
    unused: BigInt(s.roundingRemainder),
    sharesBps,
  }
}

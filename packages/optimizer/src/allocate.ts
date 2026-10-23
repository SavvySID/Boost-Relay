import { MAX_BOOST, PRECISION, computeBoost, requiredWeightForBoost, type BoostPosition, type MarketSnapshot } from "@boost-relay/mezo"
import type { Address, Candidate, OptimizerToken, RemovedVoteLine } from "./types.js"

const key = (a: string): string => a.toLowerCase()

/**
 * Mirrors NonStakingVoter._vote's split of an NFT's voting power (verified source, lines 280-325):
 *
 *   _totalVoteWeight += _weights[i]                                   (sum of the caller's weights)
 *   _gaugeWeight = (_weights[i] * _weight) / _totalVoteWeight         (_weight = votingPowerOfNFT)
 *   if (_gaugeWeight == 0) revert ZeroBalance()
 *
 * Weights are relative: only their ratios matter, and integer division floors each share, so
 * sum(votes) <= power. Passing weights that already sum to `power` makes every share exact.
 */
export function splitVotes(weights: readonly bigint[], power: bigint): { readonly votes: bigint[]; readonly used: bigint; readonly zeroShares: number[] } {
  if (power < 0n) throw new RangeError("power must be non-negative")
  if (weights.some((w) => w < 0n)) throw new RangeError("weights must be non-negative")
  const total = weights.reduce((s, w) => s + w, 0n)
  if (total === 0n) throw new RangeError("weights must not all be zero")
  const votes = weights.map((w) => (w * power) / total)
  const zeroShares = votes.flatMap((v, i) => (v === 0n ? [i] : []))
  return { votes, used: votes.reduce((s, v) => s + v, 0n), zeroShares }
}

export interface CandidateSet {
  readonly candidates: readonly Candidate[]
  /** Active positions already at 5x even without this NFT's votes. */
  readonly alreadyCapped: number
  /** Positions skipped because they are not active (expired, no power, killed gauge, no lock). */
  readonly inactive: number
  /** Active positions whose 5x requirement is unreachable or exceeds all veMEZO. */
  readonly unreachable: number
}

/**
 * Eligible targets: active positions (gauge alive, lock live, power > 0) still below 5x once this
 * NFT's prior votes are removed. Headroom is measured from that base weight.
 */
export function buildCandidates(snapshot: MarketSnapshot, token: OptimizerToken): CandidateSet {
  const prior = priorVotesByGauge(token)
  const candidates: Candidate[] = []
  let alreadyCapped = 0
  let inactive = 0
  let unreachable = 0
  const seen = new Set<string>()
  for (const p of snapshot.positions) {
    if (seen.has(key(p.gauge))) continue // the reader already rejects duplicates; never vote a gauge twice
    seen.add(key(p.gauge))
    if (p.status !== "active" || !p.gaugeAlive) {
      inactive++
      continue
    }
    const nftPriorVotes = prior.get(key(p.gauge)) ?? 0n
    const baseWeight = p.gaugeWeight - nftPriorVotes
    if (baseWeight < 0n) throw new Error(`gauge ${p.gauge} weight is below this NFT's own votes; inconsistent reads`)
    const req = requiredWeightForBoost(MAX_BOOST, {
      totalVeMezoVotingPower: snapshot.global.totalVeMezoVotingPower,
      totalUnboostedVeBtcVotingPower: snapshot.global.totalUnboostedVeBtcVotingPower,
      positionUnboostedVotingPower: p.unboostedVotingPower,
    })
    if (!req.reachable || req.exceedsTotalVotingPower) {
      unreachable++
      continue
    }
    const headroom = req.requiredWeight > baseWeight ? req.requiredWeight - baseWeight : 0n
    if (headroom === 0n) {
      alreadyCapped++
      continue
    }
    candidates.push({
      tokenId: p.tokenId,
      gauge: p.gauge as Address,
      unboostedVotingPower: p.unboostedVotingPower,
      currentWeight: p.gaugeWeight,
      nftPriorVotes,
      baseWeight,
      required5x: req.requiredWeight,
      headroom,
      currentBoost: p.analysis.liveBoost,
      lockEnd: p.lock.end,
      isPermanent: p.lock.isPermanent,
    })
  }
  return { candidates, alreadyCapped, inactive, unreachable }
}

export function priorVotesByGauge(token: OptimizerToken): Map<string, bigint> {
  const m = new Map<string, bigint>()
  for (const e of token.allocation.entries) m.set(key(e.gauge), (m.get(key(e.gauge)) ?? 0n) + e.votes)
  return m
}

export function boostAt(snapshot: MarketSnapshot, unboostedPower: bigint, gaugeWeight: bigint): bigint {
  return computeBoost({
    gaugeWeight,
    totalVeMezoVotingPower: snapshot.global.totalVeMezoVotingPower,
    totalUnboostedVeBtcVotingPower: snapshot.global.totalUnboostedVeBtcVotingPower,
    positionUnboostedVotingPower: unboostedPower,
  })
}

/** Unboosted power x boost (1e18 precision) / 1e18: the position's boosted veBTC voting power. */
export function boostedPower(unboostedPower: bigint, boost: bigint): bigint {
  return (unboostedPower * boost) / PRECISION
}

export interface Projection {
  /** Post-vote weight per affected gauge (lower-cased key). */
  readonly weights: ReadonlyMap<string, bigint>
  readonly removed: readonly RemovedVoteLine[]
  readonly boostedPowerBefore: bigint
  readonly boostedPowerAfter: bigint
}

/**
 * Applies vote()'s state change: every prior vote of this NFT is withdrawn (_reset), then each
 * selected gauge gains its predicted votes. Totals (veMEZO and veBTC power) do not change on a vote.
 */
export function projectVote(
  snapshot: MarketSnapshot,
  token: OptimizerToken,
  selected: readonly { readonly gauge: Address; readonly predictedVotes: bigint }[],
): Projection {
  const prior = priorVotesByGauge(token)
  const positionsByGauge = new Map<string, BoostPosition>(snapshot.positions.map((p) => [key(p.gauge), p]))
  const weights = new Map<string, bigint>()
  for (const [g, votes] of prior) {
    const p = positionsByGauge.get(g)
    if (p !== undefined) weights.set(g, p.gaugeWeight - votes)
  }
  for (const s of selected) {
    const p = positionsByGauge.get(key(s.gauge))
    if (p === undefined) throw new Error(`selected gauge ${s.gauge} is not in the snapshot`)
    const base = p.gaugeWeight - (prior.get(key(s.gauge)) ?? 0n)
    weights.set(key(s.gauge), base + s.predictedVotes)
  }
  let before = 0n
  let after = 0n
  for (const [g, w] of weights) {
    const p = positionsByGauge.get(g) as BoostPosition
    if (!p.gaugeAlive || p.unboostedVotingPower === 0n) continue
    before += boostedPower(p.unboostedVotingPower, p.analysis.liveBoost)
    after += boostedPower(p.unboostedVotingPower, boostAt(snapshot, p.unboostedVotingPower, w))
  }
  const selectedKeys = new Set(selected.map((s) => key(s.gauge)))
  const removed: RemovedVoteLine[] = []
  for (const e of token.allocation.entries) {
    if (selectedKeys.has(key(e.gauge))) continue
    const p = positionsByGauge.get(key(e.gauge))
    const projected = weights.get(key(e.gauge))
    removed.push({
      gauge: e.gauge,
      tokenId: p?.tokenId ?? null,
      priorVotes: e.votes,
      currentBoost: p ? p.analysis.liveBoost : null,
      projectedBoost: p && projected !== undefined ? boostAt(snapshot, p.unboostedVotingPower, projected) : null,
    })
  }
  return { weights, removed, boostedPowerBefore: before, boostedPowerAfter: after }
}

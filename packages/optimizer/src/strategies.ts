import { MAX_BOOST, epochNext, formatBoost, formatTokenAmount } from "@boost-relay/mezo"
import { boostAt, buildCandidates, projectVote, splitVotes } from "./allocate.js"
import { checkAllocation, checkPreconditions } from "./validate.js"
import type { AllocationLine, Candidate, Issue, OptimizerInput, Reason, Recommendation, StrategyId } from "./types.js"

export const DEFAULT_MIN_ALLOCATION = 10n ** 12n // 0.000001 veMEZO

export const STRATEGIES: Readonly<Record<StrategyId, { readonly label: string; readonly objective: string; readonly guarantee: string }>> = {
  "max-boosted-power": {
    label: "Maximize boost improvement",
    objective: "Largest increase in boosted veBTC voting power (unboosted power x live boost) across affected positions.",
    guarantee:
      "Optimal for this objective under the gauge limit, up to integer rounding: every veMEZO placed below a position's 5x requirement adds the same 4 x Tb / Tm of boosted power, so the best plan is the one with the least weight past a cap, found by filling the largest gaps first.",
  },
  "max-capped-positions": {
    label: "Maximize positions at 5x",
    objective: "Largest number of below-cap positions that reach the 5x cap.",
    guarantee:
      "Optimal for the count: filling the smallest gaps first maximizes how many positions fit in the NFT's power and the gauge limit. Leftover power then goes to the next-cheapest positions, which is a fixed rule rather than an optimum.",
  },
}

interface PlanEntry {
  readonly candidate: Candidate
  weight: bigint
  leftover: bigint
}

const cmp = (a: bigint, b: bigint): number => (a < b ? -1 : a > b ? 1 : 0)
const amount = (v: bigint): string => formatTokenAmount(v, 18, 2)

function allocate(entry: Candidate, remaining: bigint, min: bigint): bigint {
  let w = entry.headroom < remaining ? entry.headroom : remaining
  if (w < min) w = min < remaining ? min : remaining
  return w
}

/**
 * vote() always splits the NFT's full power. Remainder first fills unfilled headroom on already
 * selected gauges (no excess), then whatever is left lands on the first gauge past its cap.
 */
function placeRemainder(plan: PlanEntry[], remaining: bigint): void {
  for (const e of plan) {
    if (remaining === 0n) return
    const room = e.candidate.headroom > e.weight ? e.candidate.headroom - e.weight : 0n
    const add = room < remaining ? room : remaining
    e.weight += add
    remaining -= add
  }
  const first = plan[0]
  if (remaining > 0n && first !== undefined) {
    first.weight += remaining
    first.leftover += remaining
  }
}

/** Largest headroom first (ties: lower veBTC id), until the NFT's power or the gauge limit is used. */
export function planMaxBoostedPower(candidates: readonly Candidate[], power: bigint, maxGauges: number, min: bigint): PlanEntry[] {
  const sorted = [...candidates].sort((a, b) => cmp(b.headroom, a.headroom) || cmp(a.tokenId, b.tokenId))
  const plan: PlanEntry[] = []
  let remaining = power
  for (const c of sorted) {
    if (plan.length >= maxGauges || remaining === 0n || (remaining < min && plan.length > 0)) break
    const w = allocate(c, remaining, min)
    plan.push({ candidate: c, weight: w, leftover: 0n })
    remaining -= w
  }
  placeRemainder(plan, remaining)
  return plan
}

/** Smallest headroom first (ties: lower veBTC id) for full fills, then partial fills in the same order. */
export function planMaxCappedPositions(candidates: readonly Candidate[], power: bigint, maxGauges: number, min: bigint): PlanEntry[] {
  const sorted = [...candidates].sort((a, b) => cmp(a.headroom, b.headroom) || cmp(a.tokenId, b.tokenId))
  const plan: PlanEntry[] = []
  let remaining = power
  let i = 0
  for (; i < sorted.length && plan.length < maxGauges; i++) {
    const c = sorted[i] as Candidate
    const need = c.headroom > min ? c.headroom : min
    if (need > remaining) break
    plan.push({ candidate: c, weight: need, leftover: 0n })
    remaining -= need
  }
  for (; i < sorted.length && plan.length < maxGauges && remaining > 0n; i++) {
    if (remaining < min && plan.length > 0) break
    const c = sorted[i] as Candidate
    const w = allocate(c, remaining, min)
    plan.push({ candidate: c, weight: w, leftover: 0n })
    remaining -= w
  }
  placeRemainder(plan, remaining)
  return plan
}

function blocked(input: OptimizerInput, blockers: readonly Issue[], warnings: readonly Issue[] = []): Recommendation {
  return {
    strategy: input.strategy,
    status: "blocked",
    tokenId: input.token.tokenId,
    sourceBlock: input.snapshot.meta.blockNumber,
    lines: [],
    removed: [],
    summary: null,
    blockers,
    warnings,
    checks: [],
    voteCall: null,
  }
}

/** Computes, explains and validates one strategy's recommendation. Pure: reads nothing, sends nothing. */
export function recommend(input: OptimizerInput): Recommendation {
  const { snapshot, token, strategy } = input
  const pre = checkPreconditions(input)
  if (pre.blockers.length > 0) return blocked(input, pre.blockers)

  const set = buildCandidates(snapshot, token)
  if (set.candidates.length === 0) {
    return blocked(input, [
      {
        code: "no-candidates",
        text: `No active position is below 5x once this NFT's existing votes are set aside (${set.alreadyCapped} already at 5x, ${set.inactive} inactive, ${set.unreachable} cannot reach 5x). Any vote would only add weight past the cap.`,
      },
    ])
  }

  const maxGauges = Number(snapshot.global.maxVotingNum)
  const power = token.votingPower
  const min = input.minAllocation ?? DEFAULT_MIN_ALLOCATION
  const plan = strategy === "max-boosted-power" ? planMaxBoostedPower(set.candidates, power, maxGauges, min) : planMaxCappedPositions(set.candidates, power, maxGauges, min)

  const split = splitVotes(
    plan.map((p) => p.weight),
    power,
  )
  const projection = projectVote(
    snapshot,
    token,
    plan.map((p, i) => ({ gauge: p.candidate.gauge, predictedVotes: split.votes[i] as bigint })),
  )
  const order = [...set.candidates].sort((a, b) =>
    strategy === "max-boosted-power" ? cmp(b.headroom, a.headroom) || cmp(a.tokenId, b.tokenId) : cmp(a.headroom, b.headroom) || cmp(a.tokenId, b.tokenId),
  )
  const rankOf = new Map(order.map((c, i) => [c.gauge.toLowerCase(), i + 1]))

  const lines: AllocationLine[] = plan.map((p, i) => {
    const c = p.candidate
    const votes = split.votes[i] as bigint
    const projectedWeight = projection.weights.get(c.gauge.toLowerCase()) as bigint
    const projectedBoost = boostAt(snapshot, c.unboostedVotingPower, projectedWeight)
    const excess = votes > c.headroom ? votes - c.headroom : 0n
    const rank = rankOf.get(c.gauge.toLowerCase()) ?? 0
    const reasons: Reason[] = []
    if (c.nftPriorVotes > 0n) {
      reasons.push({ code: "replaces-prior-vote", text: `This NFT already has ${amount(c.nftPriorVotes)} veMEZO here. vote() resets it first, then applies the new amount.` })
    }
    reasons.push({ code: "below-cap", text: `At ${formatBoost(c.currentBoost)} now; ${amount(votes)} veMEZO from this NFT moves it to ${formatBoost(projectedBoost)}.` })
    if (strategy === "max-boosted-power") {
      reasons.push({
        code: "largest-headroom",
        text: `Rank ${rank} of ${set.candidates.length} below-cap positions by room left to 5x (${amount(c.headroom)} veMEZO). Filling the largest gaps first uses the fewest gauges and avoids weight past the cap.`,
      })
    } else {
      reasons.push({
        code: "smallest-headroom",
        text: `Needs ${amount(c.headroom)} veMEZO to reach 5x: rank ${rank} of ${set.candidates.length} by smallest need. Cheapest first gets the most positions to 5x.`,
      })
    }
    if (projectedBoost === MAX_BOOST && c.currentBoost < MAX_BOOST) {
      reasons.push({
        code: "reaches-5x",
        text: excess === 0n ? "Reaches the 5x cap with the exact minimum weight under the contract's rounding." : `Reaches 5x; ${amount(excess)} veMEZO lands past the cap.`,
      })
    } else if (votes < c.headroom) {
      reasons.push({ code: "partial-fill", text: `Receives the NFT's remaining ${amount(votes)} veMEZO; still ${amount(c.headroom - votes)} short of 5x.` })
    }
    if (p.leftover > 0n) {
      reasons.push({
        code: "leftover-excess",
        text: `vote() always splits the NFT's full power. ${amount(p.leftover)} veMEZO had no below-cap position left within the ${maxGauges}-gauge limit, so it lands here past the cap and adds no boost.`,
      })
    }
    return {
      rank: i + 1,
      tokenId: c.tokenId,
      gauge: c.gauge,
      currentGaugeWeight: c.currentWeight,
      nftPriorVotes: c.nftPriorVotes,
      baseGaugeWeight: c.baseWeight,
      headroomTo5x: c.headroom,
      recommendedWeight: p.weight,
      predictedVotes: votes,
      projectedGaugeWeight: projectedWeight,
      currentBoost: c.currentBoost,
      projectedBoost,
      excessAbove5x: excess,
      role: p.leftover > 0n ? "leftover" : votes >= c.headroom ? "fills-to-5x" : "partial",
      reasons,
    }
  })

  const excessTotal = lines.reduce((s, l) => s + l.excessAbove5x, 0n)
  const totalHeadroom = set.candidates.reduce((s, c) => s + c.headroom, 0n)
  const reaching = lines.filter((l) => l.currentBoost < MAX_BOOST && l.projectedBoost === MAX_BOOST).length
  const losing = projection.removed.filter((r) => r.currentBoost !== null && r.projectedBoost !== null && r.projectedBoost < r.currentBoost).length

  let objectiveNote: string
  if (strategy === "max-boosted-power") {
    objectiveNote =
      excessTotal === 0n
        ? `All ${amount(split.used)} veMEZO lands below a 5x cap: the largest boosted-power gain this NFT can make.`
        : set.candidates.length > maxGauges
          ? `The ${maxGauges} largest gaps hold less than this NFT's power, so ${amount(excessTotal)} veMEZO must land past a cap. No plan within ${maxGauges} gauges avoids that.`
          : `Every below-cap position together needs only ${amount(totalHeadroom)} veMEZO, so ${amount(excessTotal)} lands past a cap.`
  } else {
    const fullyFunded = lines.filter((l) => l.excessAbove5x === 0n && l.predictedVotes >= l.headroomTo5x).length
    const unfunded = set.candidates.length - fullyFunded
    objectiveNote =
      unfunded === 0
        ? `All ${set.candidates.length} below-cap positions reach 5x.`
        : lines.length >= maxGauges
          ? `${reaching} positions reach 5x; the ${maxGauges}-gauge limit stops more.`
          : `${reaching} positions reach 5x; the next cheapest needs more than the power left, so it gets a partial fill.`
  }

  const warnings: Issue[] = [...pre.informational]
  if (losing > 0) {
    warnings.push({ code: "removes-prior-votes", text: `This vote withdraws the NFT's existing votes from ${projection.removed.length} gauge(s) it no longer selects; ${losing} of those positions lose boost.` })
  }
  if (set.candidates.length > maxGauges) {
    warnings.push({ code: "gauge-limit", text: `${set.candidates.length} positions are below 5x, but one vote can cover at most ${maxGauges} gauges.` })
  }
  const next = epochNext(snapshot.meta.blockTimestamp)
  const expiring = lines.filter((l) => {
    const c = set.candidates.find((x) => x.gauge === l.gauge)
    return c !== undefined && !c.isPermanent && c.lockEnd < next
  })
  if (expiring.length > 0) {
    warnings.push({ code: "expiring-locks", text: `${expiring.map((l) => `veBTC #${l.tokenId}`).join(", ")} lock(s) end before this epoch does, so their boost is short-lived.` })
  }
  if (token.votedAnywhere && token.allocation.usedWeight === 0n) {
    warnings.push({ code: "third-party-votes", text: "This NFT has votes in Mezo's third-party gauge voter. Those are separate from boost votes and this vote does not change them." })
  }
  warnings.push({
    code: "execution-drift",
    text: "Figures are for the source block. veMEZO power decays every second and other voters can move gauge weights, so a vote should be recalculated just before it is signed.",
  })
  warnings.push({ code: "poke", text: "A vote changes live boosts immediately; the boost applied to each veBTC updates when someone calls the permissionless pokeBoost." })

  const checks = checkAllocation(input, lines)
  const passed = checks.every((c) => c.ok)
  const status = !passed ? "blocked" : pre.informational.length > 0 ? "informational" : "actionable"
  const blockers: Issue[] = passed ? [] : [{ code: "post-check-failed", text: `Failed checks: ${checks.filter((c) => !c.ok).map((c) => c.name).join("; ")}.` }]

  return {
    strategy,
    status,
    tokenId: token.tokenId,
    sourceBlock: snapshot.meta.blockNumber,
    lines,
    removed: projection.removed,
    summary: {
      votingPower: power,
      totalRecommendedWeight: plan.reduce((s, p) => s + p.weight, 0n),
      predictedVotesUsed: split.used,
      roundingRemainder: power - split.used,
      gaugesUsed: lines.length,
      maxGauges,
      candidateCount: set.candidates.length,
      positionsReaching5x: reaching,
      positionsImproved: lines.filter((l) => l.projectedBoost > l.currentBoost).length,
      positionsLosingBoost: losing,
      excessAbove5x: excessTotal,
      boostedPowerBefore: projection.boostedPowerBefore,
      boostedPowerAfter: projection.boostedPowerAfter,
      boostedPowerChange: projection.boostedPowerAfter - projection.boostedPowerBefore,
      totalCandidateHeadroom: totalHeadroom,
      objectiveNote,
    },
    blockers,
    warnings,
    checks,
    voteCall: passed
      ? {
          network: input.context.network,
          chainId: input.context.chainId,
          to: input.context.boostVoter,
          functionName: "vote",
          signature: "vote(uint256,address[],uint256[])",
          tokenId: token.tokenId,
          gauges: lines.map((l) => l.gauge),
          weights: lines.map((l) => l.recommendedWeight),
          sourceBlock: snapshot.meta.blockNumber,
          weightSemantics:
            "Relative weights. At signing, BoostVoter gives each gauge floor(weight x votingPowerOfNFT / sum(weights)) and first removes this NFT's previous votes. They sum to the NFT's power at the source block, so each share equals its weight there.",
          executable: status === "actionable",
        }
      : null,
  }
}

/** Both strategies for one NFT and snapshot. */
export function recommendAll(input: Omit<OptimizerInput, "strategy">): Record<StrategyId, Recommendation> {
  return {
    "max-boosted-power": recommend({ ...input, strategy: "max-boosted-power" }),
    "max-capped-positions": recommend({ ...input, strategy: "max-capped-positions" }),
  }
}

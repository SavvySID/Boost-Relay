import { MAX_BOOST, canVoteAt, getEpochInfo } from "@boost-relay/mezo"
import { boostAt, splitVotes } from "./allocate.js"
import type { AllocationLine, CheckResult, Issue, OptimizerInput } from "./types.js"

export interface Preconditions {
  /** Problems that make any recommendation untrustworthy. */
  readonly blockers: readonly Issue[]
  /** Reasons the NFT cannot vote right now; the recommendation is shown for analysis only. */
  readonly informational: readonly Issue[]
}

const utc = (t: bigint): string => new Date(Number(t) * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC"

/** Everything that must hold before a recommendation can be trusted, mirroring vote()'s checks. */
export function checkPreconditions(input: OptimizerInput): Preconditions {
  const { snapshot, token } = input
  const blockers: Issue[] = []
  const informational: Issue[] = []
  if (snapshot.meta.completeness !== "complete") {
    blockers.push({ code: "snapshot-partial", text: `The market snapshot is partial (${snapshot.meta.failures.length} failed reads), so headroom on unread positions is unknown.` })
  }
  if (token.blockNumber !== snapshot.meta.blockNumber) {
    blockers.push({ code: "block-mismatch", text: `The NFT was read at block ${token.blockNumber} but the market at block ${snapshot.meta.blockNumber}.` })
  }
  if (/^0x0{40}$/i.test(token.owner)) blockers.push({ code: "no-owner", text: `veMEZO #${token.tokenId} does not exist on ${input.context.network}.` })
  if (token.votingPower <= 0n) blockers.push({ code: "no-power", text: `veMEZO #${token.tokenId} has no voting power at this block (lock expired or empty).` })
  if (!token.allocation.complete) {
    blockers.push({
      code: "allocation-unknown",
      text: `This NFT's existing votes could not be fully read (${token.allocation.issues.join("; ") || "unknown reason"}). vote() replaces them, so the outcome cannot be predicted.`,
    })
  }
  const epoch = getEpochInfo(snapshot.meta.blockTimestamp)
  if (!canVoteAt(snapshot.meta.blockTimestamp, token.lastVoted)) {
    if (token.lastVoted >= epoch.epochStart) {
      informational.push({
        code: "already-voted",
        text: `veMEZO #${token.tokenId} already voted this epoch (${utc(token.lastVoted)}). BoostVoter rejects another vote or reset until ${utc(epoch.epochNext)}.`,
      })
    } else if (epoch.phase === "distribution") {
      informational.push({ code: "window-not-open", text: `Voting opens at ${utc(epoch.voteStart)} (one hour after the epoch starts).` })
    } else {
      informational.push({ code: "window-closed", text: `The voting window closed at ${utc(epoch.voteEnd)}; only whitelisted NFTs can vote until the next epoch.` })
    }
  }
  return { blockers, informational }
}

/** Post-checks on a computed allocation: every property a vote() call depends on. */
export function checkAllocation(input: OptimizerInput, lines: readonly AllocationLine[]): CheckResult[] {
  const { snapshot, token } = input
  const checks: CheckResult[] = []
  const add = (name: string, ok: boolean, detail: string): void => {
    checks.push({ name, ok, detail })
  }
  const maxGauges = Number(snapshot.global.maxVotingNum)
  add("at least one gauge", lines.length > 0, `${lines.length} selected`)
  add("within the on-chain gauge limit", lines.length <= maxGauges, `${lines.length} of maxVotingNum ${maxGauges}`)
  const keys = lines.map((l) => l.gauge.toLowerCase())
  add("no duplicate gauges", new Set(keys).size === keys.length, "vote() reverts NonZeroVotes on duplicates")
  const byGauge = new Map(snapshot.positions.map((p) => [p.gauge.toLowerCase(), p]))
  const ineligible = lines.filter((l) => {
    const p = byGauge.get(l.gauge.toLowerCase())
    return p === undefined || !p.gaugeAlive || p.status !== "active"
  })
  add("every gauge is alive and its position active", ineligible.length === 0, ineligible.map((l) => `#${l.tokenId}`).join(", ") || "all eligible")
  add("every weight is positive", lines.every((l) => l.recommendedWeight > 0n), "vote() normalizes relative weights")
  if (lines.length > 0) {
    const split = splitVotes(
      lines.map((l) => l.recommendedWeight),
      token.votingPower,
    )
    add("contract split matches the prediction", split.votes.every((v, i) => v === lines[i]?.predictedVotes), "floor(weight x power / sum)")
    add("no zero shares (ZeroBalance)", split.zeroShares.length === 0, `${split.zeroShares.length} zero shares`)
    add("votes used do not exceed voting power", split.used <= token.votingPower, `${split.used} of ${token.votingPower}`)
  }
  const boostsOk = lines.every((l) => {
    const p = byGauge.get(l.gauge.toLowerCase())
    return p !== undefined && l.projectedBoost <= MAX_BOOST && l.projectedBoost === boostAt(snapshot, p.unboostedVotingPower, l.projectedGaugeWeight)
  })
  add("projected boosts follow the contract formula and the 5x cap", boostsOk, "recomputed with computeBoost")
  const priorOk = lines.every((l) => l.projectedGaugeWeight === l.currentGaugeWeight - l.nftPriorVotes + l.predictedVotes)
  add("prior votes of this NFT are removed before adding new ones", priorOk, "vote() calls _reset first")
  return checks
}

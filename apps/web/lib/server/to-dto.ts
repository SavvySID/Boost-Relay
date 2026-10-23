import {
  CHAINS,
  MAX_BOOST,
  PRECISION,
  type BoostPosition,
  type MarketSnapshot,
  type PositionStatus,
  type ReadFailure,
  type TargetStatus,
} from "@boost-relay/mezo"
import type { BoostBucketDto, FailureDto, IncentiveStatus, MarketDto, PositionDto, TargetDto } from "../market-dto"

const s = (v: bigint): string => v.toString()

function failureDto(f: ReadFailure): FailureDto {
  return { key: f.key, kind: f.kind, message: f.message }
}

function targetDto(t: TargetStatus): TargetDto {
  return t.reachable
    ? {
        reachable: true,
        requiredWeight: s(t.requiredWeight),
        additionalWeight: s(t.additionalWeight),
        alreadyMet: t.alreadyMet,
        exceedsTotalVotingPower: t.exceedsTotalVotingPower,
      }
    : { reachable: false, reason: t.reason }
}

const isLive = (p: BoostPosition): boolean => p.gaugeAlive && p.unboostedVotingPower > 0n

/** Boost buckets for live positions; the bounds mirror the 1x floor and 5x cap of BoostVoter. */
const BUCKETS: readonly { label: string; from: bigint; to: bigint; test: (b: bigint) => boolean }[] = [
  { label: "1x", from: PRECISION, to: PRECISION, test: (b) => b === PRECISION },
  { label: "1–2x", from: PRECISION, to: 2n * PRECISION, test: (b) => b > PRECISION && b < 2n * PRECISION },
  { label: "2–3x", from: 2n * PRECISION, to: 3n * PRECISION, test: (b) => b >= 2n * PRECISION && b < 3n * PRECISION },
  { label: "3–4x", from: 3n * PRECISION, to: 4n * PRECISION, test: (b) => b >= 3n * PRECISION && b < 4n * PRECISION },
  { label: "4–5x", from: 4n * PRECISION, to: MAX_BOOST, test: (b) => b >= 4n * PRECISION && b < MAX_BOOST },
  { label: "5x cap", from: MAX_BOOST, to: MAX_BOOST, test: (b) => b === MAX_BOOST },
]

/** Converts a verified @boost-relay/mezo snapshot into the lossless JSON shape the UI reads. */
export function toMarketDto(snapshot: MarketSnapshot): MarketDto {
  const { meta, global, summary, positions, incentives } = snapshot

  const incentivesByGauge = new Map(incentives.byGauge.map((g) => [g.gauge.toLowerCase(), g]))
  const gaugesWithIncentiveFailures = new Set<string>()
  for (const f of incentives.failures) {
    const match = /^incentive:(0x[0-9a-fA-F]{40}):/.exec(f.key)
    if (match?.[1] !== undefined) gaugesWithIncentiveFailures.add(match[1].toLowerCase())
  }
  const incentiveStatus = (p: BoostPosition): { status: IncentiveStatus; tokens: PositionDto["incentives"]["tokens"] } => {
    if (!incentives.included) return { status: "not-read", tokens: [] }
    if (!p.gaugeAlive) return { status: "not-read", tokens: [] }
    if (p.bribe === null) return { status: "unavailable", tokens: [] }
    const key = p.gauge.toLowerCase()
    const entry = incentivesByGauge.get(key)
    if (entry === undefined || gaugesWithIncentiveFailures.has(key)) return { status: "unavailable", tokens: [] }
    const tokens = entry.tokens.map((t) => ({ token: t.token, symbol: t.symbol, decimals: t.decimals, postedForEpoch: s(t.postedForEpoch) }))
    return { status: entry.tokens.some((t) => t.postedForEpoch > 0n) ? "posted" : "none-posted", tokens }
  }

  const statusCounts: Record<PositionStatus, number> = { active: 0, "gauge-killed": 0, "no-lock": 0, expired: 0, "no-power": 0 }
  let additionalToMax = 0n
  let belowCapNotMaxable = 0
  let killedWeight = 0n
  const bucketCounts = BUCKETS.map(() => 0)
  for (const p of positions) {
    statusCounts[p.status]++
    if (!p.gaugeAlive) killedWeight += p.gaugeWeight
    if (!isLive(p)) continue
    const index = BUCKETS.findIndex((b) => b.test(p.analysis.liveBoost))
    if (index >= 0) bucketCounts[index] = (bucketCounts[index] ?? 0) + 1
    if (p.analysis.atCap) continue
    const five = p.analysis.targets["5x"]
    if (five.reachable && !five.exceedsTotalVotingPower) additionalToMax += five.additionalWeight
    else belowCapNotMaxable++
  }
  const attributed = summary.weightOnLivePositions + summary.weightOnZeroPowerLiveGauges + killedWeight
  const unattributed = global.boostVoterTotalWeight > attributed ? global.boostVoterTotalWeight - attributed : 0n
  const boostBuckets: BoostBucketDto[] = BUCKETS.map((b, i) => ({ label: b.label, from: s(b.from), to: s(b.to), count: bucketCounts[i] ?? 0 }))

  return {
    meta: {
      network: meta.network,
      chainId: meta.chainId,
      blockNumber: s(meta.blockNumber),
      blockTimestamp: s(meta.blockTimestamp),
      fetchedAt: meta.fetchedAt,
      ageSeconds: meta.ageSeconds,
      completeness: meta.completeness,
      mappingSource: meta.mappingSource,
      failures: meta.failures.map(failureDto),
      explorerUrl: CHAINS[meta.network].blockExplorers?.default.url ?? "",
    },
    global: {
      totalVeMezoVotingPower: s(global.totalVeMezoVotingPower),
      totalUnboostedVeBtcVotingPower: s(global.totalUnboostedVeBtcVotingPower),
      boostVoterTotalWeight: s(global.boostVoterTotalWeight),
      maxVotingNum: s(global.maxVotingNum),
      gaugeCount: s(global.gaugeCount),
      veBtcMaxTokenId: s(global.veBtcMaxTokenId),
      epoch: {
        epochStart: s(global.epoch.epochStart),
        epochNext: s(global.epoch.epochNext),
        voteStart: s(global.epoch.voteStart),
        voteEnd: s(global.epoch.voteEnd),
        phase: global.epoch.phase,
      },
    },
    summary: {
      livePositions: summary.livePositions,
      atCap: summary.atCap,
      partiallyBoosted: summary.partiallyBoosted,
      unboosted: summary.unboosted,
      weightOnLivePositions: s(summary.weightOnLivePositions),
      weightNeededToMaxAll: s(summary.weightNeededToMaxAll),
      excessWeightOnLive: s(summary.excessWeightOnLive),
      excessShareOfLive: { numerator: s(summary.excessShareOfLive.numerator), denominator: s(summary.excessShareOfLive.denominator) },
      zeroPowerLiveGauges: summary.zeroPowerLiveGauges,
      weightOnZeroPowerLiveGauges: s(summary.weightOnZeroPowerLiveGauges),
      excessShareIncludingZeroPower: {
        numerator: s(summary.excessShareIncludingZeroPower.numerator),
        denominator: s(summary.excessShareIncludingZeroPower.denominator),
      },
      positionsConsidered: summary.positionsConsidered,
    },
    derived: {
      statusCounts,
      additionalWeightToMaxBelowCap: s(additionalToMax),
      belowCapNotMaxable,
      weightOnKilledGauges: s(killedWeight),
      weightUnattributed: s(unattributed),
      boostBuckets,
      liveMatchesActive: summary.livePositions === statusCounts.active,
    },
    incentives: {
      included: incentives.included,
      completeness: incentives.completeness,
      epochStart: s(global.epoch.epochStart),
      epochNext: s(global.epoch.epochNext),
      failures: incentives.failures.map(failureDto),
    },
    positions: positions.map(
      (p): PositionDto => ({
        tokenId: s(p.tokenId),
        gauge: p.gauge,
        bribe: p.bribe,
        owner: p.owner,
        gaugeAlive: p.gaugeAlive,
        status: p.status,
        lock: { amount: s(p.lock.amount), end: s(p.lock.end), isPermanent: p.lock.isPermanent },
        unboostedVotingPower: s(p.unboostedVotingPower),
        gaugeWeight: s(p.gaugeWeight),
        liveBoost: s(p.analysis.liveBoost),
        storedBoost: s(p.analysis.storedBoost),
        boostDrift: s(p.analysis.boostDrift),
        atCap: p.analysis.atCap,
        canIncreaseWithMoreVotes: p.analysis.canIncreaseWithMoreVotes,
        targets: {
          "2x": targetDto(p.analysis.targets["2x"]),
          "3x": targetDto(p.analysis.targets["3x"]),
          "5x": targetDto(p.analysis.targets["5x"]),
        },
        excessWeight: s(p.analysis.excessWeight),
        incentives: incentiveStatus(p),
      }),
    ),
  }
}

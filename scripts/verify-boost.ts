// Read-only: builds a pinned-block market snapshot, recomputes every position's boost locally,
// compares it with BoostVoter.getBoost() at the same block, and checks the minimum-weight math.
// Optionally writes a JSON fixture for offline unit tests. Sends no transactions.
//
// Usage: npm run verify:boost -- --network mainnet [--block 12694524] [--fixture path] [--fixture-size 40] [--no-incentives]

import { writeFileSync } from "node:fs"
import {
  BOOST_TARGETS,
  computeBoost,
  createMezoReader,
  assertNetworkName,
  formatBoost,
  formatRatioPercent,
  formatTokenAmount,
  requiredWeightForBoost,
  type BoostPosition,
} from "../packages/mezo/src/index.js"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const network = assertNetworkName(arg("network"))
const blockArg = arg("block")
const blockNumber = blockArg !== undefined ? BigInt(blockArg) : undefined
const fixturePath = arg("fixture")
const fixtureSize = Number(arg("fixture-size") ?? "40")
const includeIncentives = !process.argv.includes("--no-incentives")

const reader = createMezoReader({ network, env: process.env })
console.log(`network ${network} via ${reader.rpcUrl}`)
const started = Date.now()
const { snapshot } = await reader.readMarketSnapshot({
  ...(blockNumber !== undefined ? { blockNumber } : {}),
  includeOnchainBoost: true,
  includeIncentives,
})
const { meta, global, positions, summary } = snapshot
console.log(`block ${meta.blockNumber} (${new Date(Number(meta.blockTimestamp) * 1000).toISOString()}), took ${((Date.now() - started) / 1000).toFixed(1)}s`)
console.log(`completeness: ${meta.completeness}; mapping source: ${meta.mappingSource}; failures/warnings: ${meta.failures.length}`)
for (const f of meta.failures.slice(0, 10)) console.log(`  ! ${f.key} [${f.kind}] ${f.message}`)

// 1. Local formula vs deployed getBoost at the same block.
let matches = 0
let missing = 0
const mismatches: BoostPosition[] = []
for (const p of positions) {
  if (p.onchainBoost === null) missing++
  else if (p.onchainBoost === p.analysis.liveBoost) matches++
  else mismatches.push(p)
}
console.log(`\nveBTC ids scanned: 1..${global.veBtcMaxTokenId}; positions with a boost gauge: ${positions.length}`)
console.log(`local computeBoost == on-chain getBoost: ${matches}/${positions.length - missing} (missing on-chain values: ${missing})`)
for (const p of mismatches.slice(0, 5)) {
  console.log(`  MISMATCH veBTC #${p.tokenId}: local ${p.analysis.liveBoost} on-chain ${p.onchainBoost}`)
}

// 2. Minimum-weight self-check: target met at W, missed at W - 1.
let selfOk = 0
let selfBad = 0
for (const p of positions) {
  if (!p.gaugeAlive || p.unboostedVotingPower === 0n) continue
  const ctx = {
    totalVeMezoVotingPower: global.totalVeMezoVotingPower,
    totalUnboostedVeBtcVotingPower: global.totalUnboostedVeBtcVotingPower,
    positionUnboostedVotingPower: p.unboostedVotingPower,
  }
  for (const target of Object.values(BOOST_TARGETS)) {
    const req = requiredWeightForBoost(target, ctx)
    if (!req.reachable) continue
    const at = computeBoost({ ...ctx, gaugeWeight: req.requiredWeight })
    const below = req.requiredWeight === 0n ? 0n : computeBoost({ ...ctx, gaugeWeight: req.requiredWeight - 1n })
    if (at >= target && (req.requiredWeight === 0n || below < target)) selfOk++
    else selfBad++
  }
}
console.log(`minimum-weight self-check (2x/3x/5x): ${selfOk} ok, ${selfBad} bad`)

// 3. Market summary at this block.
console.log(`\nveMEZO total voting power:        ${formatTokenAmount(global.totalVeMezoVotingPower, 18, 0)}`)
console.log(`BoostVoter total weight:          ${formatTokenAmount(global.boostVoterTotalWeight, 18, 0)}`)
console.log(`live positions (alive, power>0):  ${summary.livePositions} (at 5x: ${summary.atCap}, partial: ${summary.partiallyBoosted}, zero votes: ${summary.unboosted})`)
console.log(`weight on live positions:         ${formatTokenAmount(summary.weightOnLivePositions, 18, 0)}`)
console.log(`weight needed to max all live:    ${formatTokenAmount(summary.weightNeededToMaxAll, 18, 0)}`)
console.log(`weight above the 5x requirement:  ${formatTokenAmount(summary.excessWeightOnLive, 18, 0)} = ${formatRatioPercent(summary.excessShareOfLive, 2)} of live weight`)
console.log(`live gauges with zero veBTC power: ${summary.zeroPowerLiveGauges} holding ${formatTokenAmount(summary.weightOnZeroPowerLiveGauges, 18, 0)}`)
console.log(`  including those: ${formatRatioPercent(summary.excessShareIncludingZeroPower, 2)} of weight adds no boost`)
const stale = positions.filter((p) => p.status === "active" && p.analysis.boostDrift !== 0n).length
console.log(`active positions whose stored boost differs from live boost (poke pending): ${stale}`)
if (snapshot.incentives.included) {
  const withIncentives = snapshot.incentives.byGauge.filter((g) => g.tokens.some((t) => t.postedForEpoch > 0n))
  console.log(`\nincentives (${snapshot.incentives.completeness}): ${withIncentives.length} gauges have tokens posted for epoch ${global.epoch.epochStart}`)
  for (const g of withIncentives.slice(0, 5)) {
    const parts = g.tokens.filter((t) => t.postedForEpoch > 0n).map((t) => `${formatTokenAmount(t.postedForEpoch, t.decimals ?? 18, 4)} ${t.symbol ?? t.token}`)
    console.log(`  ${g.gauge}: ${parts.join(", ")}`)
  }
}
const sample = positions.find((p) => p.status === "active" && p.gaugeWeight > 0n && !p.analysis.atCap)
if (sample !== undefined) console.log(`\nexample partial position #${sample.tokenId}: live ${formatBoost(sample.analysis.liveBoost)}, stored ${formatBoost(sample.analysis.storedBoost)}`)

// 4. Optional fixture: a stratified sample with inputs and the on-chain answer.
if (fixturePath !== undefined) {
  const buckets = [
    positions.filter((p) => p.analysis.atCap),
    positions.filter((p) => !p.analysis.atCap && p.gaugeWeight > 0n && p.unboostedVotingPower > 0n),
    positions.filter((p) => p.gaugeWeight === 0n),
    positions.filter((p) => p.unboostedVotingPower === 0n),
  ]
  const chosen = new Map<bigint, BoostPosition>()
  for (let round = 0; chosen.size < fixtureSize && buckets.some((b) => b.length > round); round++) {
    for (const b of buckets) {
      const p = b[round]
      if (p !== undefined && chosen.size < fixtureSize) chosen.set(p.tokenId, p)
    }
  }
  const fixture = {
    description: "Real BoostVoter inputs and getBoost() outputs captured read-only at one pinned block.",
    source: {
      network,
      chainId: meta.chainId,
      rpcUrl: reader.rpcUrl,
      blockNumber: meta.blockNumber.toString(),
      blockTimestamp: meta.blockTimestamp.toString(),
      capturedAt: meta.fetchedAt,
      boostVoter: reader.deployment.contracts.boostVoter,
    },
    global: {
      totalVeMezoVotingPower: global.totalVeMezoVotingPower.toString(),
      totalUnboostedVeBtcVotingPower: global.totalUnboostedVeBtcVotingPower.toString(),
    },
    positions: [...chosen.values()]
      .filter((p) => p.onchainBoost !== null)
      .map((p) => ({
        tokenId: p.tokenId.toString(),
        gaugeWeight: p.gaugeWeight.toString(),
        unboostedVotingPower: p.unboostedVotingPower.toString(),
        storedBoostRaw: p.lock.storedBoostRaw.toString(),
        onchainBoost: (p.onchainBoost as bigint).toString(),
      })),
  }
  writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`)
  console.log(`\nwrote fixture with ${fixture.positions.length} positions to ${fixturePath}`)
}

if (mismatches.length > 0 || selfBad > 0 || meta.completeness !== "complete") process.exitCode = 1

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  BOOST_TARGETS,
  BoostMathOverflowError,
  MAX_BOOST,
  PRECISION,
  analyzeBoost,
  classifyPosition,
  computeBoost,
  normalizeStoredBoost,
  requiredWeightForBoost,
  summarizeMarket,
  type BoostContext,
} from "../src/index.js"

const P = PRECISION
const tokens = (n: bigint): bigint => n * P

// Hand-checkable context: bR = 100e18 * 1e18 / 10e18 = 10e18.
const ctx: BoostContext = {
  totalVeMezoVotingPower: tokens(1000n),
  totalUnboostedVeBtcVotingPower: tokens(100n),
  positionUnboostedVotingPower: tokens(10n),
}
const boostAt = (gaugeWeight: bigint, c: BoostContext = ctx): bigint => computeBoost({ ...c, gaugeWeight })

describe("computeBoost mirrors BoostVoter._getBoost", () => {
  it("is exactly 1x with no votes", () => {
    expect(boostAt(0n)).toBe(P)
  })

  it("computes values between 1x and 5x with the contract's integer steps", () => {
    // vR = 10e18*1e18/1000e18 = 1e16; fraction = 4*10e18*1e16/1e18 = 4e17 -> 1.4x
    expect(boostAt(tokens(10n))).toBe(1_400_000_000_000_000_000n)
    // vR = 2.5e16; fraction = 1e18 -> exactly 2x
    expect(boostAt(tokens(25n))).toBe(2n * P)
  })

  it("reaches exactly 5x at the boundary and caps above it", () => {
    expect(boostAt(tokens(100n))).toBe(MAX_BOOST) // fraction = 4e18, uncapped value is exactly 5e18
    expect(boostAt(tokens(200n))).toBe(MAX_BOOST) // uncapped 9x -> 5x
    expect(boostAt(tokens(10n ** 9n))).toBe(MAX_BOOST)
  })

  it("returns 1x when a denominator is zero, like the contract's guards", () => {
    expect(boostAt(tokens(50n), { ...ctx, totalVeMezoVotingPower: 0n })).toBe(P)
    expect(boostAt(tokens(50n), { ...ctx, positionUnboostedVotingPower: 0n })).toBe(P)
    expect(boostAt(tokens(50n), { ...ctx, totalUnboostedVeBtcVotingPower: 0n })).toBe(P)
  })

  it("truncates each division in contract order (not a single rational expression)", () => {
    // Tm = 3, W = 1: vR = floor(1e18/3) = 333..333; p = 7, Tb = 10: bR = floor(10e18/7)
    const c: BoostContext = { totalVeMezoVotingPower: 3n, totalUnboostedVeBtcVotingPower: 10n, positionUnboostedVotingPower: 7n }
    const vR = P / 3n
    const bR = (10n * P) / 7n
    const expected = P + (4n * bR * vR) / P
    expect(boostAt(1n, c)).toBe(expected < MAX_BOOST ? expected : MAX_BOOST)
    // The unfloored rational value would differ in the last digits:
    const rational = P + (4n * 10n * 1n * P) / (3n * 7n)
    expect(boostAt(1n, c)).not.toBe(rational)
  })

  it("rejects negative and out-of-range inputs", () => {
    expect(() => boostAt(-1n)).toThrow(RangeError)
    expect(() => boostAt(1n << 256n)).toThrow(RangeError)
    expect(() => computeBoost({ ...ctx, gaugeWeight: 1 as unknown as bigint })).toThrow(TypeError)
    expect(() => boostAt(0n, { ...ctx, totalVeMezoVotingPower: -5n })).toThrow(RangeError)
  })

  it("throws where checked uint256 math would make the contract revert", () => {
    // Tb * PRECISION overflows
    expect(() => boostAt(1n, { ...ctx, totalUnboostedVeBtcVotingPower: 1n << 255n, positionUnboostedVotingPower: 1n })).toThrow(
      BoostMathOverflowError,
    )
    // votingVeWeight * PRECISION overflows
    expect(() => boostAt(1n << 250n)).toThrow(BoostMathOverflowError)
  })

  it("handles realistic mainnet-scale magnitudes exactly", () => {
    const big: BoostContext = {
      totalVeMezoVotingPower: 98_779_105_123_456_789_012_345_678n,
      totalUnboostedVeBtcVotingPower: 1_234_567_890_123_456_789_012n,
      positionUnboostedVotingPower: 3_141_592_653_589_793_238n,
    }
    const w = 271_828_182_845_904_523_536_028n
    const vR = (w * P) / big.totalVeMezoVotingPower
    const bR = (big.totalUnboostedVeBtcVotingPower * P) / big.positionUnboostedVotingPower
    const raw = P + (4n * bR * vR) / P
    expect(boostAt(w, big)).toBe(raw < MAX_BOOST ? raw : MAX_BOOST)
  })
})

describe("requiredWeightForBoost", () => {
  it("gives the exact minimum for 2x, 3x and 5x", () => {
    const two = requiredWeightForBoost(BOOST_TARGETS["2x"], ctx)
    expect(two).toEqual({ reachable: true, requiredWeight: tokens(25n), exceedsTotalVotingPower: false })
    expect(boostAt(tokens(25n))).toBe(2n * P)
    expect(boostAt(tokens(25n) - 1n)).toBeLessThan(2n * P)

    const five = requiredWeightForBoost(BOOST_TARGETS["5x"], ctx)
    expect(five).toEqual({ reachable: true, requiredWeight: tokens(100n), exceedsTotalVotingPower: false })
    expect(boostAt(tokens(100n) - 1n)).toBeLessThan(MAX_BOOST)

    const three = requiredWeightForBoost(BOOST_TARGETS["3x"], ctx)
    if (!three.reachable) throw new Error("3x should be reachable")
    expect(boostAt(three.requiredWeight)).toBeGreaterThanOrEqual(3n * P)
    expect(boostAt(three.requiredWeight - 1n)).toBeLessThan(3n * P)
  })

  it("needs nothing for targets at or below 1x", () => {
    expect(requiredWeightForBoost(P, ctx)).toEqual({ reachable: true, requiredWeight: 0n, exceedsTotalVotingPower: false })
    expect(requiredWeightForBoost(0n, ctx)).toEqual({ reachable: true, requiredWeight: 0n, exceedsTotalVotingPower: false })
  })

  it("reports why a target is unreachable", () => {
    expect(requiredWeightForBoost(MAX_BOOST + 1n, ctx)).toEqual({ reachable: false, reason: "above-cap" })
    expect(requiredWeightForBoost(2n * P, { ...ctx, positionUnboostedVotingPower: 0n })).toEqual({
      reachable: false,
      reason: "no-position-power",
    })
    expect(requiredWeightForBoost(2n * P, { ...ctx, totalVeMezoVotingPower: 0n })).toEqual({
      reachable: false,
      reason: "no-vemezo-power",
    })
    // Tb * 1e18 / p floors to 0 when Tb is tiny relative to p.
    expect(requiredWeightForBoost(2n * P, { ...ctx, totalUnboostedVeBtcVotingPower: 1n })).toEqual({
      reachable: false,
      reason: "zero-boostable-ratio",
    })
  })

  it("flags requirements larger than all veMEZO in existence", () => {
    // A position equal to the whole veBTC supply needs exactly all veMEZO for 5x: not more.
    const whole = requiredWeightForBoost(MAX_BOOST, { ...ctx, positionUnboostedVotingPower: tokens(100n) })
    expect(whole).toEqual({ reachable: true, requiredWeight: tokens(1000n), exceedsTotalVotingPower: false })
    // Inputs where the position outweighs the reported total (e.g. inconsistent reads) need more than exists.
    const impossible = requiredWeightForBoost(MAX_BOOST, { ...ctx, positionUnboostedVotingPower: tokens(200n) })
    expect(impossible.reachable && impossible.exceedsTotalVotingPower).toBe(true)
  })

  it("is exact on randomized inputs across many magnitudes (deterministic seed)", () => {
    let seed = 0x9e3779b97f4a7c15n
    const next = (): bigint => {
      seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n)
      return seed
    }
    const randomBig = (): bigint => {
      const digits = Number(next() % 28n) + 1 // 1..28 decimal digits
      return (next() * next()) % 10n ** BigInt(digits) + 1n
    }
    let checked = 0
    for (let i = 0; i < 3000; i++) {
      const c: BoostContext = {
        totalVeMezoVotingPower: randomBig(),
        totalUnboostedVeBtcVotingPower: randomBig(),
        positionUnboostedVotingPower: randomBig(),
      }
      const targets = [BOOST_TARGETS["2x"], BOOST_TARGETS["3x"], BOOST_TARGETS["5x"], P + 1n + (next() % (4n * P))]
      for (const target of targets) {
        const r = requiredWeightForBoost(target, c)
        if (!r.reachable) continue
        expect(boostAt(r.requiredWeight, c) >= target).toBe(true)
        if (r.requiredWeight > 0n) expect(boostAt(r.requiredWeight - 1n, c) < target).toBe(true)
        checked++
      }
    }
    expect(checked).toBeGreaterThan(1000)
  })

  it("boost never decreases as weight increases", () => {
    let previous = 0n
    for (let w = 0n; w <= tokens(120n); w += tokens(1n) / 3n) {
      const b = boostAt(w)
      expect(b >= previous).toBe(true)
      previous = b
    }
  })
})

describe("analyzeBoost", () => {
  it("treats a stored boost of 0 as 1x and reports drift", () => {
    expect(normalizeStoredBoost(0n)).toBe(P)
    const a = analyzeBoost({ ...ctx, gaugeWeight: tokens(25n) }, 0n)
    expect(a.liveBoost).toBe(2n * P)
    expect(a.storedBoost).toBe(P)
    expect(a.boostDrift).toBe(P)
    const synced = analyzeBoost({ ...ctx, gaugeWeight: tokens(25n) }, 2n * P)
    expect(synced.boostDrift).toBe(0n)
  })

  it("computes additional weight per target and excess above the cap", () => {
    const partial = analyzeBoost({ ...ctx, gaugeWeight: tokens(25n) }, 0n)
    const t5 = partial.targets["5x"]
    expect(t5.reachable && t5.additionalWeight).toBe(tokens(75n))
    const t2 = partial.targets["2x"]
    expect(t2.reachable && t2.alreadyMet).toBe(true)
    expect(partial.excessWeight).toBe(0n)
    expect(partial.canIncreaseWithMoreVotes).toBe(true)

    const over = analyzeBoost({ ...ctx, gaugeWeight: tokens(130n) }, 0n)
    expect(over.atCap).toBe(true)
    expect(over.excessWeight).toBe(tokens(30n))
    expect(over.canIncreaseWithMoreVotes).toBe(false)
  })

  it("counts all weight as excess when the position has no power (expired lock)", () => {
    const expired = analyzeBoost({ ...ctx, positionUnboostedVotingPower: 0n, gaugeWeight: tokens(40n) }, 3n * P)
    expect(expired.liveBoost).toBe(P)
    expect(expired.excessWeight).toBe(tokens(40n))
    expect(expired.canIncreaseWithMoreVotes).toBe(false)
    expect(expired.targets["2x"]).toEqual({ reachable: false, reason: "no-position-power" })
  })
})

describe("classifyPosition", () => {
  const base = { gaugeAlive: true, lockAmount: tokens(1n), lockEnd: 2_000n, isPermanent: false, unboostedVotingPower: 5n, timestamp: 1_000n }
  it("classifies live, expired, permanent, killed, empty and zero-power positions", () => {
    expect(classifyPosition(base)).toBe("active")
    expect(classifyPosition({ ...base, lockEnd: 1_000n })).toBe("expired") // end <= timestamp
    expect(classifyPosition({ ...base, lockEnd: 0n, isPermanent: true })).toBe("active")
    expect(classifyPosition({ ...base, gaugeAlive: false })).toBe("gauge-killed")
    expect(classifyPosition({ ...base, lockAmount: 0n })).toBe("no-lock")
    expect(classifyPosition({ ...base, unboostedVotingPower: 0n })).toBe("no-power")
  })
})

describe("summarizeMarket", () => {
  const position = (gaugeAlive: boolean, power: bigint, weight: bigint) => ({
    gaugeAlive,
    unboostedVotingPower: power,
    gaugeWeight: weight,
    analysis: analyzeBoost({ ...ctx, positionUnboostedVotingPower: power, gaugeWeight: weight }, 0n),
  })
  it("separates live, zero-power and dead gauges and measures excess", () => {
    const s = summarizeMarket([
      position(true, tokens(10n), tokens(130n)), // at cap, 30 excess, needs 100
      position(true, tokens(10n), tokens(25n)), // partial, needs 100
      position(true, tokens(10n), 0n), // unboosted, needs 100
      position(true, 0n, tokens(7n)), // zero power: 7 adds nothing
      position(false, tokens(10n), tokens(999n)), // dead gauge: ignored
    ])
    expect(s.livePositions).toBe(3)
    expect([s.atCap, s.partiallyBoosted, s.unboosted]).toEqual([1, 1, 1])
    expect(s.weightOnLivePositions).toBe(tokens(155n))
    expect(s.weightNeededToMaxAll).toBe(tokens(300n))
    expect(s.excessWeightOnLive).toBe(tokens(30n))
    expect(s.excessShareOfLive).toEqual({ numerator: tokens(30n), denominator: tokens(155n) })
    expect(s.zeroPowerLiveGauges).toBe(1)
    expect(s.excessShareIncludingZeroPower).toEqual({ numerator: tokens(37n), denominator: tokens(162n) })
  })
})

describe("real mainnet fixture (captured read-only at a pinned block by scripts/verify-boost.ts)", () => {
  interface Fixture {
    source: { network: string; blockNumber: string; boostVoter: string }
    global: { totalVeMezoVotingPower: string; totalUnboostedVeBtcVotingPower: string }
    positions: { tokenId: string; gaugeWeight: string; unboostedVotingPower: string; storedBoostRaw: string; onchainBoost: string }[]
  }
  const fixture = JSON.parse(
    readFileSync(new URL("./fixtures/mainnet-12694524.json", import.meta.url), "utf8"),
  ) as Fixture

  it("comes from mainnet block 12,694,524", () => {
    expect(fixture.source.network).toBe("mainnet")
    expect(fixture.source.blockNumber).toBe("12694524")
    expect(fixture.positions.length).toBeGreaterThanOrEqual(30)
  })

  it("reproduces BoostVoter.getBoost() for every captured position", () => {
    for (const p of fixture.positions) {
      const boost = computeBoost({
        gaugeWeight: BigInt(p.gaugeWeight),
        totalVeMezoVotingPower: BigInt(fixture.global.totalVeMezoVotingPower),
        totalUnboostedVeBtcVotingPower: BigInt(fixture.global.totalUnboostedVeBtcVotingPower),
        positionUnboostedVotingPower: BigInt(p.unboostedVotingPower),
      })
      expect({ tokenId: p.tokenId, boost }).toEqual({ tokenId: p.tokenId, boost: BigInt(p.onchainBoost) })
    }
  })

  it("covers capped, partial, unvoted and zero-power positions", () => {
    const boosts = fixture.positions.map((p) => BigInt(p.onchainBoost))
    expect(boosts.some((b) => b === MAX_BOOST)).toBe(true)
    expect(boosts.some((b) => b > P && b < MAX_BOOST)).toBe(true)
    expect(fixture.positions.some((p) => p.gaugeWeight === "0")).toBe(true)
    expect(fixture.positions.some((p) => p.unboostedVotingPower === "0")).toBe(true)
  })
})

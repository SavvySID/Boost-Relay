import { MAX_BOOST, PRECISION } from "@boost-relay/mezo"
import { describe, expect, it } from "vitest"
import { recommend, recommendAll, splitVotes } from "../src/index.js"
import { BASE, gauge, input, snapshot, t, token } from "./fixtures.js"

const ids = (r: ReturnType<typeof recommend>) => r.lines.map((l) => [l.tokenId, l.predictedVotes])

describe("max-boosted-power (A)", () => {
  const rec = recommend(input(snapshot(BASE), token(100), "max-boosted-power"))

  it("fills the largest gaps first and uses all power below the cap", () => {
    expect(rec.status).toBe("actionable")
    expect(ids(rec)).toEqual([
      [1n, t(80)], // headroom 80: filled to 5x
      [2n, t(20)], // headroom 40: gets the remaining 20
    ])
    expect(rec.lines.map((l) => l.projectedBoost)).toEqual([MAX_BOOST, 3_400_000_000_000_000_000n]) // #2: weight 30 of 50 -> 3.4x
    expect(rec.summary?.excessAbove5x).toBe(0n)
  })

  it("gains exactly 0.4 boosted power per veMEZO placed below a cap", () => {
    // #1: 10 x 1.8 = 18 -> 10 x 5 = 50 (+32); #2: 5 x 1.8 = 9 -> 5 x 3.4 = 17 (+8). Total +40 = 0.4 x 100.
    expect(rec.summary?.boostedPowerChange).toBe(t(40))
    expect(rec.summary?.positionsReaching5x).toBe(1)
  })

  it("never selects capped, expired or killed positions", () => {
    expect(rec.lines.map((l) => l.tokenId)).not.toContain(4n)
    expect(rec.lines.map((l) => l.tokenId)).not.toContain(5n)
    expect(rec.lines.map((l) => l.tokenId)).not.toContain(6n)
  })

  it("builds a vote call whose weights sum to the power, so the contract split is exact", () => {
    const call = rec.voteCall
    expect(call?.executable).toBe(true)
    expect(call?.gauges).toEqual([gauge(1), gauge(2)])
    expect(call?.weights.reduce((s, w) => s + w, 0n)).toBe(t(100))
    expect(splitVotes(call?.weights ?? [], t(100)).votes).toEqual(rec.lines.map((l) => l.predictedVotes))
    expect(rec.summary?.roundingRemainder).toBe(0n)
  })

  it("explains each line with reasons computed from the numbers", () => {
    const codes = rec.lines.map((l) => l.reasons.map((r) => r.code))
    expect(codes[0]).toEqual(["below-cap", "largest-headroom", "reaches-5x"])
    expect(codes[1]).toEqual(["below-cap", "largest-headroom", "partial-fill"])
    expect(rec.lines[0]?.reasons[1]?.text).toContain("Rank 1 of 3")
  })
})

describe("max-capped-positions (B)", () => {
  const rec = recommend(input(snapshot(BASE), token(100), "max-capped-positions"))

  it("fills the smallest gaps first, then partially funds the next one", () => {
    expect(ids(rec)).toEqual([
      [3n, t(20)], // needs 20
      [2n, t(40)], // needs 40
      [1n, t(40)], // needs 80, gets the remaining 40
    ])
    expect(rec.summary?.positionsReaching5x).toBe(2)
    expect(rec.lines[2]?.role).toBe("partial")
  })

  it("trades count against nothing here: both strategies keep all power below the cap", () => {
    const both = recommendAll({ snapshot: snapshot(BASE), token: token(100), context: input(snapshot(BASE), token(100)).context })
    expect(both["max-boosted-power"].summary?.positionsReaching5x).toBe(1)
    expect(both["max-capped-positions"].summary?.positionsReaching5x).toBe(2)
    expect(both["max-boosted-power"].summary?.boostedPowerChange).toBe(both["max-capped-positions"].summary?.boostedPowerChange)
  })

  it("reports when the power cannot bring every candidate to 5x", () => {
    const small = recommend(input(snapshot(BASE), token(30), "max-capped-positions"))
    expect(ids(small)).toEqual([
      [3n, t(20)],
      [2n, t(10)],
    ])
    expect(small.summary?.objectiveNote).toMatch(/1 positions reach 5x; the next cheapest needs more than the power left/)
  })
})

describe("gauge limit and leftover power", () => {
  it("respects maxVotingNum and labels unavoidable weight past the cap", () => {
    const snap = snapshot(BASE, { maxVotingNum: 2n })
    const a = recommend(input(snap, token(200), "max-boosted-power"))
    expect(a.lines).toHaveLength(2)
    expect(ids(a)).toEqual([
      [1n, t(160)], // 80 to fill + 80 that has nowhere below a cap within 2 gauges
      [2n, t(40)],
    ])
    expect(a.summary?.excessAbove5x).toBe(t(80))
    expect(a.lines[0]?.role).toBe("leftover")
    expect(a.lines[0]?.reasons.map((r) => r.code)).toContain("leftover-excess")
    expect(a.warnings.map((w) => w.code)).toContain("gauge-limit")
    expect(a.status).toBe("actionable") // still a valid vote; the excess is disclosed

    const b = recommend(input(snap, token(200), "max-capped-positions"))
    expect(b.lines).toHaveLength(2)
    expect(b.summary?.excessAbove5x).toBe(t(140))
  })

  it("puts leftover on unfilled room before going past a cap", () => {
    const rec = recommend(input(snapshot(BASE), token(140), "max-boosted-power"))
    expect(rec.summary?.excessAbove5x).toBe(0n)
    expect(ids(rec)).toEqual([
      [1n, t(80)],
      [2n, t(40)],
      [3n, t(20)],
    ])
  })
})

describe("existing votes of the NFT", () => {
  const specs = [
    { id: 1, power: 10, weight: 50 }, // includes 30 from this NFT -> base 20, headroom 80
    { id: 2, power: 5, weight: 10 },
    { id: 3, power: 2, weight: 0 },
    { id: 4, power: 1, weight: 45 }, // includes 40 from this NFT -> base 5, headroom 5
  ]
  const tok = token(100, { prior: [[1, 30], [4, 40]] })

  it("replaces prior votes instead of adding the NFT's power on top", () => {
    const rec = recommend(input(snapshot(specs), tok, "max-boosted-power"))
    const first = rec.lines[0]
    expect(first).toMatchObject({ tokenId: 1n, nftPriorVotes: t(30), baseGaugeWeight: t(20), predictedVotes: t(80), projectedGaugeWeight: t(100) })
    expect(first?.reasons[0]?.code).toBe("replaces-prior-vote")
  })

  it("reports positions that lose boost when prior votes are withdrawn", () => {
    const rec = recommend(input(snapshot(specs), tok, "max-boosted-power"))
    expect(rec.removed).toEqual([{ gauge: gauge(4), tokenId: 4n, priorVotes: t(40), currentBoost: MAX_BOOST, projectedBoost: 3n * PRECISION }])
    expect(rec.summary?.positionsLosingBoost).toBe(1)
    expect(rec.warnings.map((w) => w.code)).toContain("removes-prior-votes")
  })

  it("can re-select a position that was capped only by this NFT's votes", () => {
    const rec = recommend(input(snapshot(specs), tok, "max-capped-positions"))
    expect(rec.lines[0]).toMatchObject({ tokenId: 4n, headroomTo5x: t(5), predictedVotes: t(5), projectedBoost: MAX_BOOST })
    expect(rec.removed).toEqual([])
  })
})

describe("determinism", () => {
  it("breaks headroom ties by veBTC id in both strategies", () => {
    const tied = [
      { id: 9, power: 2, weight: 0 },
      { id: 3, power: 2, weight: 0 },
      { id: 5, power: 2, weight: 0 },
    ]
    for (const strategy of ["max-boosted-power", "max-capped-positions"] as const) {
      const rec = recommend(input(snapshot(tied), token(30), strategy))
      expect(rec.lines.map((l) => l.tokenId)).toEqual([3n, 5n])
      expect(recommend(input(snapshot(tied), token(30), strategy))).toEqual(rec)
    }
  })
})

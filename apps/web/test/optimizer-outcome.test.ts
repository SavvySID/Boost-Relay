import { recommend } from "@boost-relay/optimizer"
import { describe, expect, it } from "vitest"
import { stringifyBigints } from "@/lib/optimizer-dto"
import { compareOutcome } from "@/lib/optimizer-outcome"
import { BASE, gauge, input, snapshot, t, token } from "../../../packages/optimizer/test/fixtures"

const dto = (rec: ReturnType<typeof recommend>) => ({ ...stringifyBigints(rec), calldata: null })

describe("before / after comparison of a recommendation", () => {
  it("reports the optimizer's own boosted-power totals and the change", () => {
    const rec = recommend(input(snapshot(BASE), token(100)))
    const c = compareOutcome(dto(rec), null)
    expect(c).not.toBeNull()
    expect(c?.boostedBefore).toBe(rec.summary?.boostedPowerBefore)
    expect(c?.boostedAfter).toBe(rec.summary?.boostedPowerAfter)
    expect(c?.boostedChange).toBe(rec.summary?.boostedPowerChange)
    expect(c?.boostedChange).toBeGreaterThan(0n)
  })

  it("counts positions at 5x before and after among the positions the vote touches", () => {
    for (const strategy of ["max-boosted-power", "max-capped-positions"] as const) {
      const rec = recommend(input(snapshot(BASE), token(140), strategy))
      const c = compareOutcome(dto(rec), 10)
      const reaching = rec.summary?.positionsReaching5x ?? 0
      expect(c?.affected).toBe(rec.lines.length)
      expect((c?.affectedAtCapAfter ?? 0) - (c?.affectedAtCapBefore ?? 0)).toBe(reaching)
      expect(c?.marketAtCapAfter).toBe(10 + reaching)
    }
  })

  it("counts a position that drops below 5x when this NFT's prior votes are removed", () => {
    const specs = [
      { id: 1, power: 10, weight: 50 },
      { id: 2, power: 5, weight: 10 },
      { id: 3, power: 2, weight: 0 },
      { id: 4, power: 1, weight: 45 },
    ]
    const rec = recommend(input(snapshot(specs), token(100, { prior: [[1, 30], [4, 40]] }), "max-boosted-power"))
    const c = compareOutcome(dto(rec), 20)
    expect(rec.removed.map((r) => r.gauge)).toEqual([gauge(4)])
    expect(c?.affected).toBe(rec.lines.length + 1)
    expect(c?.affectedAtCapBefore).toBeGreaterThanOrEqual(1)
    expect(c?.marketAtCapAfter).toBe(20 - (c?.affectedAtCapBefore ?? 0) + (c?.affectedAtCapAfter ?? 0))
  })

  it("splits the NFT's power into shares that add up to what vote() allocates", () => {
    const rec = recommend(input(snapshot(BASE), token(140)))
    const c = compareOutcome(dto(rec), null)
    const total = [...(c?.sharesBps.values() ?? [])].reduce((s, v) => s + v, 0)
    expect(total).toBeLessThanOrEqual(10_000)
    expect(total).toBeGreaterThanOrEqual(9_990)
    expect(c?.votesUsed).toBeLessThanOrEqual(t(140))
    expect((c?.votesUsed ?? 0n) + (c?.unused ?? 0n)).toBe(t(140))
  })

  it("has nothing to compare when there is no recommendation", () => {
    const rec = recommend(input(snapshot(BASE, { partial: true }), token(100)))
    expect(compareOutcome(dto(rec), 5)).toBeNull()
  })
})

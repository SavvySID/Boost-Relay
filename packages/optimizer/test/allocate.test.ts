import { MAX_BOOST, computeBoost } from "@boost-relay/mezo"
import { describe, expect, it } from "vitest"
import { buildCandidates, projectVote, splitVotes } from "../src/index.js"
import { BASE, gauge, snapshot, t, token } from "./fixtures.js"

describe("splitVotes mirrors NonStakingVoter._vote", () => {
  it("treats weights as relative and floors each share", () => {
    expect(splitVotes([1n, 1n], 3n)).toEqual({ votes: [1n, 1n], used: 2n, zeroShares: [] }) // 1 wei of dust
    expect(splitVotes([3n, 7n], 10n).votes).toEqual([3n, 7n])
    expect(splitVotes([50n, 50n], t(100)).votes).toEqual([t(50), t(50)]) // "50" means half, not 50 tokens
    expect(splitVotes([1n, 2n, 3n], 100n)).toEqual({ votes: [16n, 33n, 50n], used: 99n, zeroShares: [] })
  })

  it("is exact when the weights already sum to the voting power", () => {
    const power = 987_654_321_123_456_789_000n
    const weights = [123_000_000_000_000_000n, power - 123_000_000_000_000_000n - 7n, 7n]
    const total = weights.reduce((s, w) => s + w, 0n)
    expect(total).toBe(power)
    expect(splitVotes(weights, power).votes).toEqual(weights)
  })

  it("reports zero shares (vote() would revert ZeroBalance) and rejects bad input", () => {
    expect(splitVotes([1n, 10n ** 30n], 10n).zeroShares).toEqual([0])
    expect(() => splitVotes([0n, 0n], 10n)).toThrow(RangeError)
    expect(() => splitVotes([-1n, 2n], 10n)).toThrow(RangeError)
  })
})

describe("buildCandidates", () => {
  it("keeps only active, below-cap positions and measures headroom from base weight", () => {
    const set = buildCandidates(snapshot(BASE), token(100))
    expect(set.candidates.map((c) => [c.tokenId, c.headroom])).toEqual([
      [1n, t(80)],
      [2n, t(40)],
      [3n, t(20)],
    ])
    expect(set).toMatchObject({ alreadyCapped: 1, inactive: 2, unreachable: 0 })
    expect(set.candidates[0]?.required5x).toBe(t(100))
  })

  it("sets this NFT's prior votes aside, so a position capped only by them becomes a candidate", () => {
    const specs = [{ id: 1, power: 10, weight: 50 }, { id: 4, power: 1, weight: 45 }]
    const set = buildCandidates(snapshot(specs), token(100, { prior: [[1, 30], [4, 40]] }))
    expect(set.candidates.map((c) => [c.tokenId, c.baseWeight, c.headroom])).toEqual([
      [1n, t(20), t(80)],
      [4n, t(5), t(5)],
    ])
  })

  it("never lists a gauge twice", () => {
    const dup = [{ id: 1, power: 10, weight: 20 }, { id: 7, power: 2, weight: 0, gaugeOverride: gauge(1) }]
    expect(buildCandidates(snapshot(dup), token(100)).candidates).toHaveLength(1)
  })

  it("rejects reads where the gauge weight is below this NFT's own votes", () => {
    expect(() => buildCandidates(snapshot([{ id: 1, power: 10, weight: 5 }]), token(100, { prior: [[1, 30]] }))).toThrow(/inconsistent/)
  })
})

describe("projectVote", () => {
  it("removes prior votes everywhere, then adds the new votes", () => {
    const snap = snapshot([{ id: 1, power: 10, weight: 50 }, { id: 4, power: 1, weight: 45 }])
    const tok = token(100, { prior: [[1, 30], [4, 40]] })
    const p = projectVote(snap, tok, [{ gauge: gauge(1), predictedVotes: t(80) }])
    expect(p.weights.get(gauge(1).toLowerCase())).toBe(t(100)) // 50 - 30 + 80
    expect(p.weights.get(gauge(4).toLowerCase())).toBe(t(5)) // 45 - 40
    expect(p.removed).toEqual([
      { gauge: gauge(4), tokenId: 4n, priorVotes: t(40), currentBoost: MAX_BOOST, projectedBoost: 3n * 10n ** 18n },
    ])
  })

  it("puts a position exactly at 5x with its requirement and below 5x one wei short", () => {
    const ctx = { totalVeMezoVotingPower: t(1000), totalUnboostedVeBtcVotingPower: t(100), positionUnboostedVotingPower: t(10) }
    expect(computeBoost({ ...ctx, gaugeWeight: t(100) })).toBe(MAX_BOOST)
    expect(computeBoost({ ...ctx, gaugeWeight: t(100) - 1n })).toBeLessThan(MAX_BOOST)
  })
})

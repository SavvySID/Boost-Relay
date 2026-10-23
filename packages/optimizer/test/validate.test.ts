import { describe, expect, it } from "vitest"
import { recommend } from "../src/index.js"
import { BASE, EPOCH_START, input, snapshot, t, token } from "./fixtures.js"

const codes = (r: ReturnType<typeof recommend>) => r.blockers.map((b) => b.code)

describe("preconditions block untrustworthy recommendations", () => {
  it("blocks on a partial snapshot", () => {
    const r = recommend(input(snapshot(BASE, { partial: true }), token(100)))
    expect(r.status).toBe("blocked")
    expect(codes(r)).toContain("snapshot-partial")
    expect(r.lines).toEqual([])
    expect(r.voteCall).toBeNull()
  })

  it("blocks when the NFT's existing votes could not be fully read", () => {
    const tok = token(100, { prior: [[1, 30]] })
    const r = recommend(input(snapshot([{ id: 1, power: 10, weight: 50 }]), { ...tok, allocation: { ...tok.allocation, complete: false, issues: ["gaugeVote[3] read failed"] } }))
    expect(codes(r)).toEqual(["allocation-unknown"])
  })

  it("blocks on zero voting power, a missing NFT, or reads from different blocks", () => {
    expect(codes(recommend(input(snapshot(BASE), token(0n))))).toContain("no-power")
    expect(codes(recommend(input(snapshot(BASE), token(100, { owner: "0x0000000000000000000000000000000000000000" }))))).toContain("no-owner")
    expect(codes(recommend(input(snapshot(BASE), token(100, { blockNumber: 499n }))))).toContain("block-mismatch")
  })

  it("blocks with an explanation when no position is below 5x", () => {
    const r = recommend(input(snapshot([{ id: 4, power: 1, weight: 10 }]), token(100)))
    expect(codes(r)).toEqual(["no-candidates"])
    expect(r.blockers[0]?.text).toMatch(/1 already at 5x/)
  })
})

describe("epoch rules make a recommendation informational, never actionable", () => {
  it("already voted this epoch: computed for analysis, vote call not executable", () => {
    const r = recommend(input(snapshot(BASE), token(100, { lastVoted: EPOCH_START + 10n })))
    expect(r.status).toBe("informational")
    expect(r.lines.length).toBeGreaterThan(0)
    expect(r.voteCall?.executable).toBe(false)
    expect(r.warnings[0]?.code).toBe("already-voted")
  })

  it("outside the voting window", () => {
    const early = recommend(input(snapshot(BASE, { timestamp: EPOCH_START + 60n }), token(100)))
    expect(early.status).toBe("informational")
    expect(early.warnings[0]?.code).toBe("window-not-open")
    const late = recommend(input(snapshot(BASE, { timestamp: EPOCH_START + 604_800n - 60n }), token(100)))
    expect(late.warnings[0]?.code).toBe("window-closed")
  })
})

describe("post-checks", () => {
  it("passes every check for a valid plan", () => {
    const r = recommend(input(snapshot(BASE), token(100)))
    expect(r.checks.length).toBeGreaterThanOrEqual(9)
    expect(r.checks.filter((c) => !c.ok)).toEqual([])
  })

  it("veMEZO #4242 analysis is read-only: inputs are not mutated and nothing but data comes back", () => {
    const snap = snapshot(BASE)
    const tok = token(100)
    const frozen = JSON.stringify([snap, tok], (_, v) => (typeof v === "bigint" ? v.toString() : v))
    Object.freeze(tok)
    Object.freeze(snap)
    const r = recommend(input(snap, tok))
    expect(r.tokenId).toBe(4242n)
    expect(JSON.stringify([snap, tok], (_, v) => (typeof v === "bigint" ? v.toString() : v))).toBe(frozen)
    expect(Object.keys(r).sort()).toEqual(["blockers", "checks", "lines", "removed", "sourceBlock", "status", "strategy", "summary", "tokenId", "voteCall", "warnings"])
    expect(r.voteCall?.functionName).toBe("vote") // a description of a call, not a call
  })

  it("keeps tiny headrooms above the minimum allocation so no share rounds to zero", () => {
    const tiny = [{ id: 1, power: 10, weight: 20 }]
    const snap = snapshot(tiny)
    const pos = snap.positions[0]
    if (pos === undefined) throw new Error("fixture")
    const near = { ...snap, positions: [{ ...pos, gaugeWeight: t(100) - 5n }] } // 5 wei below 5x
    const r = recommend(input(near, token(1)))
    expect(r.lines[0]?.predictedVotes).toBeGreaterThanOrEqual(10n ** 12n)
    expect(r.checks.find((c) => c.name.startsWith("no zero shares"))?.ok).toBe(true)
  })
})

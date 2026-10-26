import { describe, expect, it } from "vitest"
import { satsFromWei } from "@/lib/market-formatting"
import type { OptimizerDto } from "@/lib/optimizer-dto"
import { checkRecordedVote } from "@/lib/post-vote"
import type { PreparedVote } from "@/lib/vote-dto"

const G1 = "0x1111111111111111111111111111111111111111"
const G2 = "0x2222222222222222222222222222222222222222"
const prepared = { network: "testnet", tokenId: "4242", epochStart: "1000", gauges: [G1, G2] } as unknown as PreparedVote

function data(over: { lastVoted?: string; entries?: { gauge: string; votes: string }[]; complete?: boolean; tokenId?: string } = {}): OptimizerDto {
  return {
    network: "testnet",
    sourceBlock: "5000",
    token: {
      tokenId: over.tokenId ?? "4242",
      lastVoted: over.lastVoted ?? "1500",
      allocation: {
        complete: over.complete ?? true,
        issues: [],
        usedWeight: "0",
        entries: (over.entries ?? [
          { gauge: G1.toUpperCase().replace("0X", "0x"), votes: "60" },
          { gauge: G2, votes: "40" },
        ]).map((e) => ({ ...e, tokenId: null })),
      },
    },
  } as unknown as OptimizerDto
}

describe("post-vote on-chain check", () => {
  it("verifies when BoostVoter records this epoch's vote on exactly the signed gauges", () => {
    expect(checkRecordedVote(prepared, data())).toEqual({ status: "verified", block: "5000", gauges: 2, totalVotes: 100n })
  })

  it("never claims success while the re-read does not show the vote yet", () => {
    expect(checkRecordedVote(prepared, data({ lastVoted: "999" })).status).toBe("not-visible-yet")
    expect(checkRecordedVote(prepared, data({ complete: false })).status).toBe("not-visible-yet")
    expect(checkRecordedVote(prepared, data({ tokenId: "7" })).status).toBe("not-visible-yet")
  })

  it("flags a recorded vote on different gauges", () => {
    expect(checkRecordedVote(prepared, data({ entries: [{ gauge: G1, votes: "100" }] })).status).toBe("different")
  })
})

describe("network fee in satoshis", () => {
  it("formats real testnet and mainnet-sized fees", () => {
    expect(satsFromWei("70465675")).toBe("0.007 sats") // the demo vote: 402,661 gas at 175 wei
    expect(satsFromWei("3500000000000")).toBe("350 sats")
    expect(satsFromWei("0")).toBe("0 sats")
  })
})

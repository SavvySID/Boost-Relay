import { describe, expect, it } from "vitest"
import { canVoteAt, epochNext, epochStart, epochVoteEnd, epochVoteStart, getEpochInfo } from "../src/index.js"

// Values read from mainnet/testnet BoostVoter epoch views at block time 1792705788 (2026-10-22 21:49:48 UTC).
const T = 1_792_705_788n
const START = 1_792_627_200n
const VOTE_START = 1_792_630_800n
const VOTE_END = 1_793_228_400n
const NEXT = 1_793_232_000n

describe("epoch timing mirrors ProtocolTimeLibrary", () => {
  it("matches the on-chain epoch views", () => {
    expect(epochStart(T)).toBe(START)
    expect(epochVoteStart(T)).toBe(VOTE_START)
    expect(epochVoteEnd(T)).toBe(VOTE_END)
    expect(epochNext(T)).toBe(NEXT)
  })

  it("uses strict and inclusive bounds exactly like onlyNewEpoch and vote()", () => {
    expect(getEpochInfo(VOTE_START).phase).toBe("distribution") // reverts DistributeWindow at == voteStart
    expect(getEpochInfo(VOTE_START + 1n).phase).toBe("voting")
    expect(getEpochInfo(VOTE_END).phase).toBe("voting") // allowed at == voteEnd
    expect(getEpochInfo(VOTE_END + 1n).phase).toBe("whitelist-only")
    expect(getEpochInfo(START).phase).toBe("distribution")
  })

  it("allows one vote per epoch per NFT", () => {
    expect(canVoteAt(T, 0n)).toBe(true)
    expect(canVoteAt(T, START)).toBe(false) // epochStart <= lastVoted
    expect(canVoteAt(T, START - 1n)).toBe(true)
    expect(canVoteAt(VOTE_START, 0n)).toBe(false)
    expect(canVoteAt(VOTE_END + 1n, 0n)).toBe(false)
  })

  it("rejects negative timestamps", () => {
    expect(() => epochStart(-1n)).toThrow(RangeError)
    expect(() => canVoteAt(T, -1n)).toThrow(RangeError)
  })
})

import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { boostVoterAbi } from "@boost-relay/mezo"
import { recommend } from "@boost-relay/optimizer"
import { ContractFunctionRevertedError, encodeErrorResult } from "viem"
import { describe, expect, it } from "vitest"
import { MAX_SNAPSHOT_AGE_SECONDS, assessVote } from "@/lib/server/vote-gates"
import { describeRevert } from "@/lib/server/vote-service"
import { BASE, EPOCH_START, T, input, snapshot, token } from "../../../packages/optimizer/test/fixtures"

const OWNER = "0x00000000000000000000000000000000000a11CE"

function gates(opts: { account?: string; snap?: ReturnType<typeof snapshot>; tok?: ReturnType<typeof token>; network?: "mainnet" | "testnet"; now?: bigint } = {}) {
  const snap = opts.snap ?? snapshot(BASE)
  const tok = opts.tok ?? token(100)
  const rec = recommend(input(snap, tok))
  const result = assessVote({ network: opts.network ?? "testnet", account: opts.account ?? OWNER, snapshot: snap, token: tok, recommendation: rec, nowSeconds: opts.now ?? T + 30n })
  return { all: result, failed: result.filter((g) => !g.ok).map((g) => g.id) }
}

describe("vote gates", () => {
  it("pass for the owner of an eligible NFT with a fresh, complete snapshot", () => {
    expect(gates().failed).toEqual([])
    expect(gates().all).toHaveLength(12)
  })

  it("block an account that does not own the NFT", () => {
    expect(gates({ account: "0x0000000000000000000000000000000000000b0B" }).failed).toEqual(["owner-matches"])
  })

  it("block a missing NFT and zero voting power", () => {
    expect(gates({ tok: token(100, { owner: "0x0000000000000000000000000000000000000000" }) }).failed).toEqual(expect.arrayContaining(["token-exists", "owner-matches"]))
    expect(gates({ tok: token(0n) }).failed).toEqual(expect.arrayContaining(["power-positive", "recommendation-actionable"]))
  })

  it("block an NFT that already voted this epoch, and voting outside or at the end of the window", () => {
    expect(gates({ tok: token(100, { lastVoted: EPOCH_START + 5n }) }).failed).toEqual(expect.arrayContaining(["not-voted-this-epoch", "recommendation-actionable"]))
    expect(gates({ snap: snapshot(BASE, { timestamp: EPOCH_START + 60n }), now: EPOCH_START + 90n }).failed).toContain("in-vote-window")
    const nearEnd = EPOCH_START + 604_800n - 3_600n - 100n
    expect(gates({ snap: snapshot(BASE, { timestamp: nearEnd }), now: nearEnd + 10n }).failed).toEqual(["in-vote-window"])
  })

  it("block a partial or stale snapshot", () => {
    expect(gates({ snap: snapshot(BASE, { partial: true }) }).failed).toEqual(expect.arrayContaining(["snapshot-complete", "recommendation-actionable"]))
    expect(gates({ now: T + BigInt(MAX_SNAPSHOT_AGE_SECONDS) + 1n }).failed).toEqual(["snapshot-fresh"])
  })

  it("block when existing votes could not be fully read", () => {
    const tok = token(100)
    expect(gates({ tok: { ...tok, allocation: { ...tok.allocation, complete: false, issues: ["gaugeVote[2] read failed"] } } }).failed).toEqual(expect.arrayContaining(["allocation-known"]))
  })

  it("keep mainnet read-only", () => {
    expect(gates({ network: "mainnet" }).failed).toEqual(["network-testnet"])
  })
})

describe("simulation revert explanations", () => {
  it("names the contract's custom error", () => {
    for (const [errorName, text] of [
      ["NotApprovedOrOwner", /does not own/],
      ["AlreadyVotedOrDeposited", /already voted/],
      ["NotWhitelistedNFT", /window .* closed/],
      ["TooManyGauges", /Too many gauges/],
    ] as const) {
      const err = new ContractFunctionRevertedError({ abi: boostVoterAbi, data: encodeErrorResult({ abi: boostVoterAbi, errorName }), functionName: "vote" })
      const d = describeRevert(err)
      expect(d.code).toBe(`revert:${errorName}`)
      expect(d.message).toMatch(text)
    }
  })
})

describe("no special code path for any NFT or wallet", () => {
  it("app source never hard-codes the demo token id or any wallet or contract address", () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(name)) files.push(p)
      }
    }
    const root = join(__dirname, "..")
    for (const d of ["app", "components", "lib"]) walk(join(root, d))
    // Addresses come only from the verified deployment config in @boost-relay/mezo.
    const offenders = files.filter((f) => /\b924\b|0x[0-9a-f]{40}/i.test(readFileSync(f, "utf8")))
    expect(files.length).toBeGreaterThan(20)
    expect(offenders).toEqual([])
  })

  it("eth_sendTransaction appears in exactly one place: the final submit path", () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(name)) files.push(p)
      }
    }
    const root = join(__dirname, "..")
    for (const d of ["app", "components", "lib"]) walk(join(root, d))
    const senders = files.filter((f) => /eth_sendTransaction|eth_sign|personal_sign|signTypedData|writeContract|sendRawTransaction/.test(readFileSync(f, "utf8")))
    expect(senders.map((f) => f.replace(root, "").replace(/\\/g, "/"))).toEqual(["/lib/wallet/vote-flow.ts"])
  })
})

import { boostVoterAbi } from "@boost-relay/mezo"
import { recommend } from "@boost-relay/optimizer"
import { encodeFunctionData } from "viem"
import { describe, expect, it, vi } from "vitest"
import { stringifyBigints } from "@/lib/optimizer-dto"
import type { PrepareResponse, PreparedVote, ReceiptResponse, SimulateResponse } from "@/lib/vote-dto"
import { TESTNET_CHAIN_ID, readConnection, requestConnection, requestTestnetSwitch } from "@/lib/wallet/actions"
import type { Eip1193Provider } from "@/lib/wallet/eip1193"
import { integrityProblem, invalidationReason, preflight, prepareVote, submitVote, type FlowState, type VoteApi } from "@/lib/wallet/vote-flow"
import { BASE, input, snapshot, token } from "../../../packages/optimizer/test/fixtures"

const OWNER = "0x00000000000000000000000000000000000a11CE"
const OTHER = "0x0000000000000000000000000000000000000b0B"
const HASH = `0x${"ab".repeat(32)}`
const NOW = Date.parse("2026-10-23T00:00:00Z")

/** Recording mock wallet. It never signs: eth_sendTransaction just returns a fake hash or an error. */
function mockWallet(opts: { account?: string | null; chainId?: number; rejectConnect?: boolean; sendError?: { code: number; message: string }; switchUnknown?: boolean } = {}) {
  const calls: string[] = []
  let account = opts.account === undefined ? OWNER : opts.account
  let chainId = opts.chainId ?? TESTNET_CHAIN_ID
  const provider: Eip1193Provider = {
    async request({ method, params }) {
      calls.push(method)
      switch (method) {
        case "eth_requestAccounts":
          if (opts.rejectConnect) throw Object.assign(new Error("User rejected the request."), { code: 4001 })
          return account ? [account] : []
        case "eth_accounts":
          return account ? [account] : []
        case "eth_chainId":
          return `0x${chainId.toString(16)}`
        case "wallet_switchEthereumChain":
          if (opts.switchUnknown && !calls.includes("wallet_addEthereumChain")) throw Object.assign(new Error("Unrecognized chain"), { code: 4902 })
          chainId = Number.parseInt((params as [{ chainId: string }])[0].chainId, 16)
          return null
        case "wallet_addEthereumChain":
          chainId = Number.parseInt((params as [{ chainId: string }])[0].chainId, 16)
          return null
        case "eth_sendTransaction":
          if (opts.sendError) throw Object.assign(new Error(opts.sendError.message), { code: opts.sendError.code })
          return HASH
        default:
          throw Object.assign(new Error(`unsupported ${method}`), { code: 4200 })
      }
    },
  }
  return {
    provider,
    calls,
    setAccount: (a: string | null) => {
      account = a
    },
    setChain: (c: number) => {
      chainId = c
    },
  }
}

function prepared(overrides: Partial<PreparedVote> = {}): PreparedVote {
  const rec = recommend(input(snapshot(BASE), token(100)))
  const call = rec.voteCall
  if (call === null) throw new Error("fixture")
  return {
    network: "testnet",
    chainId: TESTNET_CHAIN_ID,
    account: OWNER,
    to: call.to,
    functionName: "vote",
    signature: "vote(uint256,address[],uint256[])",
    tokenId: call.tokenId.toString(),
    gauges: [...call.gauges],
    gaugeTokenIds: rec.lines.map((l) => l.tokenId.toString()),
    weights: call.weights.map(String),
    calldata: encodeFunctionData({ abi: boostVoterAbi, functionName: "vote", args: [call.tokenId, [...call.gauges], [...call.weights]] }),
    strategy: "max-boosted-power",
    votingPower: (100n * 10n ** 18n).toString(),
    sourceBlock: "500",
    sourceTimestamp: "1792705788",
    epochStart: "1792627200",
    voteEnd: "1793228400",
    preparedAt: new Date(NOW).toISOString(),
    expiresAt: new Date(NOW + 120_000).toISOString(),
    simulation: { ok: true, blockNumber: "501", simulatedAt: new Date(NOW).toISOString() },
    gates: [],
    recommendation: { ...stringifyBigints(rec), calldata: null },
    existingVotes: [],
    ...overrides,
  }
}

function mockApi(o: { prepare?: PrepareResponse; simulate?: SimulateResponse; receipts?: (ReceiptResponse | "throw")[]; refreshFails?: boolean } = {}) {
  const receipts = [...(o.receipts ?? [{ ok: true, status: "success", blockNumber: "502", gasUsed: "21000" }])]
  const api: VoteApi = {
    prepare: vi.fn(async () => o.prepare ?? { ok: true as const, prepared: prepared() }),
    simulate: vi.fn(async () => o.simulate ?? { ok: true as const, blockNumber: "501", simulatedAt: new Date(NOW).toISOString() }),
    receipt: vi.fn(async () => {
      const next = receipts.length > 1 ? receipts.shift() : receipts[0]
      if (next === "throw" || next === undefined) throw new Error("rpc down")
      return next
    }),
    refresh: vi.fn(async () => {
      if (o.refreshFails) throw new Error("refresh failed")
    }),
  }
  return api
}

const deps = (w: ReturnType<typeof mockWallet>, api: VoteApi, states: FlowState[] = []) => ({
  provider: w.provider,
  api,
  now: () => NOW,
  sleep: async () => {},
  onState: (s: FlowState) => states.push(s),
  pollIntervalMs: 1,
  maxPolls: 10,
  maxConsecutiveErrors: 3,
})

describe("wallet connection", () => {
  it("connects only through eth_requestAccounts and reports the chain", async () => {
    const w = mockWallet()
    expect(await requestConnection(w.provider)).toEqual({ account: OWNER, chainId: TESTNET_CHAIN_ID })
    expect(w.calls).toEqual(["eth_requestAccounts", "eth_chainId"])
  })

  it("surfaces a rejected connection with code 4001", async () => {
    await expect(requestConnection(mockWallet({ rejectConnect: true }).provider)).rejects.toMatchObject({ code: 4001 })
  })

  it("reads the current account without prompting, or null when disconnected", async () => {
    const w = mockWallet({ account: null })
    expect(await readConnection(w.provider)).toBeNull()
    expect(w.calls).not.toContain("eth_requestAccounts")
  })

  it("switches to testnet on request, adding the chain when the wallet does not know it, and re-reads the chain", async () => {
    const w = mockWallet({ chainId: 1, switchUnknown: true })
    expect(await requestTestnetSwitch(w.provider)).toBe(TESTNET_CHAIN_ID)
    expect(w.calls).toEqual(["wallet_switchEthereumChain", "wallet_addEthereumChain", "eth_chainId"])
  })
})

describe("preflight and invalidation", () => {
  it("keeps mainnet read-only and blocks a disconnected or wrong-network wallet", () => {
    expect(preflight("mainnet", { account: OWNER, chainId: 31612 })).toEqual({ kind: "mainnet-disabled" })
    expect(preflight("testnet", { account: null, chainId: null })).toEqual({ kind: "disconnected" })
    expect(preflight("testnet", { account: OWNER, chainId: 31612 })).toEqual({ kind: "wrong-network", chainId: 31612 })
    expect(preflight("testnet", { account: OWNER, chainId: TESTNET_CHAIN_ID })).toBeNull()
  })

  it("invalidates a prepared vote when the account, chain, clock or window changes", () => {
    const p = prepared()
    expect(invalidationReason(p, { account: OWNER, chainId: TESTNET_CHAIN_ID }, NOW)).toBeNull()
    expect(invalidationReason(p, { account: OTHER, chainId: TESTNET_CHAIN_ID }, NOW)).toMatch(/account changed/)
    expect(invalidationReason(p, { account: OWNER, chainId: 31612 }, NOW)).toMatch(/network changed/)
    expect(invalidationReason(p, { account: OWNER, chainId: TESTNET_CHAIN_ID }, NOW + 120_000)).toMatch(/more than two minutes/)
    expect(invalidationReason(prepared({ voteEnd: String(NOW / 1000 - 1) }), { account: OWNER, chainId: TESTNET_CHAIN_ID }, NOW)).toMatch(/window/)
  })

  it("rejects tampered calls: calldata, contract, duplicates, gauge count", () => {
    expect(integrityProblem(prepared())).toBeNull()
    expect(integrityProblem(prepared({ weights: ["1", "2"] }))).toMatch(/calldata does not match/)
    expect(integrityProblem(prepared({ to: OTHER }))).toMatch(/verified BoostVoter/)
    const p = prepared()
    expect(integrityProblem({ ...p, gauges: [p.gauges[0] as string, p.gauges[0] as string] })).toMatch(/twice/)
    expect(integrityProblem({ ...p, recommendation: { ...p.recommendation, summary: p.recommendation.summary ? { ...p.recommendation.summary, maxGauges: 1 } : null } })).toMatch(/Too many/)
  })
})

describe("stage A: prepare never touches the wallet", () => {
  it("returns a reviewable prepared vote", async () => {
    const api = mockApi()
    const s = await prepareVote({ api }, { network: "testnet", tokenId: "924", strategy: "max-boosted-power", wallet: { account: OWNER, chainId: TESTNET_CHAIN_ID } })
    expect(s.kind).toBe("ready")
  })

  it("shows failed gates for an NFT the account does not own, does not exist, has no power or already voted", async () => {
    for (const [code, message] of [
      ["not-eligible", "veMEZO #924 is owned by 0xabc, not the connected account."],
      ["not-eligible", "This NFT has no voting power."],
      ["not-eligible", "This NFT already voted this epoch; BoostVoter allows one vote per epoch."],
      ["not-eligible", "The voting window for this epoch has closed."],
    ] as const) {
      const api = mockApi({ prepare: { ok: false, error: { code, message }, gates: [{ id: "owner-matches", label: "x", ok: false, detail: message }] } })
      const s = await prepareVote({ api }, { network: "testnet", tokenId: "924", strategy: "max-boosted-power", wallet: { account: OTHER, chainId: TESTNET_CHAIN_ID } })
      expect(s).toMatchObject({ kind: "ineligible", message })
    }
    const missing = mockApi({ prepare: { ok: false, error: { code: "token-not-found", message: "veMEZO #9 does not exist on Mezo Testnet." } } })
    expect(await prepareVote({ api: missing }, { network: "testnet", tokenId: "9", strategy: "max-boosted-power", wallet: { account: OWNER, chainId: TESTNET_CHAIN_ID } })).toMatchObject({ kind: "prepare-failed" })
  })

  it("does not call the server at all on mainnet or with the wallet on the wrong chain", async () => {
    const api = mockApi()
    expect(await prepareVote({ api }, { network: "mainnet", tokenId: "924", strategy: "max-boosted-power", wallet: { account: OWNER, chainId: 31612 } })).toEqual({ kind: "mainnet-disabled" })
    expect(await prepareVote({ api }, { network: "testnet", tokenId: "924", strategy: "max-boosted-power", wallet: { account: OWNER, chainId: 31612 } })).toMatchObject({ kind: "wrong-network" })
    expect(api.prepare).not.toHaveBeenCalled()
  })

  it("refuses a server answer prepared for another account or with mismatched calldata", async () => {
    const other = mockApi({ prepare: { ok: true, prepared: prepared({ account: OTHER }) } })
    expect(await prepareVote({ api: other }, { network: "testnet", tokenId: "924", strategy: "max-boosted-power", wallet: { account: OWNER, chainId: TESTNET_CHAIN_ID } })).toMatchObject({ kind: "prepare-failed" })
    const bad = mockApi({ prepare: { ok: true, prepared: prepared({ calldata: "0x7ac09bf7" }) } })
    expect(await prepareVote({ api: bad }, { network: "testnet", tokenId: "924", strategy: "max-boosted-power", wallet: { account: OWNER, chainId: TESTNET_CHAIN_ID } })).toMatchObject({ kind: "prepare-failed" })
  })
})

describe("stage B: submit, only from the final button", () => {
  it("re-simulates, asks the wallet exactly once, then waits for a real receipt and refreshes", async () => {
    const w = mockWallet()
    const api = mockApi({ receipts: [{ ok: true, status: "pending", blockNumber: null, gasUsed: null }, { ok: true, status: "success", blockNumber: "502", gasUsed: "21000" }] })
    const states: FlowState[] = []
    const final = await submitVote(deps(w, api, states), prepared())
    expect(final).toMatchObject({ kind: "confirmed", hash: HASH, blockNumber: "502" })
    expect(states.map((s) => s.kind)).toEqual(["checking", "awaiting-signature", "pending"])
    expect(w.calls.filter((c) => c === "eth_sendTransaction")).toHaveLength(1)
    expect(w.calls.at(-1)).toBe("eth_sendTransaction") // nothing touches the wallet after signing
    expect(api.simulate).toHaveBeenCalledWith({ network: "testnet", account: OWNER, to: prepared().to, data: prepared().calldata })
    expect(api.refresh).toHaveBeenCalledWith("testnet", "924")
  })

  it("does not ask the wallet to sign when the final simulation fails", async () => {
    const w = mockWallet()
    const api = mockApi({ simulate: { ok: false, error: { code: "revert:AlreadyVotedOrDeposited", message: "This NFT already voted this epoch." } } })
    expect(await submitVote(deps(w, api), prepared())).toMatchObject({ kind: "simulation-failed", message: "This NFT already voted this epoch." })
    expect(w.calls).not.toContain("eth_sendTransaction")
  })

  it("invalidates instead of signing when the account or chain changed after preparation", async () => {
    const switched = mockWallet({ account: OTHER })
    expect(await submitVote(deps(switched, mockApi()), prepared())).toMatchObject({ kind: "invalidated" })
    expect(switched.calls).not.toContain("eth_sendTransaction")
    const moved = mockWallet({ chainId: 31612 })
    expect(await submitVote(deps(moved, mockApi()), prepared())).toMatchObject({ kind: "invalidated" })
    expect(moved.calls).not.toContain("eth_sendTransaction")
  })

  it("invalidates when the chain changes during the final simulation", async () => {
    const w = mockWallet()
    const api = mockApi()
    api.simulate = vi.fn(async () => {
      w.setChain(31612)
      return { ok: true as const, blockNumber: "501", simulatedAt: "" }
    })
    expect(await submitVote(deps(w, api), prepared())).toMatchObject({ kind: "invalidated" })
    expect(w.calls).not.toContain("eth_sendTransaction")
  })

  it("reports a rejected wallet prompt and sends nothing else", async () => {
    const w = mockWallet({ sendError: { code: 4001, message: "User denied transaction signature." } })
    const api = mockApi()
    expect(await submitVote(deps(w, api), prepared())).toMatchObject({ kind: "rejected" })
    expect(api.receipt).not.toHaveBeenCalled()
  })

  it("reports a reverted transaction without refreshing as if it succeeded", async () => {
    const api = mockApi({ receipts: [{ ok: true, status: "reverted", blockNumber: "502", gasUsed: "30000" }] })
    expect(await submitVote(deps(mockWallet(), api), prepared())).toMatchObject({ kind: "reverted", blockNumber: "502" })
    expect(api.refresh).not.toHaveBeenCalled()
  })

  it("stops after repeated receipt failures and never resubmits", async () => {
    const w = mockWallet()
    const api = mockApi({ receipts: ["throw"] })
    expect(await submitVote(deps(w, api), prepared())).toMatchObject({ kind: "receipt-unknown", hash: HASH })
    expect(w.calls.filter((c) => c === "eth_sendTransaction")).toHaveLength(1)
  })

  it("keeps a confirmed vote confirmed when only the refresh fails", async () => {
    expect(await submitVote(deps(mockWallet(), mockApi({ refreshFails: true })), prepared())).toMatchObject({ kind: "refresh-failed", hash: HASH })
  })

  it("refuses an expired prepared vote", async () => {
    const w = mockWallet()
    expect(await submitVote({ ...deps(w, mockApi()), now: () => NOW + 121_000 }, prepared())).toMatchObject({ kind: "invalidated" })
    expect(w.calls).not.toContain("eth_sendTransaction")
  })
})

import { boostVoterAbi } from "@boost-relay/mezo/abis"
import { DEPLOYMENTS } from "@boost-relay/mezo/addresses"
import { encodeFunctionData, isAddress, isHash, type Address } from "viem"
import type { NetworkName } from "../market-dto"
import type { PrepareResponse, PreparedVote, ReceiptResponse, SimulateRequest, SimulateResponse, VoteGate } from "../vote-dto"
import { MAX_GAUGES_PER_CALL, VOTE_END_MARGIN_SECONDS } from "../vote-rules"
import { TESTNET_CHAIN_ID, readConnection } from "./actions"
import { USER_REJECTED, errorCode, errorMessage, toHexChainId, type Eip1193Provider } from "./eip1193"

export type FlowState =
  | { readonly kind: "idle" }
  | { readonly kind: "mainnet-disabled" }
  | { readonly kind: "disconnected" }
  | { readonly kind: "wrong-network"; readonly chainId: number }
  | { readonly kind: "preparing" }
  | { readonly kind: "ineligible"; readonly message: string; readonly gates: readonly VoteGate[] }
  | { readonly kind: "prepare-failed"; readonly message: string }
  | { readonly kind: "ready"; readonly prepared: PreparedVote }
  | { readonly kind: "invalidated"; readonly reason: string }
  | { readonly kind: "checking"; readonly prepared: PreparedVote }
  | { readonly kind: "simulation-failed"; readonly prepared: PreparedVote; readonly message: string }
  | { readonly kind: "awaiting-signature"; readonly prepared: PreparedVote }
  | { readonly kind: "rejected"; readonly prepared: PreparedVote }
  | { readonly kind: "submit-failed"; readonly message: string }
  | { readonly kind: "pending"; readonly prepared: PreparedVote; readonly hash: string }
  | { readonly kind: "reverted"; readonly prepared: PreparedVote; readonly hash: string; readonly blockNumber: string | null }
  | { readonly kind: "receipt-unknown"; readonly prepared: PreparedVote; readonly hash: string; readonly message: string }
  /** The wallet returned a hash whose mined transaction is not the reviewed vote. Never shown as a vote. */
  | { readonly kind: "mismatch"; readonly prepared: PreparedVote; readonly hash: string; readonly message: string }
  | { readonly kind: "confirmed"; readonly prepared: PreparedVote; readonly hash: string; readonly blockNumber: string | null }
  | { readonly kind: "refresh-failed"; readonly prepared: PreparedVote; readonly hash: string; readonly blockNumber: string | null; readonly message: string }

export interface VoteApi {
  prepare(input: { network: NetworkName; tokenId: string; strategy: string; account: string }): Promise<PrepareResponse>
  simulate(request: SimulateRequest): Promise<SimulateResponse>
  receipt(network: NetworkName, hash: string): Promise<ReceiptResponse>
  /** Re-reads the NFT, its allocation and the market after a confirmed vote. Throws on failure. */
  refresh(network: NetworkName, tokenId: string): Promise<void>
}

export interface WalletSnapshot {
  readonly account: string | null
  readonly chainId: number | null
}

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
const UINT = /^(0|[1-9]\d{0,77})$/

/** What blocks voting before anything is prepared: mainnet, no wallet, or the wallet on another chain. */
export function preflight(network: NetworkName, wallet: WalletSnapshot): FlowState | null {
  if (network !== "testnet") return { kind: "mainnet-disabled" }
  if (wallet.account === null || wallet.chainId === null) return { kind: "disconnected" }
  if (wallet.chainId !== TESTNET_CHAIN_ID) return { kind: "wrong-network", chainId: wallet.chainId }
  return null
}

/** Why a prepared vote can no longer be used, or null if it still matches the wallet and the clock. */
export function invalidationReason(prepared: PreparedVote, wallet: WalletSnapshot, nowMs: number): string | null {
  if (wallet.account === null || wallet.chainId === null) return "The wallet disconnected after the vote was prepared."
  if (!same(wallet.account, prepared.account)) return "The connected account changed after the vote was prepared."
  if (wallet.chainId !== prepared.chainId) return "The wallet's network changed after the vote was prepared."
  const expires = Date.parse(prepared.expiresAt)
  if (!Number.isFinite(expires) || nowMs >= expires) return "The prepared vote is more than two minutes old. Prepare it again with fresh data."
  if (!UINT.test(prepared.voteEnd)) return "The prepared vote has no valid voting deadline."
  // Same margin the server applies: no signing in the last minutes of the window.
  if (BigInt(Math.floor(nowMs / 1000)) >= BigInt(prepared.voteEnd) - BigInt(VOTE_END_MARGIN_SECONDS)) return "The voting window for this epoch is closing or closed."
  return null
}

/**
 * Re-checks a server-prepared vote in the browser: shape, target, chain, gauges and weights, then
 * re-encodes the call with the verified ABI and requires it to equal the calldata that will be sent.
 * Any malformed field fails closed with a message instead of throwing.
 */
export function integrityProblem(prepared: PreparedVote): string | null {
  try {
    const boostVoter = DEPLOYMENTS.testnet.contracts.boostVoter
    if (prepared.network !== "testnet" || prepared.chainId !== TESTNET_CHAIN_ID) return "The prepared vote is not for Mezo Testnet."
    if (prepared.functionName !== "vote") return "The prepared call is not BoostVoter.vote()."
    if (typeof prepared.to !== "string" || !same(prepared.to, boostVoter)) return "The prepared vote does not target the verified BoostVoter contract."
    if (typeof prepared.account !== "string" || !isAddress(prepared.account, { strict: false })) return "The prepared vote has no valid account."
    if (typeof prepared.tokenId !== "string" || !UINT.test(prepared.tokenId) || prepared.tokenId === "0") return "The prepared vote has no valid token id."
    if (!Array.isArray(prepared.gauges) || !Array.isArray(prepared.weights)) return "The prepared vote has no gauge list."
    if (prepared.gauges.length === 0 || prepared.gauges.length !== prepared.weights.length) return "Gauge and weight lists are empty or differ in length."
    if (prepared.gauges.some((g) => typeof g !== "string" || !isAddress(g, { strict: false }))) return "A gauge is not a valid address."
    if (new Set(prepared.gauges.map((g) => g.toLowerCase())).size !== prepared.gauges.length) return "A gauge appears twice."
    const max = prepared.recommendation?.summary?.maxGauges
    if (typeof max !== "number" || prepared.gauges.length > Math.min(max, MAX_GAUGES_PER_CALL)) return "Too many gauges for one vote."
    if (prepared.weights.some((w) => typeof w !== "string" || !UINT.test(w) || w === "0")) return "Every weight must be a positive whole number."
    if (typeof prepared.calldata !== "string" || !/^0x[0-9a-fA-F]+$/.test(prepared.calldata)) return "The prepared vote has no calldata."
    const encoded = encodeFunctionData({
      abi: boostVoterAbi,
      functionName: "vote",
      args: [BigInt(prepared.tokenId), prepared.gauges as Address[], prepared.weights.map((w) => BigInt(w))],
    })
    if (encoded.toLowerCase() !== prepared.calldata.toLowerCase()) return "The calldata does not match the reviewed gauges and weights."
    return null
  } catch {
    return "The prepared vote could not be checked, so it cannot be used."
  }
}

/** Stage A: fetch fresh data, recompute, gate and simulate on the server. Never touches the wallet. */
export async function prepareVote(
  deps: { readonly api: VoteApi },
  input: { readonly network: NetworkName; readonly tokenId: string; readonly strategy: string; readonly wallet: WalletSnapshot },
): Promise<FlowState> {
  const blocked = preflight(input.network, input.wallet)
  if (blocked !== null) return blocked
  const account = input.wallet.account as string
  let res: PrepareResponse
  try {
    res = await deps.api.prepare({ network: input.network, tokenId: input.tokenId, strategy: input.strategy, account })
  } catch {
    return { kind: "prepare-failed", message: "Could not reach the Boost Relay server. Nothing was sent." }
  }
  if (typeof res !== "object" || res === null) return { kind: "prepare-failed", message: "The server sent an unreadable answer. Nothing was sent." }
  if (!res.ok) {
    const message = typeof res.error?.message === "string" ? res.error.message : "The vote could not be prepared."
    return Array.isArray(res.gates) ? { kind: "ineligible", message, gates: res.gates } : { kind: "prepare-failed", message }
  }
  const p = res.prepared
  if (typeof p !== "object" || p === null) return { kind: "prepare-failed", message: "The server sent no prepared vote." }
  // The server's answer must be for exactly what this page asked: same account, token and strategy.
  if (typeof p.account !== "string" || !same(p.account, account)) return { kind: "prepare-failed", message: "The server prepared the vote for a different account." }
  if (p.tokenId !== input.tokenId) return { kind: "prepare-failed", message: "The server prepared a vote for a different NFT." }
  if (p.strategy !== input.strategy) return { kind: "prepare-failed", message: "The server prepared a vote with a different strategy." }
  const problem = integrityProblem(p)
  if (problem !== null) return { kind: "prepare-failed", message: problem }
  return { kind: "ready", prepared: p }
}

/** What a sent vote must look like on chain. */
export interface ExpectedTransaction {
  readonly account: string
  readonly to: string
  readonly calldata: string
}

/**
 * Classifies a receipt for an expected transaction. "success" and "reverted" are only returned when the
 * mined transaction is from the reviewed account, to BoostVoter, with exactly the reviewed calldata.
 */
export function matchReceipt(expected: ExpectedTransaction, r: Extract<ReceiptResponse, { ok: true }>): "pending" | "mismatch" | "reverted" | "success" {
  if (r.status === "pending") return "pending"
  const tx = r.transaction
  if (tx === null || typeof tx !== "object") return "pending"
  const matches =
    typeof tx.from === "string" &&
    same(tx.from, expected.account) &&
    typeof tx.to === "string" &&
    same(tx.to, expected.to) &&
    typeof tx.input === "string" &&
    same(tx.input, expected.calldata)
  if (!matches) return "mismatch"
  return r.status === "reverted" ? "reverted" : "success"
}

/** The flow state a receipt leads to for a prepared vote, or "pending" to keep waiting. */
export function receiptOutcome(prepared: PreparedVote, hash: string, r: Extract<ReceiptResponse, { ok: true }>): FlowState | "pending" {
  const result = matchReceipt(prepared, r)
  if (result === "pending") return "pending"
  if (result === "mismatch") {
    return {
      kind: "mismatch",
      prepared,
      hash,
      message: "The transaction your wallet returned is not the vote you reviewed (different sender, contract or data). It is not counted as your vote.",
    }
  }
  if (result === "reverted") return { kind: "reverted", prepared, hash, blockNumber: r.blockNumber }
  return { kind: "confirmed", prepared, hash, blockNumber: r.blockNumber }
}

export interface SubmitDeps {
  readonly provider: Eip1193Provider
  readonly api: VoteApi
  readonly now: () => number
  readonly sleep: (ms: number) => Promise<void>
  readonly onState: (s: FlowState) => void
  readonly pollIntervalMs?: number
  readonly maxPolls?: number
  readonly maxConsecutiveErrors?: number
}

/** Prepared votes currently being submitted, and those that already produced a transaction hash. */
const inFlight = new WeakSet<PreparedVote>()
const sent = new WeakSet<PreparedVote>()

/**
 * Stage B, run only from the "Sign & Submit Vote" click. Re-verifies the wallet, re-simulates the
 * exact calldata, asks the wallet to sign once, then waits for a real receipt. It never resubmits:
 * a prepared vote that is already being submitted, or already produced a hash, is refused.
 */
export async function submitVote(deps: SubmitDeps, prepared: PreparedVote): Promise<FlowState> {
  if (sent.has(prepared)) return { kind: "invalidated", reason: "This prepared vote was already sent. Prepare a new one only after the first has a receipt." }
  if (inFlight.has(prepared)) return { kind: "invalidated", reason: "This vote is already being submitted." }
  inFlight.add(prepared)
  try {
    return await submitOnce(deps, prepared)
  } finally {
    inFlight.delete(prepared)
  }
}

async function submitOnce(deps: SubmitDeps, prepared: PreparedVote): Promise<FlowState> {
  let live: WalletSnapshot
  try {
    live = (await readConnection(deps.provider)) ?? { account: null, chainId: null }
  } catch (error) {
    return { kind: "submit-failed", message: `Could not read the wallet: ${errorMessage(error)}` }
  }
  const stale = invalidationReason(prepared, live, deps.now())
  if (stale !== null) return { kind: "invalidated", reason: stale }
  const problem = integrityProblem(prepared)
  if (problem !== null) return { kind: "invalidated", reason: problem }

  deps.onState({ kind: "checking", prepared })
  let sim: SimulateResponse
  try {
    sim = await deps.api.simulate({ network: prepared.network, account: live.account as string, to: prepared.to, data: prepared.calldata })
  } catch {
    return { kind: "simulation-failed", prepared, message: "The simulation could not reach the server, so nothing was sent." }
  }
  if (typeof sim !== "object" || sim === null || sim.ok !== true) {
    const message = sim && sim.ok === false && typeof sim.error?.message === "string" ? sim.error.message : "The final simulation did not pass."
    return { kind: "simulation-failed", prepared, message }
  }

  // The wallet could have changed while simulating, and the clock moved on.
  const again = (await readConnection(deps.provider).catch(() => null)) ?? { account: null, chainId: null }
  const changed = invalidationReason(prepared, again, deps.now())
  if (changed !== null) return { kind: "invalidated", reason: changed }

  deps.onState({ kind: "awaiting-signature", prepared })
  let hash: unknown
  try {
    // chainId lets wallets that check it (e.g. MetaMask) refuse to sign on any other network.
    hash = await deps.provider.request({
      method: "eth_sendTransaction",
      params: [{ from: again.account, to: prepared.to, data: prepared.calldata, value: "0x0", chainId: toHexChainId(prepared.chainId) }],
    })
  } catch (error) {
    if (errorCode(error) === USER_REJECTED) return { kind: "rejected", prepared }
    // Unknown wallet failure: it may or may not have broadcast, so this prepared vote is never offered again.
    sent.add(prepared)
    return { kind: "submit-failed", message: `The wallet did not confirm sending the transaction: ${errorMessage(error)} Check your wallet's activity before trying again.` }
  }
  sent.add(prepared)
  if (typeof hash !== "string" || !isHash(hash)) return { kind: "submit-failed", message: "The wallet returned no transaction hash. Check your wallet's activity before trying again." }

  deps.onState({ kind: "pending", prepared, hash })
  const interval = deps.pollIntervalMs ?? 3_000
  const maxPolls = deps.maxPolls ?? 60
  const maxErrors = deps.maxConsecutiveErrors ?? 5
  let errors = 0
  for (let i = 0; i < maxPolls; i++) {
    await deps.sleep(interval)
    const r = await deps.api.receipt(prepared.network, hash).catch(() => null)
    if (r === null || typeof r !== "object" || r.ok !== true) {
      errors++
      if (errors >= maxErrors) return { kind: "receipt-unknown", prepared, hash, message: "The receipt could not be read. Check the explorer; do not send the vote again." }
      continue
    }
    errors = 0
    const outcome = receiptOutcome(prepared, hash, r)
    if (outcome === "pending") continue
    if (outcome.kind !== "confirmed") return outcome
    try {
      await deps.api.refresh(prepared.network, prepared.tokenId)
      return outcome
    } catch (error) {
      return { kind: "refresh-failed", prepared, hash, blockNumber: outcome.blockNumber, message: errorMessage(error) }
    }
  }
  return { kind: "receipt-unknown", prepared, hash, message: "No receipt yet. The transaction may still confirm; check the explorer and do not send it again." }
}

/** fetch-based VoteApi for the browser. All requests are same-origin and read-only. */
export function httpVoteApi(refresh: VoteApi["refresh"]): VoteApi {
  return {
    async prepare(input) {
      const q = new URLSearchParams({ network: input.network, tokenId: input.tokenId, strategy: input.strategy, account: input.account })
      return (await (await fetch(`/api/vote/prepare?${q.toString()}`, { cache: "no-store" })).json()) as PrepareResponse
    },
    async simulate(request) {
      const res = await fetch("/api/vote/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), cache: "no-store" })
      return (await res.json()) as SimulateResponse
    },
    async receipt(network, hash) {
      const q = new URLSearchParams({ network, hash })
      return (await (await fetch(`/api/vote/receipt?${q.toString()}`, { cache: "no-store" })).json()) as ReceiptResponse
    },
    refresh,
  }
}

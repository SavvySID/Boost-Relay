import { boostVoterAbi } from "@boost-relay/mezo/abis"
import { DEPLOYMENTS } from "@boost-relay/mezo/addresses"
import { encodeFunctionData, isHash, type Address } from "viem"
import type { NetworkName } from "../market-dto"
import type { PrepareResponse, PreparedVote, ReceiptResponse, SimulateRequest, SimulateResponse, VoteGate } from "../vote-dto"
import { TESTNET_CHAIN_ID, readConnection } from "./actions"
import { USER_REJECTED, errorCode, errorMessage, type Eip1193Provider } from "./eip1193"

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
  if (nowMs >= Date.parse(prepared.expiresAt)) return "The prepared vote is more than two minutes old. Prepare it again with fresh data."
  if (BigInt(Math.floor(nowMs / 1000)) >= BigInt(prepared.voteEnd)) return "The voting window for this epoch has closed."
  return null
}

/** Re-encodes the call with the verified ABI and checks it against what the user reviewed. */
export function integrityProblem(prepared: PreparedVote): string | null {
  const boostVoter = DEPLOYMENTS.testnet.contracts.boostVoter
  if (prepared.network !== "testnet" || prepared.chainId !== TESTNET_CHAIN_ID) return "The prepared vote is not for Mezo Testnet."
  if (!same(prepared.to, boostVoter)) return "The prepared vote does not target the verified BoostVoter contract."
  if (prepared.gauges.length === 0 || prepared.gauges.length !== prepared.weights.length) return "Gauge and weight lists are empty or differ in length."
  if (new Set(prepared.gauges.map((g) => g.toLowerCase())).size !== prepared.gauges.length) return "A gauge appears twice."
  const max = prepared.recommendation.summary?.maxGauges
  if (max === undefined || prepared.gauges.length > max) return "Too many gauges for one vote."
  if (prepared.weights.some((w) => BigInt(w) <= 0n)) return "Every weight must be positive."
  const encoded = encodeFunctionData({
    abi: boostVoterAbi,
    functionName: "vote",
    args: [BigInt(prepared.tokenId), prepared.gauges as Address[], prepared.weights.map((w) => BigInt(w))],
  })
  if (encoded.toLowerCase() !== prepared.calldata.toLowerCase()) return "The calldata does not match the reviewed gauges and weights."
  return null
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
  if (!res.ok) return res.gates ? { kind: "ineligible", message: res.error.message, gates: res.gates } : { kind: "prepare-failed", message: res.error.message }
  if (!same(res.prepared.account, account)) return { kind: "prepare-failed", message: "The server prepared the vote for a different account." }
  const problem = integrityProblem(res.prepared)
  if (problem !== null) return { kind: "prepare-failed", message: problem }
  return { kind: "ready", prepared: res.prepared }
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

/**
 * Stage B, run only from the "Sign & Submit Vote" click. Re-verifies the wallet, re-simulates the
 * exact calldata, asks the wallet to sign once, then waits for a real receipt. It never resubmits.
 */
export async function submitVote(deps: SubmitDeps, prepared: PreparedVote): Promise<FlowState> {
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
  if (!sim.ok) return { kind: "simulation-failed", prepared, message: sim.error.message }

  // The wallet could have changed while simulating.
  const again = (await readConnection(deps.provider).catch(() => null)) ?? { account: null, chainId: null }
  const changed = invalidationReason(prepared, again, deps.now())
  if (changed !== null) return { kind: "invalidated", reason: changed }

  deps.onState({ kind: "awaiting-signature", prepared })
  let hash: unknown
  try {
    hash = await deps.provider.request({ method: "eth_sendTransaction", params: [{ from: again.account, to: prepared.to, data: prepared.calldata }] })
  } catch (error) {
    if (errorCode(error) === USER_REJECTED) return { kind: "rejected", prepared }
    return { kind: "submit-failed", message: `The wallet did not send the transaction: ${errorMessage(error)}` }
  }
  if (typeof hash !== "string" || !isHash(hash)) return { kind: "submit-failed", message: "The wallet returned no transaction hash." }

  deps.onState({ kind: "pending", prepared, hash })
  const interval = deps.pollIntervalMs ?? 3_000
  const maxPolls = deps.maxPolls ?? 60
  const maxErrors = deps.maxConsecutiveErrors ?? 5
  let errors = 0
  for (let i = 0; i < maxPolls; i++) {
    await deps.sleep(interval)
    const r = await deps.api.receipt(prepared.network, hash).catch(() => null)
    if (r === null || !r.ok) {
      errors++
      if (errors >= maxErrors) return { kind: "receipt-unknown", prepared, hash, message: "The receipt could not be read. Check the explorer; do not send the vote again." }
      continue
    }
    errors = 0
    if (r.status === "pending") continue
    if (r.status === "reverted") return { kind: "reverted", prepared, hash, blockNumber: r.blockNumber }
    try {
      await deps.api.refresh(prepared.network, prepared.tokenId)
      return { kind: "confirmed", prepared, hash, blockNumber: r.blockNumber }
    } catch (error) {
      return { kind: "refresh-failed", prepared, hash, blockNumber: r.blockNumber, message: errorMessage(error) }
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
      return (await (await fetch(`/api/vote/receipt?network=${network}&hash=${hash}`, { cache: "no-store" })).json()) as ReceiptResponse
    },
    refresh,
  }
}

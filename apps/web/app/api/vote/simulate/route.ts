import { NotFoundError } from "@boost-relay/mezo"
import { NextResponse } from "next/server"
import { NO_STORE, fail, parseAddress, parseNetwork, rateLimited, readJsonBody, rejectCrossSite } from "@/lib/server/request-guards"
import { simulateVote } from "@/lib/server/vote-service"
import type { SimulateResponse } from "@/lib/vote-dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/** 4-byte selector plus at most a few KB of ABI-encoded arguments. */
const CALLDATA = /^0x[0-9a-fA-F]{8,8192}$/

/**
 * Read-only eth_call of the exact BoostVoter.vote() calldata as the connected account, at the latest
 * block. POST only because the calldata is long; nothing is signed, broadcast or stored.
 */
export async function POST(request: Request): Promise<NextResponse<SimulateResponse>> {
  const blocked = rejectCrossSite(request) ?? rateLimited("simulate", request)
  if (blocked !== null) return blocked
  const read = await readJsonBody(request)
  if (!read.ok) return read.response
  const b = read.body
  const network = parseNetwork(typeof b["network"] === "string" ? b["network"] : null)
  if (network === null) return fail(400, "invalid-network", 'Choose network "mainnet" or "testnet".')
  if (network !== "testnet") return fail(403, "mainnet-disabled", "Voting is disabled on mainnet during the testnet beta.")
  const account = parseAddress(b["account"])
  const to = parseAddress(b["to"])
  if (account === null || to === null) return fail(400, "bad-request", "account and to must be addresses.")
  if (typeof b["data"] !== "string" || !CALLDATA.test(b["data"]) || b["data"].length % 2 !== 0) return fail(400, "bad-calldata", "data must be hex-encoded vote() calldata.")
  try {
    const result = await simulateVote({ network, account, to, data: b["data"] })
    const status = result.ok ? 200 : ["wrong-contract", "wrong-function", "bad-calldata", "bad-arguments", "invalid-account"].includes(result.error.code) ? 400 : 200
    return NextResponse.json(result, { status, headers: NO_STORE })
  } catch (error) {
    if (error instanceof NotFoundError) return fail(404, "token-not-found", "That veMEZO NFT does not exist on Mezo Testnet.")
    console.error("[api/vote/simulate] failed", error)
    return fail(502, "simulation-unavailable", "The simulation could not reach the Mezo Testnet RPC. Nothing was sent.")
  }
}

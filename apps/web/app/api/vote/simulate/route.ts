import { NotFoundError } from "@boost-relay/mezo"
import { NextResponse } from "next/server"
import { simulateVote } from "@/lib/server/vote-service"
import type { SimulateResponse } from "@/lib/vote-dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const noStore = { "Cache-Control": "no-store" }

/**
 * Read-only eth_call of the exact BoostVoter.vote() calldata as the connected account, at the latest
 * block. POST only because the calldata is long; nothing is signed, broadcast or stored.
 */
export async function POST(request: Request): Promise<NextResponse<SimulateResponse>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: { code: "bad-request", message: "Expected a JSON body." } }, { status: 400, headers: noStore })
  }
  const b = body as Record<string, unknown>
  if (typeof b["network"] !== "string" || typeof b["account"] !== "string" || typeof b["to"] !== "string" || typeof b["data"] !== "string" || !/^0x[0-9a-fA-F]*$/.test(b["data"])) {
    return NextResponse.json({ ok: false, error: { code: "bad-request", message: "network, account, to and data are required." } }, { status: 400, headers: noStore })
  }
  try {
    const result = await simulateVote({ network: b["network"], account: b["account"], to: b["to"], data: b["data"] })
    return NextResponse.json(result, { headers: noStore })
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ ok: false, error: { code: "token-not-found", message: "That veMEZO NFT does not exist on Mezo Testnet." } }, { status: 404, headers: noStore })
    console.error("[api/vote/simulate] failed", error)
    return NextResponse.json({ ok: false, error: { code: "simulation-unavailable", message: "The simulation could not reach the Mezo Testnet RPC. Nothing was sent." } }, { status: 502, headers: noStore })
  }
}

import { NotFoundError, isNetworkName } from "@boost-relay/mezo"
import { NextResponse } from "next/server"
import { describeError } from "@/lib/server/market-service"
import { prepareVote } from "@/lib/server/vote-service"
import type { PrepareResponse } from "@/lib/vote-dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

const noStore = { "Cache-Control": "no-store" }
const STRATEGIES = new Set(["max-boosted-power", "max-capped-positions"])

/**
 * Read-only: prepares and simulates a vote for the connected account. It never signs or sends;
 * only the user's wallet can do that, after an explicit click in the browser.
 */
export async function GET(request: Request): Promise<NextResponse<PrepareResponse>> {
  const url = new URL(request.url)
  const network = url.searchParams.get("network")
  const rawToken = (url.searchParams.get("tokenId") ?? "").trim()
  const strategy = url.searchParams.get("strategy") ?? ""
  const account = url.searchParams.get("account") ?? ""
  if (!isNetworkName(network)) return NextResponse.json({ ok: false, error: { code: "invalid-network", message: 'Choose network "mainnet" or "testnet".' } }, { status: 400, headers: noStore })
  if (!/^\d{1,30}$/.test(rawToken) || BigInt(rawToken) === 0n) return NextResponse.json({ ok: false, error: { code: "invalid-token", message: "Enter a whole-number veMEZO token id." } }, { status: 400, headers: noStore })
  if (!STRATEGIES.has(strategy)) return NextResponse.json({ ok: false, error: { code: "invalid-strategy", message: "Unknown strategy." } }, { status: 400, headers: noStore })
  const tokenId = BigInt(rawToken)
  try {
    const result = await prepareVote({ network, tokenId, strategy: strategy as "max-boosted-power" | "max-capped-positions", account })
    return NextResponse.json(result, { status: result.ok ? 200 : result.error.code === "mainnet-disabled" ? 403 : 200, headers: noStore })
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ ok: false, error: { code: "token-not-found", message: `veMEZO #${tokenId} does not exist on Mezo Testnet.` } }, { status: 404, headers: noStore })
    console.error(`[api/vote/prepare] #${tokenId} failed`, error)
    return NextResponse.json({ ok: false, error: describeError(error, network) }, { status: 502, headers: noStore })
  }
}

import { NextResponse } from "next/server"
import { NO_STORE, fail, parseNetwork, parseTxHash, rateLimited, rejectCrossSite } from "@/lib/server/request-guards"
import { readReceipt } from "@/lib/server/vote-service"
import type { ReceiptResponse } from "@/lib/vote-dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Read-only receipt lookup for a transaction the user's wallet already broadcast. */
export async function GET(request: Request): Promise<NextResponse<ReceiptResponse>> {
  const blocked = rejectCrossSite(request) ?? rateLimited("receipt", request)
  if (blocked !== null) return blocked
  const url = new URL(request.url)
  const network = parseNetwork(url.searchParams.get("network"))
  if (network === null) return fail(400, "invalid-network", 'Choose network "mainnet" or "testnet".')
  if (network !== "testnet") return fail(403, "mainnet-disabled", "Receipts are tracked on testnet only during the beta.")
  const hash = parseTxHash(url.searchParams.get("hash"))
  if (hash === null) return fail(400, "bad-hash", "Not a transaction hash.")
  const result = await readReceipt(network, hash)
  return NextResponse.json(result, { status: result.ok ? 200 : 502, headers: NO_STORE })
}

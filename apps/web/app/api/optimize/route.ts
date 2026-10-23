import { NextResponse } from "next/server"
import type { OptimizerResponse } from "@/lib/optimizer-dto"
import { describeOptimizerError, getRecommendation } from "@/lib/server/optimizer-service"
import { NO_STORE, fail, parseNetwork, parseTokenId, rateLimited } from "@/lib/server/request-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

/** Read-only: computes vote recommendations for any veMEZO NFT. It never signs or sends a transaction. */
export async function GET(request: Request): Promise<NextResponse<OptimizerResponse>> {
  const limited = rateLimited("optimize", request)
  if (limited !== null) return limited
  const url = new URL(request.url)
  const network = parseNetwork(url.searchParams.get("network"))
  if (network === null) return fail(400, "invalid-network", 'Choose network "mainnet" or "testnet".')
  const tokenId = parseTokenId(url.searchParams.get("tokenId"))
  if (tokenId === null) return fail(400, "invalid-token", "Enter a veMEZO token id: a whole number such as 1024.")
  try {
    const { result, source } = await getRecommendation(network, tokenId, { fresh: url.searchParams.get("fresh") === "1" })
    return NextResponse.json({ ok: true, data: result.dto, served: { source, computedAt: new Date(result.computedAt).toISOString() } }, { headers: NO_STORE })
  } catch (error) {
    const d = describeOptimizerError(error, network, tokenId)
    if (d.status >= 500) console.error(`[api/optimize] ${network} #${tokenId} failed`, error)
    return NextResponse.json({ ok: false, error: { code: d.code, message: d.message } }, { status: d.status, headers: NO_STORE })
  }
}

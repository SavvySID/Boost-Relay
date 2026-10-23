import { isNetworkName } from "@boost-relay/mezo"
import { NextResponse } from "next/server"
import type { OptimizerResponse } from "@/lib/optimizer-dto"
import { describeOptimizerError, getRecommendation } from "@/lib/server/optimizer-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

const noStore = { "Cache-Control": "no-store" }

/** Read-only: computes vote recommendations for a veMEZO NFT. It never signs or sends a transaction. */
export async function GET(request: Request): Promise<NextResponse<OptimizerResponse>> {
  const url = new URL(request.url)
  const network = url.searchParams.get("network")
  const raw = (url.searchParams.get("tokenId") ?? "").trim().replace(/^#/, "")
  if (!isNetworkName(network)) {
    return NextResponse.json({ ok: false, error: { code: "invalid-network", message: 'Choose network "mainnet" or "testnet".' } }, { status: 400, headers: noStore })
  }
  if (!/^\d{1,30}$/.test(raw) || BigInt(raw) === 0n) {
    return NextResponse.json({ ok: false, error: { code: "invalid-token", message: "Enter a veMEZO token id: a whole number such as 1024." } }, { status: 400, headers: noStore })
  }
  const tokenId = BigInt(raw)
  try {
    const { result, source } = await getRecommendation(network, tokenId, { fresh: url.searchParams.get("fresh") === "1" })
    return NextResponse.json({ ok: true, data: result.dto, served: { source, computedAt: new Date(result.computedAt).toISOString() } }, { headers: noStore })
  } catch (error) {
    const d = describeOptimizerError(error, network, tokenId)
    if (d.status >= 500) console.error(`[api/optimize] ${network} #${tokenId} failed`, error)
    return NextResponse.json({ ok: false, error: { code: d.code, message: d.message } }, { status: d.status, headers: noStore })
  }
}

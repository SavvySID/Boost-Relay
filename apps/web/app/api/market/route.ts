import { isNetworkName } from "@boost-relay/mezo"
import { NextResponse } from "next/server"
import type { MarketResponse } from "@/lib/market-dto"
import { describeError, getMarket } from "@/lib/server/market-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// A cold mainnet snapshot scans every veBTC id; allow time for slow public RPCs.
export const maxDuration = 120

const noStore = { "Cache-Control": "no-store" }

export async function GET(request: Request): Promise<NextResponse<MarketResponse>> {
  const url = new URL(request.url)
  const network = url.searchParams.get("network")
  if (!isNetworkName(network)) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid-network", message: 'Choose network "mainnet" or "testnet".' } },
      { status: 400, headers: noStore },
    )
  }
  try {
    const { entry, source } = await getMarket(network, { refresh: url.searchParams.get("refresh") === "1" })
    return NextResponse.json(
      { ok: true, data: entry.dto, served: { source, cachedAt: new Date(entry.cachedAt).toISOString(), durationMs: entry.durationMs } },
      { headers: noStore },
    )
  } catch (error) {
    console.error(`[api/market] ${network} snapshot failed`, error)
    return NextResponse.json({ ok: false, error: describeError(error, network) }, { status: 502, headers: noStore })
  }
}

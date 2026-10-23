import { NextResponse } from "next/server"
import type { MarketResponse } from "@/lib/market-dto"
import { describeError, getMarket } from "@/lib/server/market-service"
import { NO_STORE, fail, parseNetwork, rateLimited } from "@/lib/server/request-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// A cold mainnet snapshot scans every veBTC id; allow time for slow public RPCs.
export const maxDuration = 120

/** Public, read-only market data. Refreshes are throttled per network inside the market service. */
export async function GET(request: Request): Promise<NextResponse<MarketResponse>> {
  const limited = rateLimited("market", request)
  if (limited !== null) return limited
  const url = new URL(request.url)
  const network = parseNetwork(url.searchParams.get("network"))
  if (network === null) return fail(400, "invalid-network", 'Choose network "mainnet" or "testnet".')
  try {
    const { entry, source } = await getMarket(network, { refresh: url.searchParams.get("refresh") === "1" })
    return NextResponse.json(
      { ok: true, data: entry.dto, served: { source, cachedAt: new Date(entry.cachedAt).toISOString(), durationMs: entry.durationMs } },
      { headers: NO_STORE },
    )
  } catch (error) {
    console.error(`[api/market] ${network} snapshot failed`, error)
    return NextResponse.json({ ok: false, error: describeError(error, network) }, { status: 502, headers: NO_STORE })
  }
}

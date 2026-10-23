import { NextResponse } from "next/server"
import { readReceipt } from "@/lib/server/vote-service"
import type { ReceiptResponse } from "@/lib/vote-dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Read-only receipt lookup for a transaction the user's wallet already broadcast. */
export async function GET(request: Request): Promise<NextResponse<ReceiptResponse>> {
  const url = new URL(request.url)
  const result = await readReceipt(url.searchParams.get("network") ?? "", url.searchParams.get("hash") ?? "")
  const status = result.ok ? 200 : result.error.code === "receipt-unavailable" ? 502 : 400
  return NextResponse.json(result, { status, headers: { "Cache-Control": "no-store" } })
}

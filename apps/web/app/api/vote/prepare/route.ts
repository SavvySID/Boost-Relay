import { NotFoundError } from "@boost-relay/mezo"
import { NextResponse } from "next/server"
import { describeError } from "@/lib/server/market-service"
import { NO_STORE, fail, parseAddress, parseNetwork, parseStrategy, parseTokenId, rateLimited, rejectCrossSite } from "@/lib/server/request-guards"
import { prepareVote } from "@/lib/server/vote-service"
import type { PrepareResponse } from "@/lib/vote-dto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

/** Status for each refusal: bad input 400, mainnet 403, ineligible 422 (with the gates), otherwise 200. */
const STATUS: Record<string, number> = { "mainnet-disabled": 403, "invalid-account": 400, "not-eligible": 422 }

/**
 * Read-only: prepares and simulates a vote for the connected account. It never signs or sends;
 * only the user's wallet can do that, after an explicit click in the browser. Ownership and
 * eligibility come from the chain, never from the request.
 */
export async function GET(request: Request): Promise<NextResponse<PrepareResponse>> {
  const blocked = rejectCrossSite(request) ?? rateLimited("prepare", request)
  if (blocked !== null) return blocked
  const url = new URL(request.url)
  const network = parseNetwork(url.searchParams.get("network"))
  if (network === null) return fail(400, "invalid-network", 'Choose network "mainnet" or "testnet".')
  const tokenId = parseTokenId(url.searchParams.get("tokenId"))
  if (tokenId === null) return fail(400, "invalid-token", "Enter a whole-number veMEZO token id.")
  const strategy = parseStrategy(url.searchParams.get("strategy"))
  if (strategy === null) return fail(400, "invalid-strategy", "Unknown strategy.")
  const account = parseAddress(url.searchParams.get("account"))
  if (account === null) return fail(400, "invalid-account", "The connected account is not a valid address.")
  try {
    const result = await prepareVote({ network, tokenId, strategy, account })
    return NextResponse.json(result, { status: result.ok ? 200 : (STATUS[result.error.code] ?? 200), headers: NO_STORE })
  } catch (error) {
    if (error instanceof NotFoundError) return fail(404, "token-not-found", `veMEZO #${tokenId} does not exist on Mezo Testnet.`)
    console.error(`[api/vote/prepare] #${tokenId} failed`, error)
    const d = describeError(error, network)
    return fail(502, d.code, d.message)
  }
}

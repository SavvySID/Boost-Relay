import { isNetworkName, type NetworkName } from "@boost-relay/mezo"
import { NextResponse } from "next/server"
import { isAddress, isHash } from "viem"

/**
 * Small, dependency-free guards shared by the API routes: strict input parsing, a body-size cap,
 * a same-site check for the vote endpoints and per-client rate limits for routes that spend RPC
 * calls. The rate limits live in this server process only, so they are best-effort: they stop a
 * single client from hammering one instance, not a distributed attack.
 */

export const NO_STORE = { "Cache-Control": "no-store" } as const

export interface ApiError {
  readonly ok: false
  readonly error: { readonly code: string; readonly message: string }
}

export function fail(status: number, code: string, message: string, headers: Record<string, string> = {}): NextResponse<ApiError> {
  return NextResponse.json({ ok: false, error: { code, message } }, { status, headers: { ...NO_STORE, ...headers } })
}

// ---- Input parsing ---------------------------------------------------------------------------------

/** veMEZO / veBTC ids are uint256; 30 digits is far above any real id and keeps BigInt work trivial. */
const TOKEN_ID = /^[1-9]\d{0,29}$/

export function parseNetwork(value: string | null): NetworkName | null {
  return isNetworkName(value) ? value : null
}

/** A positive whole-number token id, or null. Leading zeros, signs, decimals and hex are rejected. */
export function parseTokenId(value: string | null): bigint | null {
  const raw = (value ?? "").trim().replace(/^#/, "")
  return TOKEN_ID.test(raw) ? BigInt(raw) : null
}

/** A 20-byte hex address in any case. Comparisons are case-insensitive, so only the format matters. */
export function parseAddress(value: unknown): `0x${string}` | null {
  return typeof value === "string" && value.length === 42 && isAddress(value, { strict: false }) ? (value as `0x${string}`) : null
}

export function parseTxHash(value: string | null): `0x${string}` | null {
  return value !== null && isHash(value) ? value : null
}

export const STRATEGY_IDS = ["max-boosted-power", "max-capped-positions"] as const
export type StrategyParam = (typeof STRATEGY_IDS)[number]

export function parseStrategy(value: string | null): StrategyParam | null {
  return (STRATEGY_IDS as readonly string[]).includes(value ?? "") ? (value as StrategyParam) : null
}

// ---- Request body ----------------------------------------------------------------------------------

/** Largest JSON body any route accepts. A 30-gauge vote() call is about 4.2 KB of hex. */
export const MAX_JSON_BYTES = 16 * 1024

/** Reads a JSON object body with a content-type and size check, without trusting Content-Length. */
export async function readJsonBody(request: Request): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse<ApiError> }> {
  const type = request.headers.get("content-type") ?? ""
  if (!/^application\/json\b/i.test(type)) return { ok: false, response: fail(415, "unsupported-media-type", "Send the request as application/json.") }
  const declared = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(declared) && declared > MAX_JSON_BYTES) return { ok: false, response: fail(413, "too-large", "The request body is too large.") }
  let text: string
  try {
    text = await request.text()
  } catch {
    return { ok: false, response: fail(400, "bad-request", "The request body could not be read.") }
  }
  if (new TextEncoder().encode(text).length > MAX_JSON_BYTES) return { ok: false, response: fail(413, "too-large", "The request body is too large.") }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return { ok: false, response: fail(400, "bad-request", "Expected a JSON body.") }
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, response: fail(400, "bad-request", "Expected a JSON object.") }
  return { ok: true, body: body as Record<string, unknown> }
}

// ---- Same-site check -------------------------------------------------------------------------------

/**
 * Browsers label every request with Sec-Fetch-Site. The vote endpoints are only meant for this site's
 * own pages, so a cross-site browser request is refused. Non-browser clients do not send the header
 * and are covered by the rate limits instead.
 */
export function rejectCrossSite(request: Request): NextResponse<ApiError> | null {
  const site = request.headers.get("sec-fetch-site")
  if (site === "cross-site") return fail(403, "cross-site", "This endpoint only serves Boost Relay's own pages.")
  return null
}

// ---- Rate limits -----------------------------------------------------------------------------------

interface Window {
  count: number
  resetAt: number
}

const limiterKey = Symbol.for("boost-relay.rate-limit")
const limiterHolder = globalThis as unknown as Record<symbol, Map<string, Window> | undefined>
const windows = (limiterHolder[limiterKey] ??= new Map<string, Window>())
const MAX_TRACKED = 20_000

/** Per-route budgets per client per minute. Generous for real use; a page polls receipts every 3 s. */
export const RATE_LIMITS = {
  market: { limit: 60, windowMs: 60_000 },
  optimize: { limit: 40, windowMs: 60_000 },
  prepare: { limit: 15, windowMs: 60_000 },
  simulate: { limit: 20, windowMs: 60_000 },
  receipt: { limit: 90, windowMs: 60_000 },
} as const

export type RateScope = keyof typeof RATE_LIMITS

/** The client address the platform reports; "local" when there is none (development). */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const real = request.headers.get("x-real-ip")?.trim()
  return (forwarded || real || "local").slice(0, 64)
}

/** Fixed-window counter. Returns null when allowed, or the seconds to wait. */
export function takeToken(scope: RateScope, client: string, now = Date.now()): number | null {
  const { limit, windowMs } = RATE_LIMITS[scope]
  if (windows.size > MAX_TRACKED) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k)
    if (windows.size > MAX_TRACKED) windows.clear()
  }
  const key = `${scope}:${client}`
  const current = windows.get(key)
  if (current === undefined || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  if (current.count >= limit) return Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  current.count++
  return null
}

export function rateLimited(scope: RateScope, request: Request): NextResponse<ApiError> | null {
  const wait = takeToken(scope, clientKey(request))
  if (wait === null) return null
  return fail(429, "rate-limited", `Too many requests. Try again in ${wait} seconds.`, { "Retry-After": String(wait) })
}

/** Test hook: forget all counters. */
export function resetRateLimits(): void {
  windows.clear()
}

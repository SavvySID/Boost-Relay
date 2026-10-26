import { formatBoost, formatFixed, formatRatioPercent, formatTokenAmount, shortAddress } from "@boost-relay/mezo/formatting"
import type { Int, RatioDto, Uint } from "./market-dto"

/** All amounts here are bigint-backed; nothing is converted to a float before formatting. */

export function boost(value: Uint, fractionDigits = 2): string {
  return formatBoost(BigInt(value), fractionDigits)
}

/** Signed boost difference, e.g. "+0.25x" or "-0.10x". */
export function boostDelta(value: Int, fractionDigits = 2): string {
  const v = BigInt(value)
  return `${v > 0n ? "+" : v < 0n ? "-" : ""}${formatBoost(v < 0n ? -v : v, fractionDigits)}`
}

export function amount(value: Uint | bigint, decimals = 18, fractionDigits = 2): string {
  return formatTokenAmount(BigInt(value), decimals, fractionDigits)
}

export function integer(value: Uint | number | bigint): string {
  return formatTokenAmount(BigInt(value), 0, 0)
}

const SCALES: readonly [bigint, string][] = [
  [1_000_000_000n, "B"],
  [1_000_000n, "M"],
  [1_000n, "K"],
]

/** Compact token amount: 17,506,532.4 -> "17.51M". Truncates; values below 0.01 show "<0.01". */
export function compact(value: Uint | bigint, decimals = 18): string {
  const v = BigInt(value)
  if (v === 0n) return "0"
  const unit = 10n ** BigInt(decimals)
  for (const [scale, suffix] of SCALES) {
    if (v >= scale * unit) return `${formatFixed((v * 100n) / (scale * unit), 2, 2)}${suffix}`
  }
  if (v * 100n < unit) return "<0.01"
  return formatFixed(v, decimals, 2)
}

export function percent(ratio: RatioDto, fractionDigits = 1): string {
  return formatRatioPercent({ numerator: BigInt(ratio.numerator), denominator: BigInt(ratio.denominator) }, fractionDigits)
}

/** part / total in basis points (0..10000), for widths only; exact integer math. */
export function basisPoints(part: Uint | bigint, total: Uint | bigint): number {
  const t = BigInt(total)
  if (t === 0n) return 0
  return Number((BigInt(part) * 10_000n) / t)
}

export const short = shortAddress

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })
const dateOnly = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" })

/** Unix seconds (decimal string) -> "23 Oct 2026, 00:00 UTC". */
export function utcDateTime(unixSeconds: Uint): string {
  return `${dateTime.format(new Date(Number(BigInt(unixSeconds)) * 1000))} UTC`
}

export function utcDate(unixSeconds: Uint): string {
  return dateOnly.format(new Date(Number(BigInt(unixSeconds)) * 1000))
}

/** "just now", "42 s ago", "3 min ago", "2 h ago", "4 d ago". */
export function relativeAge(unixSeconds: Uint, nowMs: number): string {
  const seconds = Math.max(0, Math.floor(nowMs / 1000) - Number(BigInt(unixSeconds)))
  if (seconds < 5) return "just now"
  if (seconds < 60) return `${seconds} s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`
  return `${Math.floor(seconds / 86_400)} d ago`
}

/** A network fee in satoshis (1 sat = 1e10 wei), two significant digits. Testnet fees are fractions of a sat. */
export function satsFromWei(wei: string): string {
  const sats = Number(BigInt(wei)) / 1e10
  if (sats === 0) return "0 sats"
  return `${Number(sats.toPrecision(2)).toLocaleString("en-US", { maximumSignificantDigits: 2 })} sats`
}

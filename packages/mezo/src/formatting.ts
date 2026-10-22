import type { Ratio } from "./boost.js"

/** Decimal string of a fixed-point bigint, truncated (not rounded) to `fractionDigits`. */
export function formatFixed(value: bigint, decimals: number, fractionDigits = 4): string {
  if (!Number.isInteger(decimals) || decimals < 0) throw new RangeError(`invalid decimals ${decimals}`)
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0) throw new RangeError(`invalid fractionDigits ${fractionDigits}`)
  const negative = value < 0n
  const abs = negative ? -value : value
  const base = 10n ** BigInt(decimals)
  const whole = abs / base
  const shown = Math.min(fractionDigits, decimals)
  let out = whole.toString()
  if (shown > 0) {
    const frac = (abs % base).toString().padStart(decimals, "0").slice(0, shown)
    out += `.${frac}`
  }
  return negative ? `-${out}` : out
}

/** 18-decimal token amount with thousands separators, e.g. 98,779,105.12. */
export function formatTokenAmount(value: bigint, decimals = 18, fractionDigits = 2): string {
  const [whole = "0", frac] = formatFixed(value, decimals, fractionDigits).split(".")
  const negative = whole.startsWith("-")
  const digits = negative ? whole.slice(1) : whole
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${negative ? "-" : ""}${grouped}${frac !== undefined ? `.${frac}` : ""}`
}

/** Boost (1e18 precision) as e.g. "2.50x". */
export function formatBoost(boost: bigint, fractionDigits = 2): string {
  return `${formatFixed(boost, 18, fractionDigits)}x`
}

/** Ratio as a percentage string truncated to `fractionDigits`, e.g. "29.40%". "n/a" if denominator is 0. */
export function formatRatioPercent(ratio: Ratio, fractionDigits = 2): string {
  if (ratio.denominator === 0n) return "n/a"
  const scale = 10n ** BigInt(fractionDigits)
  const scaled = (ratio.numerator * 100n * scale) / ratio.denominator
  return `${formatFixed(scaled, fractionDigits, fractionDigits)}%`
}

/** Ratio in parts per million (integer), for exact comparisons in tooling. */
export function ratioToPpm(ratio: Ratio): bigint {
  if (ratio.denominator === 0n) return 0n
  return (ratio.numerator * 1_000_000n) / ratio.denominator
}

export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

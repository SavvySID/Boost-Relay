import type { PositionDto, PositionStatus, TargetDto } from "@/lib/market-dto"
import { amount, boost, compact, utcDate } from "@/lib/market-formatting"

const STATUS: Record<PositionStatus, { readonly label: string; readonly active: boolean }> = {
  active: { label: "Active", active: true },
  expired: { label: "Expired", active: false },
  "no-power": { label: "No power", active: false },
  "no-lock": { label: "No lock", active: false },
  "gauge-killed": { label: "Gauge closed", active: false },
}

export function StatusLabel({ status }: { readonly status: PositionStatus }) {
  const s = STATUS[status]
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${s.active ? "text-fg" : "text-fg-3"}`}>
      <svg viewBox="0 0 10 10" aria-hidden="true" className="size-2.5">
        {s.active ? (
          <circle cx="5" cy="5" r="4" fill="var(--color-btc)" />
        ) : (
          <circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
        )}
      </svg>
      {s.label}
    </span>
  )
}

/** Live boost with a thin 1x-5x meter. */
export function BoostValue({ value }: { readonly value: string }) {
  const v = BigInt(value)
  const fill = Number(((v - 10n ** 18n) * 1000n) / (4n * 10n ** 18n)) / 10 // percent of the 1x..5x range
  return (
    <span className="inline-flex items-center gap-2">
      <span className="num w-12 text-right">{boost(value)}</span>
      <span aria-hidden="true" className="relative h-1 w-10 overflow-hidden rounded-full bg-ink-800">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(0, Math.min(100, fill))}%`, background: "var(--color-viz-boost)" }} />
      </span>
    </span>
  )
}

const REASON: Record<Extract<TargetDto, { reachable: false }>["reason"], string> = {
  "above-cap": "Above cap",
  "no-position-power": "No veBTC power",
  "no-vemezo-power": "No veMEZO power",
  "zero-boostable-ratio": "Cannot be boosted",
}

export function targetText(t: TargetDto): string {
  if (!t.reachable) return REASON[t.reason]
  if (t.alreadyMet) return "Met"
  if (t.exceedsTotalVotingPower) return "More than all veMEZO"
  return `${compact(t.additionalWeight)} more`
}

/** Extra veMEZO for 5x, "At cap" with any excess, or why it does not apply. */
export function ToMaxCell({ position }: { readonly position: PositionDto }) {
  if (position.status !== "active") return <span className="text-fg-3">Not applicable</span>
  if (position.atCap) {
    return (
      <span className="num">
        At cap
        {position.excessWeight !== "0" ? <span className="block text-xs text-fg-3">{compact(position.excessWeight)} over</span> : null}
      </span>
    )
  }
  const five = position.targets["5x"]
  if (!five.reachable) return <span className="text-fg-3">{REASON[five.reason]}</span>
  if (five.exceedsTotalVotingPower) return <span className="text-fg-3">More than all veMEZO</span>
  return <span className="num">{compact(five.additionalWeight)}</span>
}

export function IncentiveCell({ position }: { readonly position: PositionDto }) {
  const { status, tokens } = position.incentives
  if (status === "not-read") return <span className="text-fg-3">Not read</span>
  if (status === "unavailable") return <span className="text-fg-3">Unavailable</span>
  if (status === "none-posted") return <span className="text-fg-3">None this epoch</span>
  const posted = tokens.filter((t) => t.postedForEpoch !== "0")
  const first = posted[0]
  if (first === undefined) return <span className="text-fg-3">None this epoch</span>
  return (
    <span className="num">
      {compact(first.postedForEpoch, first.decimals ?? 18)} {first.symbol ?? "token"}
      {first.symbol === null || first.decimals === null ? <span className="block text-xs text-fg-3">symbol unavailable</span> : null}
      {posted.length > 1 ? <span className="block text-xs text-fg-3">+{posted.length - 1} more</span> : null}
    </span>
  )
}

/** Lock end, judged at the snapshot's block time (`asOf`, unix seconds) so it agrees with the status. */
export function LockCell({ position, asOf }: { readonly position: PositionDto; readonly asOf: string }) {
  if (position.lock.isPermanent) return <span>Permanent</span>
  const end = BigInt(position.lock.end)
  if (end === 0n) return <span className="text-fg-3">None</span>
  const expired = end <= BigInt(asOf)
  return <span className={expired ? "text-fg-3" : ""}>{expired ? `Expired ${utcDate(position.lock.end)}` : utcDate(position.lock.end)}</span>
}

export function lockedBtc(position: PositionDto): string {
  return `${amount(position.lock.amount, 18, 6)} BTC`
}

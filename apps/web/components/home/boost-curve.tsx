"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import type { PositionDto } from "@/lib/market-dto"
import { boost, compact, integer } from "@/lib/market-formatting"
import { chip, ui } from "@/lib/ui"
import { SnapshotLine, isStale, useLiveMarket } from "./live-market"

const ONE = 10n ** 18n
type Group = "cap" | "below" | "none"
const ORDER: Record<Group, number> = { cap: 0, below: 1, none: 2 }

function groupOf(p: PositionDto): Group {
  if (p.atCap) return "cap"
  return p.gaugeWeight === "0" ? "none" : "below"
}

/** Active positions, grouped (at cap, below 5x, no votes) and sorted by live boost within each group. */
function rank(positions: readonly PositionDto[]) {
  const active = positions.filter((p) => p.status === "active")
  return active
    .map((p) => ({ p, group: groupOf(p), boost: BigInt(p.liveBoost) }))
    .sort((a, b) => ORDER[a.group] - ORDER[b.group] || (a.boost === b.boost ? Number(BigInt(a.p.tokenId) - BigInt(b.p.tokenId)) : a.boost > b.boost ? -1 : 1))
}

/** Share of the 1x..5x range, 0..1. */
function rise(value: bigint): number {
  const clamped = value < ONE ? ONE : value > 5n * ONE ? 5n * ONE : value
  return Number(((clamped - ONE) * 10_000n) / (4n * ONE)) / 10_000
}

const BRACKETS: readonly { readonly group: Group; readonly label: string }[] = [
  { group: "cap", label: "at the 5x cap" },
  { group: "below", label: "below 5x" },
  { group: "none", label: "with no votes" },
]

function Chart({ positions }: { readonly positions: readonly PositionDto[] }) {
  const ranked = useMemo(() => rank(positions), [positions])
  const [hover, setHover] = useState<number | null>(null)
  const n = ranked.length
  const counts = { cap: 0, below: 0, none: 0 }
  for (const r of ranked) counts[r.group]++
  if (n === 0) return <p className="py-16 text-center text-sm text-fg-2">No active veBTC boost positions were found at this block.</p>

  const slot = 10
  const gap = n > 120 ? 1.6 : 2.4
  const shown = hover === null ? null : (ranked[hover] ?? null)
  const summary = `${integer(n)} active positions: ${integer(counts.cap)} at the 5x cap, ${integer(counts.below)} below 5x with votes, ${integer(counts.none)} with no votes.`

  return (
    <div>
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2">
        <div className="num relative h-52 text-right text-[11px] text-fg-3 sm:h-60" aria-hidden="true">
          {[5, 3, 1].map((x) => (
            <span key={x} className="absolute right-0 -translate-y-1/2" style={{ top: `${((5 - x) / 4) * 100}%` }}>
              {x}x
            </span>
          ))}
        </div>
        <div
          className="relative h-52 sm:h-60"
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const i = Math.floor(((e.clientX - rect.left) / rect.width) * n)
            setHover(i >= 0 && i < n ? i : null)
          }}
          onPointerLeave={() => setHover(null)}
        >
          {[2, 3, 4].map((x) => (
            <div key={x} aria-hidden="true" className="absolute inset-x-0 border-t border-line" style={{ top: `${((5 - x) / 4) * 100}%` }} />
          ))}
          <div aria-hidden="true" className="absolute inset-x-0 top-0 border-t border-dashed border-fg/60" />
          <span aria-hidden="true" className="absolute right-0 top-1 rounded bg-surface/90 px-1 text-[11px] font-medium text-fg">
            5x cap
          </span>
          <svg viewBox={`0 0 ${n * slot} 100`} preserveAspectRatio="none" role="img" aria-label={summary} className="absolute inset-0 h-full w-full overflow-visible">
            {ranked.map((r, i) => {
              const h = rise(r.boost) * 100
              const none = r.group === "none"
              const height = none ? 1.6 : Math.max(h, 0.8)
              return (
                <rect
                  key={r.p.tokenId}
                  x={i * slot + gap / 2}
                  y={100 - height}
                  width={slot - gap}
                  height={height}
                  className="bar-rise"
                  style={{ animationDelay: `${Math.min(i * 4, 600)}ms` }}
                  fill={none ? "var(--color-line-strong)" : "var(--color-viz-boost)"}
                  opacity={hover === null || hover === i ? 1 : 0.35}
                  shapeRendering="crispEdges"
                />
              )
            })}
          </svg>
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 border-t border-line-strong" />
          {shown !== null && hover !== null ? (
            <div
              role="status"
              className="pointer-events-none absolute top-8 z-10 w-max max-w-[14rem] rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-raise)]"
              style={{ left: `${((hover + 0.5) / n) * 100}%`, transform: `translateX(${hover / n > 0.6 ? "-105%" : "8px"})` }}
            >
              <p className="font-medium text-fg">veBTC #{shown.p.tokenId}</p>
              <p className="num mt-0.5 text-fg-2">
                Live boost {boost(shown.p.liveBoost)}, applied {boost(shown.p.storedBoost)}
              </p>
              <p className="num text-fg-3">
                {shown.group === "cap"
                  ? shown.p.excessWeight === "0"
                    ? "Exactly at its 5x requirement"
                    : `${compact(shown.p.excessWeight)} veMEZO past its 5x requirement`
                  : shown.group === "none"
                    ? "No veMEZO votes on its gauge"
                    : "Below 5x: more votes add boost"}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <ol className="ml-10 mt-3 flex text-xs" aria-label="Positions by group">
        {BRACKETS.map((b) => {
          const count = counts[b.group]
          if (count === 0) return null
          const share = count / n
          return (
            <li key={b.group} className="min-w-0 px-0.5" style={{ width: `${share * 100}%` }} title={`${integer(count)} ${b.label}`}>
              <span aria-hidden="true" className="block h-1.5 rounded-b-sm border-x border-b border-fg/40" />
              <span className="mt-1.5 block leading-tight">
                <span className="num font-medium text-fg">{integer(count)}</span>
                {share >= 0.16 ? <span className="text-fg-2"> {b.label}</span> : <span className="sr-only"> {b.label}</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Hero visual: the real boost landscape, read from Mezo Mainnet through /api/market. */
export function BoostCurveCard() {
  const { state, now, reload } = useLiveMarket()
  const ready = state.phase === "ready" ? state : null
  const stale = ready !== null && isStale(ready.data, now)

  let status = <span className={chip("neutral")}>Reading chain</span>
  if (state.phase === "error") status = <span className={chip("danger")}>Unavailable</span>
  else if (ready !== null) {
    if (ready.data.meta.completeness === "partial") status = <span className={chip("warn")}>Partial</span>
    else if (stale) status = <span className={chip("warn")}>Out of date</span>
    else
      status = (
        <span className={chip("success")}>
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success-fg" />
          Live
        </span>
      )
  }

  return (
    <figure className="overflow-hidden rounded-[20px] border border-line bg-surface shadow-[0_28px_60px_-32px_rgb(0_0_0/0.3)]">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <figcaption className="min-w-0">
          <p className="text-sm font-medium text-fg">Live boost of every active veBTC position</p>
          <p className="mt-0.5 text-xs text-fg-3">Grouped and sorted from 5x down to 1x. Hover a bar for details.</p>
        </figcaption>
        {status}
      </div>

      <div className="px-4 pb-4 pt-5 sm:px-5">
        {state.phase === "loading" ? (
          <div aria-busy="true">
            <div className="ml-10 h-52 animate-pulse rounded-[var(--radius-sm)] bg-subtle sm:h-60" />
            <p role="status" className="mt-3 text-xs text-fg-3">
              Reading every veBTC position on Mezo Mainnet at one block. A first read can take 10 to 40 seconds.
            </p>
          </div>
        ) : state.phase === "error" ? (
          <div className="flex h-52 flex-col items-start justify-center gap-3 rounded-[var(--radius-md)] bg-subtle p-5 sm:h-60">
            <p className="text-sm font-medium text-fg">Live market data is unavailable right now.</p>
            <p className="text-sm text-fg-2">{state.message} The rest of the site works without it.</p>
            <button type="button" onClick={() => reload(false)} className={ui.btnSecondary}>
              Try again
            </button>
          </div>
        ) : (
          <Chart positions={state.data.positions} />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line bg-subtle px-4 py-3 sm:px-5">
        {ready !== null ? <SnapshotLine data={ready.data} now={now} /> : <p className="text-xs text-fg-3">Mezo Mainnet</p>}
        <div className="flex items-center gap-1">
          {stale ? (
            <button type="button" onClick={() => reload(true)} disabled={ready?.refreshing} className={ui.btnQuiet}>
              {ready?.refreshing ? "Refreshing" : "Refresh"}
            </button>
          ) : null}
          <Link href="/market" className={`${ui.btnQuiet} font-medium text-fg`}>
            View full market
          </Link>
        </div>
      </div>
    </figure>
  )
}

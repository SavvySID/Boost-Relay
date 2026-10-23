"use client"

import { useState } from "react"
import type { MarketDto } from "@/lib/market-dto"
import { amount, basisPoints, compact } from "@/lib/market-formatting"

interface Segment {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly value: bigint
  readonly color: string
}

/** Where all veMEZO weight in BoostVoter sits, as one stacked bar (weight units only). */
export function VoteAllocation({ data }: { readonly data: MarketDto }) {
  const { summary, derived } = data
  const onLive = BigInt(summary.weightOnLivePositions)
  const excess = BigInt(summary.excessWeightOnLive)
  const idle = BigInt(summary.weightOnZeroPowerLiveGauges) + BigInt(derived.weightOnKilledGauges) + BigInt(derived.weightUnattributed)
  const segments: Segment[] = [
    {
      id: "boost",
      label: "Adds boost",
      detail: "Weight on active positions up to what each needs for 5x.",
      value: onLive - excess,
      color: "var(--color-viz-boost)",
    },
    {
      id: "over",
      label: "Above the 5x requirement",
      detail: "Weight on active positions past their 5x requirement. No further boost.",
      value: excess,
      color: "var(--color-viz-over)",
    },
    {
      id: "idle",
      label: "On expired or closed positions",
      detail: "Weight on gauges whose veBTC has no power, was closed, or was burned.",
      value: idle,
      color: "var(--color-viz-idle)",
    },
  ]
  const total = segments.reduce((sum, s) => sum + s.value, 0n)
  const [active, setActive] = useState<string | null>(null)
  const shown = segments.find((s) => s.id === active) ?? null

  return (
    <figure aria-labelledby="allocation-title" className="max-w-[62rem]">
      <figcaption id="allocation-title" className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-fg">Where veMEZO votes sit</span>
        <span className="num text-xs text-fg-3">{amount(total, 18, 0)} veMEZO allocated in BoostVoter</span>
      </figcaption>

      <div className="relative mt-3">
        <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded bg-ink-950" role="img" aria-label="Stacked bar of veMEZO weight; values are listed in the legend below.">
          {total === 0n ? (
            <div className="h-full w-full bg-ink-800" />
          ) : (
            segments
              .filter((s) => s.value > 0n)
              .map((s) => (
                <div
                  key={s.id}
                  tabIndex={0}
                  onMouseEnter={() => setActive(s.id)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(s.id)}
                  onBlur={() => setActive(null)}
                  aria-label={`${s.label}: ${amount(s.value, 18, 0)} veMEZO`}
                  className="h-full min-w-[3px] first:rounded-l last:rounded-r focus-visible:outline-offset-4"
                  style={{ flexGrow: basisPoints(s.value, total), flexBasis: 0, background: s.color, opacity: active === null || active === s.id ? 1 : 0.45 }}
                />
              ))
          )}
        </div>
        {shown !== null && total > 0n ? (
          <div role="status" className="pointer-events-none absolute -top-2 left-0 -translate-y-full rounded-md border border-line-strong bg-ink-850 px-3 py-2 text-xs shadow-lg">
            <span className="font-medium text-fg">{shown.label}</span>
            <span className="num ml-2 text-fg-2">
              {amount(shown.value, 18, 0)} veMEZO, {(basisPoints(shown.value, total) / 100).toFixed(1)}%
            </span>
          </div>
        ) : null}
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {segments.map((s) => (
          <li key={s.id} className="flex gap-2.5">
            <span aria-hidden="true" className="mt-1 size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <div className="min-w-0">
              <p className="text-sm text-fg">{s.label}</p>
              <p className="num text-sm text-fg-2">
                {compact(s.value)} <span className="text-fg-3">({total === 0n ? "0.0" : (basisPoints(s.value, total) / 100).toFixed(1)}%)</span>
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-fg-3">{s.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </figure>
  )
}

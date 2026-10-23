"use client"

import { useState } from "react"
import type { MarketDto } from "@/lib/market-dto"
import { integer } from "@/lib/market-formatting"
import { ui } from "@/lib/ui"

/** Integer axis ticks: about three steps of 1, 2, 2.5 or 5 x 10^n, topped just above the largest count. */
function niceTicks(largest: number): number[] {
  if (largest <= 0) return [0, 1]
  const rough = largest / 3
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((s) => s * magnitude).find((s) => s >= rough) ?? 10 * magnitude)
  const top = Math.ceil(largest / step) * step
  const ticks: number[] = []
  for (let t = 0; t <= top; t += step) ticks.push(t)
  return ticks
}

/** Active positions by live boost level: a single series, so no legend box. */
export function BoostDistribution({ data }: { readonly data: MarketDto }) {
  const buckets = data.derived.boostBuckets
  const ticks = niceTicks(Math.max(0, ...buckets.map((b) => b.count)))
  const max = ticks[ticks.length - 1] ?? 1
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)
  const total = buckets.reduce((s, b) => s + b.count, 0)

  return (
    <section aria-labelledby="distribution-title" className={`${ui.card} ${ui.cardBody}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="distribution-title" className={ui.sectionTitle}>
          Active positions by live boost
        </h3>
        <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} className={ui.btnQuiet}>
          {asTable ? "Show chart" : "Show as table"}
        </button>
      </div>
      <p className="mt-1 text-xs text-fg-3">
        {integer(total)} active positions at block {integer(data.meta.blockNumber)}. Boost is the live value from the contract formula.
      </p>

      {asTable ? (
        <table className="num mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-fg-3">
              <th className="py-2 font-normal">Live boost</th>
              <th className="py-2 text-right font-normal">Positions</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.label} className="border-b border-line last:border-b-0">
                <td className="py-2">{b.label}</td>
                <td className="py-2 text-right">{integer(b.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="mt-5 grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2">
          <div className="num relative h-56 text-right text-[11px] text-fg-3" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(t / max) * 100}%` }}>
                {integer(t)}
              </span>
            ))}
          </div>
          <div className="relative h-56">
            {ticks.map((t) => (
              <div key={t} aria-hidden="true" className="absolute inset-x-0 border-t border-line" style={{ bottom: `${(t / max) * 100}%` }} />
            ))}
            <ol className="absolute inset-0 flex items-end justify-around gap-[2px]">
              {buckets.map((b, i) => {
                const height = max === 0 ? 0 : (b.count / max) * 100
                const labelled = i === 0 || i === buckets.length - 1 || hover === i
                return (
                  <li
                    key={b.label}
                    tabIndex={0}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-label={`${b.label}: ${b.count} positions`}
                    className="relative flex h-full w-full max-w-16 flex-col items-center justify-end"
                  >
                    {labelled ? <span className={`num mb-1 text-xs ${hover === i ? "font-medium text-fg" : "text-fg-2"}`}>{integer(b.count)}</span> : null}
                    <span
                      className="block w-full max-w-6 rounded-t"
                      style={{ height: `${height}%`, minHeight: b.count > 0 ? 2 : 0, background: "var(--color-viz-boost)", opacity: hover === null || hover === i ? 1 : 0.45 }}
                    />
                  </li>
                )
              })}
            </ol>
          </div>
          <div />
          <div className="mt-2 flex justify-around border-t border-line-strong pt-2 text-[11px] text-fg-3" aria-hidden="true">
            {buckets.map((b) => (
              <span key={b.label} className="w-full max-w-16 text-center">
                {b.label}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-fg-3">1x includes active positions with no votes. The 5x bar is the contract cap: more votes there add no boost.</p>
    </section>
  )
}

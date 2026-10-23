"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import type { MarketDto } from "@/lib/market-dto"
import { compact, integer, percent } from "@/lib/market-formatting"
import { ui } from "@/lib/ui"
import { VoteAllocation } from "../vote-allocation"
import { SnapshotLine, isStale, useLiveMarket } from "./live-market"

interface Stat {
  readonly label: string
  readonly value: ReactNode
  readonly note: string
}

function stats(data: MarketDto): Stat[] {
  const { summary, derived } = data
  return [
    { label: "Active veBTC positions", value: integer(summary.livePositions), note: "Gauge open and the lock still has voting power." },
    { label: "At the 5x cap", value: integer(summary.atCap), note: "Receiving the maximum boost." },
    { label: "Below 5x, with votes", value: integer(summary.partiallyBoosted), note: "More votes would still add boost." },
    { label: "No votes", value: integer(summary.unboosted), note: "Zero veMEZO on the gauge, so 1x." },
    {
      label: "veMEZO above 5x needs",
      value: (
        <>
          {compact(summary.excessWeightOnLive)} <span className="text-lg font-normal text-fg-3">({percent(summary.excessShareOfLive, 1)})</span>
        </>
      ),
      note: "Votes past each position's exact 5x requirement, share of votes on active positions.",
    },
    { label: "Needed to bring the rest to 5x", value: compact(derived.additionalWeightToMaxBelowCap), note: "Extra veMEZO the below-cap positions need, using the contract's rounding." },
  ]
}

const LABELS = ["Active veBTC positions", "At the 5x cap", "Below 5x, with votes", "No votes", "veMEZO above 5x needs", "Needed to bring the rest to 5x"]

function StatGrid({ items }: { readonly items: readonly { readonly label: string; readonly value: ReactNode; readonly note?: string }[] }) {
  return (
    // Hairline grid: the 1px gaps show the line color behind the cells.
    <dl className="grid grid-cols-2 gap-px border-y border-line-strong/60 bg-line-strong/60 md:grid-cols-3">
      {items.map((s) => (
        <div key={s.label} className="min-w-0 bg-warm px-4 py-5 sm:px-5">
          <dt className="text-sm text-fg-2">{s.label}</dt>
          <dd className="num mt-2 text-[clamp(1.6rem,3vw,2.25rem)] font-medium leading-none tracking-[-0.02em] text-balance text-fg">{s.value}</dd>
          {s.note ? <dd className="mt-2 text-xs leading-relaxed text-fg-3">{s.note}</dd> : null}
        </div>
      ))}
    </dl>
  )
}

/** Live numbers from the same snapshot as the hero chart. Missing data shows as unavailable, never zero. */
export function MarketNow() {
  const { state, now, reload } = useLiveMarket()
  const ready = state.phase === "ready" ? state : null
  const stale = ready !== null && isStale(ready.data, now)

  return (
    <section id="live-market" aria-labelledby="live-market-title" className="bg-warm">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div className="max-w-2xl">
            <h2 id="live-market-title" className="text-[clamp(1.75rem,3.2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.025em] text-balance text-fg">
              The boost market right now
            </h2>
            <p className="mt-3 text-base leading-relaxed text-fg-2">
              Read straight from Mezo Mainnet contracts at a single block. Nothing here is typed in by hand or carried over from an older snapshot.
            </p>
            {ready !== null ? <SnapshotLine data={ready.data} now={now} className="mt-4" /> : null}
            {ready?.refreshError ? <p className="mt-2 text-xs text-danger-fg">Refresh failed: {ready.refreshError} Showing the previous snapshot.</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {stale ? (
              <button type="button" onClick={() => reload(true)} disabled={ready?.refreshing} className={ui.btnSecondary}>
                {ready?.refreshing ? "Refreshing" : "Refresh numbers"}
              </button>
            ) : null}
            <Link href="/market" className={ui.btnPrimary}>
              View full market
            </Link>
          </div>
        </div>

        <div className="mt-10">
          {state.phase === "loading" ? (
            <div aria-busy="true">
              <StatGrid items={LABELS.map((label) => ({ label, value: <span className="inline-block h-8 w-20 animate-pulse rounded-[var(--radius-sm)] bg-fill align-middle" /> }))} />
              <p role="status" className="mt-4 text-sm text-fg-2">
                Reading the market…
              </p>
            </div>
          ) : state.phase === "error" ? (
            <div>
              <StatGrid items={LABELS.map((label) => ({ label, value: <span className="text-lg text-fg-3">Unavailable</span> }))} />
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <p className="text-sm text-fg-2">The snapshot could not be read: {state.message}</p>
                <button type="button" onClick={() => reload(false)} className={ui.btnSecondary}>
                  Try again
                </button>
              </div>
            </div>
          ) : (
            <>
              {state.data.meta.completeness === "partial" ? (
                <p className="mb-4 rounded-[var(--radius-md)] bg-warn-bg px-4 py-3 text-sm text-warn-fg">
                  Partial snapshot: some reads failed, so these counts cover only the positions that were read in full.
                </p>
              ) : null}
              <StatGrid items={stats(state.data)} />
              <div className="mt-8 rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-6">
                <VoteAllocation data={state.data} />
              </div>
              <p className="mt-4 max-w-[72ch] text-xs leading-relaxed text-fg-3">
                Votes above a position&apos;s 5x requirement add no more boost to it, but they can still earn posted incentives or count toward other reward
                programs. These numbers measure boost efficiency, not lost income.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

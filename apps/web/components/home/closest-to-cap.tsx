"use client"

import Link from "next/link"
import type { PositionDto } from "@/lib/market-dto"
import { boost, compact } from "@/lib/market-formatting"
import { ui } from "@/lib/ui"
import { BoostValue } from "../position-cells"
import { SnapshotLine, useLiveMarket } from "./live-market"

const ROWS = 8

/** Active, below-cap positions that need the fewest extra veMEZO to reach 5x. */
function closest(positions: readonly PositionDto[]): { p: PositionDto; extra: bigint }[] {
  const out: { p: PositionDto; extra: bigint }[] = []
  for (const p of positions) {
    if (p.status !== "active" || p.atCap) continue
    const five = p.targets["5x"]
    if (!five.reachable || five.alreadyMet || five.exceedsTotalVotingPower) continue
    out.push({ p, extra: BigInt(five.additionalWeight) })
  }
  return out.sort((a, b) => (a.extra === b.extra ? Number(BigInt(a.p.tokenId) - BigInt(b.p.tokenId)) : a.extra < b.extra ? -1 : 1)).slice(0, ROWS)
}

/** Read-only sample of the real Boost Market table, from the homepage's shared snapshot. */
export function ClosestToCap() {
  const { state, now } = useLiveMarket()

  let body
  if (state.phase === "loading") {
    body = (
      <div aria-busy="true" className="grid gap-2 p-4 sm:p-5">
        {Array.from({ length: ROWS }, (_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-[var(--radius-sm)] bg-subtle" />
        ))}
      </div>
    )
  } else if (state.phase === "error") {
    body = <p className="p-5 text-sm text-fg-2">The live preview is unavailable right now: {state.message}</p>
  } else {
    const rows = closest(state.data.positions)
    body =
      rows.length === 0 ? (
        <p className="p-5 text-sm text-fg-2">No below-cap positions can reach 5x at this block.</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Active veBTC positions closest to the 5x cap at the snapshot block</caption>
          <thead className="bg-subtle text-left text-xs text-fg-3">
            <tr>
              <th scope="col" className="py-2.5 pl-4 pr-2 font-medium sm:pl-5">veBTC</th>
              <th scope="col" className="px-2 py-2.5 font-medium">Live boost</th>
              <th scope="col" className="hidden px-2 py-2.5 text-right font-medium sm:table-cell">Applied</th>
              <th scope="col" className="hidden px-2 py-2.5 text-right font-medium md:table-cell">Votes</th>
              <th scope="col" className="py-2.5 pl-2 pr-4 text-right font-medium sm:pr-5">Needed for 5x</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, extra }) => (
              <tr key={p.tokenId} className="border-t border-line">
                <th scope="row" className="num py-3 pl-4 pr-2 text-left font-medium text-fg sm:pl-5">
                  #{p.tokenId}
                </th>
                <td className="px-2 py-3">
                  <BoostValue value={p.liveBoost} />
                </td>
                <td className="num hidden px-2 py-3 text-right text-fg-2 sm:table-cell">{boost(p.storedBoost)}</td>
                <td className="num hidden px-2 py-3 text-right text-fg-2 md:table-cell">{compact(p.gaugeWeight)}</td>
                <td className="num py-3 pl-2 pr-4 text-right text-fg sm:pr-5">{compact(extra)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">Boost Market</p>
          <p className="text-xs text-fg-3">Positions closest to 5x</p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full border border-line px-2.5 py-0.5 text-xs text-fg-2">Live, read-only</span>
      </div>
      <div className="flex-1">{body}</div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line bg-subtle px-4 py-3 sm:px-5">
        {state.phase === "ready" ? <SnapshotLine data={state.data} now={now} /> : <p className="text-xs text-fg-3">Mezo Mainnet</p>}
        <Link href="/market" className={`${ui.btnQuiet} font-medium text-fg`}>
          Open the full table
        </Link>
      </div>
    </div>
  )
}

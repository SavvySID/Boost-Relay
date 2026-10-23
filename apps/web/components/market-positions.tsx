"use client"

import { useMemo, useRef, useState } from "react"
import type { MarketDto } from "@/lib/market-dto"
import { integer } from "@/lib/market-formatting"
import { filterCounts, viewPositions, type PositionFilter, type SortDirection, type SortKey } from "@/lib/market-view"
import { ui } from "@/lib/ui"
import { MarketFilters } from "./market-filters"
import { MarketTable } from "./market-table"
import { PositionDetail } from "./position-detail"

const PAGE = 100

export function MarketPositions({ data }: { readonly data: MarketDto }) {
  const [filter, setFilter] = useState<PositionFilter>("all")
  const [query, setQuery] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("votes")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [limit, setLimit] = useState(PAGE)
  const [selected, setSelected] = useState<string | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  const counts = useMemo(() => filterCounts(data.positions), [data.positions])
  const rows = useMemo(() => viewPositions(data.positions, { filter, query, sortKey, sortDirection }), [data.positions, filter, query, sortKey, sortDirection])
  const visible = rows.slice(0, limit)
  const selectedPosition = selected === null ? null : (data.positions.find((p) => p.tokenId === selected) ?? null)

  return (
    <section id="positions" aria-labelledby="positions-title" className={`scroll-mt-24 ${ui.card} ${ui.cardBody}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="positions-title" className={ui.sectionTitle}>
          Boost positions
        </h3>
        <p className="num text-xs text-fg-3" aria-live="polite">
          Showing {integer(visible.length)} of {integer(rows.length)}
          {rows.length !== data.positions.length ? ` (filtered from ${integer(data.positions.length)})` : ""}
        </p>
      </div>

      <MarketFilters
        filter={filter}
        counts={counts}
        onFilter={(f) => {
          setFilter(f)
          setLimit(PAGE)
        }}
        query={query}
        onQuery={(q) => {
          setQuery(q)
          setLimit(PAGE)
        }}
        sortKey={sortKey}
        onSortKey={setSortKey}
        sortDirection={sortDirection}
        onSortDirection={setSortDirection}
      />

      {rows.length === 0 ? (
        <div className="mt-5 rounded-[var(--radius-md)] bg-subtle px-6 py-10 text-center">
          <p className="text-sm text-fg">{query.trim() !== "" ? `No positions match "${query.trim()}" in this view.` : "No positions in this view at this block."}</p>
          {query.trim() !== "" || filter !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setFilter("all")
              }}
              className={`mt-3 ${ui.btnSecondary}`}
            >
              Clear search and filters
            </button>
          ) : null}
        </div>
      ) : (
        <MarketTable
          rows={visible}
          selected={selected}
          explorerUrl={data.meta.explorerUrl}
          asOf={data.meta.blockTimestamp}
          onSelect={(id, origin) => {
            returnFocus.current = origin
            setSelected(id)
          }}
        />
      )}

      {rows.length > visible.length ? (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={() => setLimit(rows.length)} className={ui.btnSecondary}>
            Show all {integer(rows.length)} positions
          </button>
        </div>
      ) : null}

      {selectedPosition !== null ? (
        <PositionDetail
          position={selectedPosition}
          data={data}
          onClose={() => {
            setSelected(null)
            returnFocus.current?.focus()
          }}
        />
      ) : null}
    </section>
  )
}

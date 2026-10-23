import { FILTERS, SORTS, type PositionFilter, type SortDirection, type SortKey } from "@/lib/market-view"
import { integer } from "@/lib/market-formatting"

export function MarketFilters(props: {
  readonly filter: PositionFilter
  readonly counts: Readonly<Record<PositionFilter, number>>
  readonly onFilter: (f: PositionFilter) => void
  readonly query: string
  readonly onQuery: (q: string) => void
  readonly sortKey: SortKey
  readonly onSortKey: (k: SortKey) => void
  readonly sortDirection: SortDirection
  readonly onSortDirection: (d: SortDirection) => void
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div role="group" aria-label="Filter positions" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => {
          const on = props.filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => props.onFilter(f.id)}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                on ? "border-btc/70 bg-ink-850 text-fg" : "border-line text-fg-2 hover:border-line-strong hover:text-fg"
              }`}
            >
              {f.label}
              <span className={`num ml-2 text-xs ${on ? "text-fg-2" : "text-fg-3"}`}>{integer(props.counts[f.id])}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full min-w-0 sm:w-auto sm:flex-1 lg:w-64 lg:flex-none">
          <span className="sr-only">Search by veBTC token id or address</span>
          <svg viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-3">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={props.query}
            onChange={(e) => props.onQuery(e.target.value)}
            placeholder="Token id or address"
            className="w-full rounded-lg border border-line bg-ink-900 py-1.5 pl-8 pr-3 text-sm text-fg placeholder:text-fg-3 focus:border-btc/60 focus:outline-none focus-visible:outline-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-fg-2">
          <span>Sort</span>
          <select
            value={props.sortKey}
            onChange={(e) => props.onSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-line bg-ink-900 px-2 py-1.5 text-sm text-fg"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => props.onSortDirection(props.sortDirection === "asc" ? "desc" : "asc")}
          className="rounded-lg border border-line px-2.5 py-1.5 text-sm text-fg-2 hover:text-fg"
          aria-label={props.sortDirection === "asc" ? "Sorted ascending; switch to descending" : "Sorted descending; switch to ascending"}
        >
          {props.sortDirection === "asc" ? "Low to high" : "High to low"}
        </button>
      </div>
    </div>
  )
}

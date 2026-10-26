import { integer } from "@/lib/market-formatting"
import { FILTERS, PRESETS, SORTS, type PositionFilter, type SortDirection, type SortKey } from "@/lib/market-view"
import { ui } from "@/lib/ui"

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
  readonly onPreset: (p: (typeof PRESETS)[number]) => void
}) {
  const activePreset = PRESETS.find((p) => p.filter === props.filter && p.sortKey === props.sortKey && p.sortDirection === props.sortDirection)?.id ?? null
  return (
    <>
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-warm px-3 py-2.5">
      <span className="text-sm font-medium text-fg">Where a vote helps:</span>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={activePreset === p.id}
          onClick={() => props.onPreset(p)}
          className={`rounded-full px-3 py-1 text-sm transition-colors ${activePreset === p.id ? "bg-fg text-white" : "bg-surface text-fg-2 hover:text-fg"}`}
        >
          {p.label}
        </button>
      ))}
    </div>
    <div className="mt-4 flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
      <div role="group" aria-label="Filter positions" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible md:pb-0">
        {FILTERS.map((f) => {
          const on = props.filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() => props.onFilter(f.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${on ? "bg-primary text-on-primary" : "bg-fill text-fg-2 hover:bg-fill-hover hover:text-fg"}`}
            >
              {f.label}
              <span className={`num ml-2 text-xs ${on ? "text-on-primary/70" : "text-fg-3"}`}>{integer(props.counts[f.id])}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full min-w-0 sm:w-auto sm:flex-1 md:max-w-sm 2xl:w-64 2xl:flex-none">
          <span className="sr-only">Search by veBTC token id or address</span>
          <svg viewBox="0 0 16 16" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-3">
            <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input type="search" value={props.query} onChange={(e) => props.onQuery(e.target.value)} placeholder="Token id or address" className={`${ui.input} pl-8`} />
        </label>
        <label className="flex items-center gap-2 text-sm text-fg-2">
          <span>Sort</span>
          <select value={props.sortKey} onChange={(e) => props.onSortKey(e.target.value as SortKey)} className={`${ui.input} w-auto py-1.5`}>
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
          className={ui.btnSecondary}
          aria-label={props.sortDirection === "asc" ? "Sorted ascending; switch to descending" : "Sorted descending; switch to ascending"}
        >
          {props.sortDirection === "asc" ? "Low to high" : "High to low"}
        </button>
      </div>
    </div>
    </>
  )
}

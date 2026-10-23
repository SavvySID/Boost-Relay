import type { MarketDto, MarketServed } from "@/lib/market-dto"
import { integer, utcDateTime } from "@/lib/market-formatting"

/** Partial-snapshot warning, re-served snapshot notice, and refresh failures. Renders nothing when none apply. */
export function SnapshotNotices({ data, served, refreshError }: { readonly data: MarketDto; readonly served: MarketServed; readonly refreshError: string | null }) {
  const { meta } = data
  const partial = meta.completeness === "partial"
  if (refreshError === null && !partial && served.source !== "cache") return null
  return (
    <div className="grid gap-2">
      {refreshError !== null ? (
        <p role="alert" className="flex gap-2 rounded-[var(--radius-md)] bg-danger-bg px-4 py-3 text-sm text-danger-fg">
          <span aria-hidden="true" className="font-semibold">!</span>
          Refresh failed: {refreshError} Still showing block {integer(meta.blockNumber)}.
        </p>
      ) : null}
      {partial ? (
        <details className="rounded-[var(--radius-md)] bg-warn-bg px-4 py-3 text-sm text-warn-fg">
          <summary className="cursor-pointer font-medium">
            Partial snapshot: {integer(meta.failures.length)} {meta.failures.length === 1 ? "read" : "reads"} failed. Totals cover only positions read in full.
          </summary>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
            {meta.failures.map((f) => (
              <li key={`${f.key}:${f.message}`} className="num">
                {f.key} ({f.kind}) {f.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {served.source === "cache" ? (
        <p className="text-xs text-fg-3">
          Re-served snapshot read at {utcDateTime(String(Math.floor(Date.parse(meta.fetchedAt) / 1000)))}. Refresh reads the chain again (at most once every 15
          seconds per network).
        </p>
      ) : null}
    </div>
  )
}

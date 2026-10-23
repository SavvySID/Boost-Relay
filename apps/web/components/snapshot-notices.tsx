import type { MarketDto, MarketServed } from "@/lib/market-dto"
import { integer, utcDateTime } from "@/lib/market-formatting"

/** Partial-snapshot warning, re-served snapshot notice, and refresh failures. Silent when none apply. */
export function SnapshotNotices({ data, served, refreshError }: { readonly data: MarketDto; readonly served: MarketServed; readonly refreshError: string | null }) {
  const { meta } = data
  const partial = meta.completeness === "partial"
  return (
    <div className="grid gap-2 pt-5 empty:hidden">
      {refreshError !== null ? (
        <p role="alert" className="flex gap-2 rounded-lg border border-bad/40 bg-bad/10 px-4 py-2.5 text-sm text-fg">
          <span aria-hidden="true" className="font-semibold text-bad">!</span>
          Refresh failed: {refreshError} Still showing block {integer(meta.blockNumber)}.
        </p>
      ) : null}
      {partial ? (
        <details className="rounded-lg border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm">
          <summary className="cursor-pointer text-fg">
            <span aria-hidden="true" className="mr-2 font-semibold text-warn">!</span>
            Partial snapshot: {integer(meta.failures.length)} {meta.failures.length === 1 ? "read" : "reads"} failed. Totals cover only positions read in full.
          </summary>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-fg-2">
            {meta.failures.map((f) => (
              <li key={`${f.key}:${f.message}`} className="num">
                {f.key} <span className="text-fg-3">({f.kind})</span> {f.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {served.source === "cache" ? (
        <p className="text-xs text-fg-3">
          Re-served snapshot read at {utcDateTime(String(Math.floor(Date.parse(meta.fetchedAt) / 1000)))}. Refresh reads the chain
          again (at most once every 15 seconds per network).
        </p>
      ) : null}
    </div>
  )
}

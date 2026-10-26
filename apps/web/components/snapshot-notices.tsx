import type { MarketDto, MarketServed } from "@/lib/market-dto"
import { integer, relativeAge, utcDateTime } from "@/lib/market-formatting"

/** A snapshot whose block is older than this is flagged: power decays and other votes move. */
export const STALE_SNAPSHOT_SECONDS = 300

/** Partial-snapshot warning, out-of-date warning, re-served snapshot notice, and refresh failures. Renders nothing when none apply. */
export function SnapshotNotices(props: { readonly data: MarketDto; readonly served: MarketServed; readonly refreshError: string | null; readonly now: number }) {
  const { data, served, refreshError } = props
  const { meta } = data
  const partial = meta.completeness === "partial"
  const stale = props.now / 1000 - Number(meta.blockTimestamp) > STALE_SNAPSHOT_SECONDS
  if (refreshError === null && !partial && !stale && served.source !== "cache") return null
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
      {stale ? (
        <p role="status" className="rounded-[var(--radius-md)] bg-warn-bg px-4 py-3 text-sm text-warn-fg">
          <span className="font-medium">This snapshot may be out of date.</span> Block {integer(meta.blockNumber)} was produced {relativeAge(meta.blockTimestamp, props.now)}; voting
          power decays and other voters act, so use Refresh before relying on these numbers.
        </p>
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

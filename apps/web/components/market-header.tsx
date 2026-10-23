import type { NetworkName } from "@/lib/market-dto"
import { integer, relativeAge, utcDateTime } from "@/lib/market-formatting"
import { ui } from "@/lib/ui"
import { NetworkSelector } from "./network-selector"

/** Top-bar actions shared by every page: network, read-only status, data freshness, refresh. */
export function MarketStatus(props: {
  readonly network: NetworkName
  readonly onNetworkChange: (n: NetworkName) => void
  /** Block the visible data was read at, or null while nothing is loaded. */
  readonly block: { readonly number: string; readonly timestamp: string } | null
  readonly busy: boolean
  readonly busyLabel: string
  readonly onRefresh: (() => void) | null
  readonly refreshLabel?: string
  readonly now: number
}) {
  const { block, busy } = props
  return (
    <>
      <NetworkSelector value={props.network} onChange={props.onNetworkChange} />
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-fg-2"
        title="No wallet is connected. Boost Relay only reads public contract data."
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
          <path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="8" r="1.8" fill="currentColor" />
        </svg>
        Read-only
      </span>
      <div className="min-w-[9.5rem] text-right text-xs leading-tight" aria-live="polite">
        {block ? (
          <>
            <p className="num font-medium text-fg">Block {integer(block.number)}</p>
            <p className="text-fg-3" title={utcDateTime(block.timestamp)}>
              {busy ? props.busyLabel : `Block time ${relativeAge(block.timestamp, props.now)}`}
            </p>
          </>
        ) : (
          <p className="text-fg-3">{busy ? props.busyLabel : "No data loaded"}</p>
        )}
      </div>
      {props.onRefresh !== null ? (
        <button type="button" onClick={props.onRefresh} disabled={busy || block === null} className={ui.btnSecondary}>
          <svg viewBox="0 0 16 16" aria-hidden="true" className={`size-3.5 ${busy ? "animate-spin" : ""}`}>
            <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.5v2.8h-2.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {busy && block !== null ? "Refreshing" : (props.refreshLabel ?? "Refresh")}
        </button>
      ) : null}
    </>
  )
}

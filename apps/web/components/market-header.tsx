import type { MarketDto, MarketServed, NetworkName } from "@/lib/market-dto"
import { integer, relativeAge, utcDateTime } from "@/lib/market-formatting"
import { BrandMark } from "./app-shell"
import { NetworkSelector } from "./network-selector"

export function MarketHeader(props: {
  readonly network: NetworkName
  readonly onNetworkChange: (n: NetworkName) => void
  readonly snapshot: { readonly data: MarketDto; readonly served: MarketServed } | null
  readonly busy: boolean
  readonly onRefresh: () => void
  readonly now: number
}) {
  const { snapshot, busy } = props
  return (
    <header className="z-30 border-b md:sticky md:top-0 border-line bg-ink-950/90 backdrop-blur supports-[backdrop-filter]:bg-ink-950/75">
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark className="size-8 shrink-0 text-fg" />
          <div className="min-w-0 leading-tight">
            <p className="text-xs text-fg-3">Boost Relay</p>
            <h1 className="font-condensed text-lg font-semibold tracking-tight">Boost Market</h1>
          </div>
          <p className="ml-2 hidden border-l border-line pl-4 text-sm text-fg-2 xl:block">More effective votes. Better Bitcoin boosts.</p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <NetworkSelector value={props.network} onChange={props.onNetworkChange} />
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-fg-2"
            title="No wallet is connected. Boost Relay only reads public contract data."
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
              <path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="8" cy="8" r="1.8" fill="currentColor" />
            </svg>
            Read-only
          </span>
          <div className="min-w-[10.5rem] text-right text-xs leading-tight" aria-live="polite">
            {snapshot ? (
              <>
                <p className="num text-fg">Block {integer(snapshot.data.meta.blockNumber)}</p>
                <p className="text-fg-3" title={utcDateTime(snapshot.data.meta.blockTimestamp)}>
                  {busy ? "Refreshing…" : `Block time ${relativeAge(snapshot.data.meta.blockTimestamp, props.now)}`}
                </p>
              </>
            ) : (
              <p className="text-fg-3">{busy ? "Reading chain…" : "No snapshot"}</p>
            )}
          </div>
          <button
            type="button"
            onClick={props.onRefresh}
            disabled={busy || snapshot === null}
            className="inline-flex items-center gap-2 rounded-lg border border-line-strong bg-ink-850 px-3 py-1.5 text-sm text-fg transition-colors hover:border-btc/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true" className={`size-3.5 ${busy ? "animate-spin" : ""}`}>
              <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.5v2.8h-2.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {busy && snapshot !== null ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>
    </header>
  )
}

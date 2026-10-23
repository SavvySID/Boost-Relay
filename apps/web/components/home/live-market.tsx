"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import type { MarketDto, MarketResponse, MarketServed, NetworkName } from "@/lib/market-dto"
import { integer, relativeAge } from "@/lib/market-formatting"
import { chip } from "@/lib/ui"
import { useNow } from "@/lib/use-now"

/** The homepage shows the real (mainnet) market. Voting stays on the Vote Optimizer page. */
export const HOME_NETWORK: NetworkName = "mainnet"
/** Block time older than this is labelled stale and offers a refresh. */
export const STALE_AFTER_SECONDS = 300

export type LiveState =
  | { readonly phase: "loading" }
  | { readonly phase: "error"; readonly message: string }
  | {
      readonly phase: "ready"
      readonly data: MarketDto
      readonly served: MarketServed
      readonly refreshing: boolean
      /** Set when a refresh failed; the previous snapshot stays on screen. */
      readonly refreshError: string | null
    }

interface LiveMarket {
  readonly state: LiveState
  readonly now: number
  readonly reload: (refresh: boolean) => void
}

const LiveMarketContext = createContext<LiveMarket | null>(null)

/**
 * One request to the existing /api/market route for the whole homepage, so the hero chart, the
 * live numbers and the product preview share a single server-cached snapshot.
 */
export function LiveMarketProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<LiveState>({ phase: "loading" })
  const inflight = useRef<AbortController | null>(null)
  const now = useNow(15_000)

  const load = useCallback(async (refresh: boolean) => {
    if (inflight.current !== null) return
    const controller = new AbortController()
    inflight.current = controller
    setState((s) => (s.phase === "ready" ? { ...s, refreshing: true, refreshError: null } : { phase: "loading" }))
    let message = "The market snapshot could not be read."
    try {
      const response = await fetch(`/api/market?network=${HOME_NETWORK}${refresh ? "&refresh=1" : ""}`, { signal: controller.signal, cache: "no-store" })
      const body = (await response.json()) as MarketResponse
      if (body.ok && body.data.meta.network === HOME_NETWORK) {
        const { data, served } = body
        setState({ phase: "ready", data, served, refreshing: false, refreshError: null })
        return
      }
      if (!body.ok) message = body.error.message
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof Error && error.name === "TypeError") message = "Could not reach the Boost Relay server."
    } finally {
      if (inflight.current === controller) inflight.current = null
    }
    setState((s) => (s.phase === "ready" ? { ...s, refreshing: false, refreshError: message } : { phase: "error", message }))
  }, [])

  useEffect(() => {
    void load(false)
    return () => {
      // Unmount (or StrictMode's simulated unmount): abort and forget, so a remount starts cleanly.
      inflight.current?.abort()
      inflight.current = null
    }
  }, [load])

  const reload = useCallback((refresh: boolean) => void load(refresh), [load])
  return <LiveMarketContext.Provider value={{ state, now, reload }}>{children}</LiveMarketContext.Provider>
}

export function useLiveMarket(): LiveMarket {
  const ctx = useContext(LiveMarketContext)
  if (ctx === null) throw new Error("useLiveMarket must be used inside LiveMarketProvider")
  return ctx
}

export function isStale(data: MarketDto, nowMs: number): boolean {
  return nowMs / 1000 - Number(data.meta.blockTimestamp) > STALE_AFTER_SECONDS
}

/** "Mezo Mainnet, block 12,700,000, block time 40 s ago" plus partial / stale labels. */
export function SnapshotLine({ data, now, className = "" }: { readonly data: MarketDto; readonly now: number; readonly className?: string }) {
  const stale = isStale(data, now)
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-3 ${className}`}>
      <span>
        Mezo {data.meta.network === "mainnet" ? "Mainnet" : "Testnet"}, block <span className="num">{integer(data.meta.blockNumber)}</span>, block time{" "}
        {relativeAge(data.meta.blockTimestamp, now)}
      </span>
      {data.meta.completeness === "partial" ? <span className={chip("warn")}>Partial snapshot</span> : null}
      {stale ? <span className={chip("warn")}>May be out of date</span> : null}
    </p>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { MarketDto, MarketResponse, MarketServed, NetworkName } from "@/lib/market-dto"
import { AppShell } from "./app-shell"
import { BoostDistribution } from "./boost-distribution"
import { ErrorState } from "./error-state"
import { IncentivePanel } from "./incentive-panel"
import { LoadingState } from "./loading-state"
import { MarketHeader } from "./market-header"
import { MarketPositions } from "./market-positions"
import { MarketSummary, MetricsLedger } from "./market-summary"
import { Methodology } from "./methodology"
import { SnapshotNotices } from "./snapshot-notices"
import { VoteAllocation } from "./vote-allocation"

type View =
  | { readonly phase: "loading"; readonly network: NetworkName }
  | { readonly phase: "error"; readonly network: NetworkName; readonly message: string }
  | {
      readonly phase: "ready"
      readonly network: NetworkName
      readonly data: MarketDto
      readonly served: MarketServed
      readonly refreshing: boolean
      /** Set when a refresh failed; the previous snapshot stays on screen. */
      readonly refreshError: string | null
    }

/** Re-renders relative times; never fetches. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

export function BoostMarket() {
  const [network, setNetwork] = useState<NetworkName>("mainnet")
  const [view, setView] = useState<View>({ phase: "loading", network: "mainnet" })
  const request = useRef<{ controller: AbortController; network: NetworkName } | null>(null)
  const now = useNow(15_000)

  const load = useCallback(async (target: NetworkName, refresh: boolean) => {
    const current = request.current
    if (current !== null) {
      if (current.network === target) return // one request per network at a time
      current.controller.abort() // switching networks: drop the old request entirely
    }
    const controller = new AbortController()
    request.current = { controller, network: target }
    setView((v) =>
      refresh && v.phase === "ready" && v.network === target
        ? { ...v, refreshing: true, refreshError: null }
        : { phase: "loading", network: target },
    )
    let message: string | null = null
    let result: { data: MarketDto; served: MarketServed } | null = null
    try {
      const response = await fetch(`/api/market?network=${target}${refresh ? "&refresh=1" : ""}`, {
        signal: controller.signal,
        cache: "no-store",
      })
      const body = (await response.json()) as MarketResponse
      if (!body.ok) message = body.error.message
      else if (body.data.meta.network !== target) message = "The server returned data for a different network. Nothing was shown."
      else result = { data: body.data, served: body.served }
    } catch (error) {
      if (controller.signal.aborted) return
      message = error instanceof Error && error.name === "TypeError" ? "Could not reach the Boost Relay server." : "The snapshot request failed."
    } finally {
      if (request.current?.controller === controller) request.current = null
    }
    if (controller.signal.aborted) return
    setView((v) => {
      if (result !== null) return { phase: "ready", network: target, ...result, refreshing: false, refreshError: null }
      if (v.phase === "ready" && v.network === target) return { ...v, refreshing: false, refreshError: message }
      return { phase: "error", network: target, message: message ?? "The snapshot request failed." }
    })
  }, [])

  useEffect(() => {
    void load(network, false)
  }, [network, load])

  useEffect(
    () => () => {
      // Unmount (or StrictMode's simulated unmount): abort and forget, so a remount starts cleanly.
      request.current?.controller.abort()
      request.current = null
    },
    [],
  )

  const ready = view.phase === "ready" && view.network === network ? view : null
  const busy = view.phase === "loading" || (ready?.refreshing ?? false)

  const header = (
    <MarketHeader
      network={network}
      onNetworkChange={setNetwork}
      snapshot={ready ? { data: ready.data, served: ready.served } : null}
      busy={busy}
      onRefresh={() => void load(network, true)}
      now={now}
    />
  )

  const body = useMemo(() => {
    if (view.phase === "loading" || view.network !== network) return <LoadingState network={network} />
    if (view.phase === "error") return <ErrorState network={network} message={view.message} onRetry={() => void load(network, false)} />
    const { data, served } = view
    return (
      <>
        <SnapshotNotices data={data} served={served} refreshError={view.refreshError} />
        <section aria-labelledby="overview-title" className="grid gap-8 py-8 lg:py-10">
          <MarketSummary data={data} />
          <VoteAllocation data={data} />
        </section>
        <section className="grid gap-6 border-t border-line py-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10">
          <MetricsLedger data={data} />
          <BoostDistribution data={data} />
        </section>
        <MarketPositions key={`${data.meta.network}:${data.meta.blockNumber}`} data={data} />
        <IncentivePanel data={data} />
        <Methodology data={data} />
      </>
    )
  }, [view, network, load])

  return <AppShell header={header}>{body}</AppShell>
}

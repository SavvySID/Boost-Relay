"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { MarketDto, MarketResponse, MarketServed, NetworkName } from "@/lib/market-dto"
import { useNetwork } from "@/lib/use-network"
import { useNow } from "@/lib/use-now"
import { AppShell } from "./app-shell"
import { BoostDistribution } from "./boost-distribution"
import { ErrorState } from "./error-state"
import { IncentivePanel } from "./incentive-panel"
import { LoadingState } from "./loading-state"
import { MarketStatus } from "./market-header"
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

export function BoostMarket() {
  const [network, setNetwork] = useNetwork()
  const [view, setView] = useState<View>({ phase: "loading", network })
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
    setView((v) => (refresh && v.phase === "ready" && v.network === target ? { ...v, refreshing: true, refreshError: null } : { phase: "loading", network: target }))
    let message: string | null = null
    let result: { data: MarketDto; served: MarketServed } | null = null
    try {
      const response = await fetch(`/api/market?network=${target}${refresh ? "&refresh=1" : ""}`, { signal: controller.signal, cache: "no-store" })
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

  let body
  if (view.phase === "loading" || view.network !== network) body = <LoadingState network={network} />
  else if (view.phase === "error") body = <ErrorState network={network} message={view.message} onRetry={() => void load(network, false)} />
  else {
    const { data, served } = view
    body = (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <SnapshotNotices data={data} served={served} refreshError={view.refreshError} now={now} />
        <section aria-labelledby="overview-title" className="grid grid-cols-[minmax(0,1fr)] gap-6 rounded-[var(--radius-lg)] bg-warm p-5 sm:p-8">
          <MarketSummary data={data} />
          <VoteAllocation data={data} />
        </section>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <MetricsLedger data={data} />
          <BoostDistribution data={data} />
        </div>
        <MarketPositions key={`${data.meta.network}:${data.meta.blockNumber}`} data={data} />
        <IncentivePanel data={data} />
        <Methodology data={data} />
      </div>
    )
  }

  return (
    <AppShell
      network={network}
      title="Boost Market"
      actions={
        <MarketStatus
          network={network}
          onNetworkChange={setNetwork}
          block={ready ? { number: ready.data.meta.blockNumber, timestamp: ready.data.meta.blockTimestamp } : null}
          busy={busy}
          busyLabel={ready ? "Refreshing…" : "Reading chain…"}
          onRefresh={() => void load(network, true)}
          now={now}
        />
      }
    >
      {body}
    </AppShell>
  )
}

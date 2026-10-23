"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import type { NetworkName } from "@/lib/market-dto"
import type { OptimizerDto, OptimizerResponse } from "@/lib/optimizer-dto"
import { ui } from "@/lib/ui"
import { useNetwork } from "@/lib/use-network"
import { AppShell } from "../app-shell"
import { useNow } from "@/lib/use-now"
import { ErrorState } from "../error-state"
import { MarketStatus } from "../market-header"
import { RecommendationView } from "./recommendation-view"
import { StrategySelector, type Strategy } from "./strategy-selector"
import { TokenCard } from "./token-card"
import { VotePanel } from "./vote-panel"

type View =
  | { readonly phase: "idle" }
  | { readonly phase: "loading"; readonly network: NetworkName; readonly tokenId: string }
  | { readonly phase: "error"; readonly network: NetworkName; readonly tokenId: string; readonly message: string }
  | { readonly phase: "ready"; readonly network: NetworkName; readonly tokenId: string; readonly data: OptimizerDto; readonly source: "fresh" | "cache" }

const TOKEN_PATTERN = /^#?\d{1,30}$/

export function VoteOptimizer() {
  const [network, setNetwork] = useNetwork()
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const urlToken = params.get("token") ?? ""
  const [input, setInput] = useState(urlToken)
  const [strategy, setStrategy] = useState<Strategy>("max-boosted-power")
  const [view, setView] = useState<View>({ phase: "idle" })
  const request = useRef<AbortController | null>(null)
  const now = useNow(15_000)

  const load = useCallback(async (target: NetworkName, tokenId: string) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setView({ phase: "loading", network: target, tokenId })
    try {
      const response = await fetch(`/api/optimize?network=${target}&tokenId=${encodeURIComponent(tokenId)}`, { signal: controller.signal, cache: "no-store" })
      const body = (await response.json()) as OptimizerResponse
      if (controller.signal.aborted) return
      if (!body.ok) setView({ phase: "error", network: target, tokenId, message: body.error.message })
      else if (body.data.network !== target || body.data.token.tokenId !== tokenId) setView({ phase: "error", network: target, tokenId, message: "The server answered for a different network or token. Nothing was shown." })
      else setView({ phase: "ready", network: target, tokenId, data: body.data, source: body.served.source })
    } catch {
      if (controller.signal.aborted) return
      setView({ phase: "error", network: target, tokenId, message: "Could not reach the Boost Relay server." })
    } finally {
      if (request.current === controller) request.current = null
    }
  }, [])

  // The token in the URL drives the calculation, so results can be shared and survive a network switch.
  useEffect(() => {
    const id = urlToken.replace(/^#/, "")
    if (id === "" || !TOKEN_PATTERN.test(id)) {
      request.current?.abort()
      setView({ phase: "idle" })
      return
    }
    void load(network, id)
  }, [network, urlToken, load])

  useEffect(() => () => request.current?.abort(), [])

  /** After a confirmed vote: re-read the NFT, its allocation and the market, bypassing every cache. Throws on failure. */
  const refreshAfterVote = useCallback(async (target: NetworkName, tokenId: string) => {
    const res = await fetch(`/api/optimize?network=${target}&tokenId=${encodeURIComponent(tokenId)}&fresh=1`, { cache: "no-store" })
    const body = (await res.json()) as OptimizerResponse
    if (!body.ok) throw new Error(body.error.message)
    setView({ phase: "ready", network: target, tokenId, data: body.data, source: body.served.source })
  }, [])

  const submit = () => {
    const id = input.trim().replace(/^#/, "")
    if (!TOKEN_PATTERN.test(id)) return
    const q = new URLSearchParams(params.toString())
    q.set("token", id)
    if (id === urlToken) void load(network, id)
    else router.replace(`${pathname}?${q.toString()}`, { scroll: false })
  }

  const valid = TOKEN_PATTERN.test(input.trim())
  const busy = view.phase === "loading"
  const ready = view.phase === "ready" && view.network === network ? view : null

  return (
    <AppShell
      network={network}
      title="Vote Optimizer"
      actions={
        <MarketStatus
          network={network}
          onNetworkChange={setNetwork}
          block={ready ? { number: ready.data.sourceBlock, timestamp: ready.data.blockTimestamp } : null}
          busy={busy}
          busyLabel="Reading chain…"
          onRefresh={ready ? () => void load(network, ready.tokenId) : null}
          refreshLabel="Recalculate"
          now={now}
        />
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <section aria-labelledby="optimizer-title" className="rounded-[var(--radius-lg)] bg-warm p-5 sm:p-8">
          <h2 id="optimizer-title" className="text-[clamp(1.5rem,3vw,2.25rem)] font-medium leading-[1.15] tracking-[-0.02em] text-fg">
            Where should a veMEZO vote go?
          </h2>
          <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-fg-2">
            Enter a veMEZO token id. Boost Relay reads its voting power and current votes at one block, then proposes how BoostVoter.vote() could split
            them across veBTC boost gauges. A recommendation needs no wallet. On Mezo Testnet, the NFT's owner can then review and sign it with their own wallet.
          </p>
          <form
            className="mt-5 flex max-w-xl flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <label className="flex-1">
              <span className="sr-only">veMEZO token id</span>
              <input
                inputMode="numeric"
                autoComplete="off"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="veMEZO token id, e.g. 1024"
                aria-invalid={input.trim() !== "" && !valid}
                className={`${ui.input} h-11 rounded-full px-4 text-base`}
              />
            </label>
            <button type="submit" disabled={!valid || busy} className={`${ui.btnPrimary} h-11 px-5`}>
              {busy ? "Calculating…" : "Calculate recommendation"}
            </button>
          </form>
          {input.trim() !== "" && !valid ? <p className="mt-2 text-sm text-danger-fg">Use a whole-number token id, such as 1024.</p> : null}
        </section>

        {view.phase === "idle" ? (
          <div className={`${ui.card} ${ui.cardBody} text-sm text-fg-2`}>
            <p className="font-medium text-fg">No veMEZO selected</p>
            <p className="mt-1 max-w-[68ch] leading-relaxed">
              The optimizer needs a token id to read its voting power and any votes it already holds. Nothing on the market changes until a vote is signed
              by the NFT&apos;s owner, which this phase does not support.
            </p>
          </div>
        ) : null}

        {view.phase === "loading" ? (
          <div className={`${ui.card} ${ui.cardBody}`} aria-busy="true">
            <p role="status" className="text-sm text-fg-2">
              Reading veMEZO #{view.tokenId} and the Mezo {view.network === "mainnet" ? "Mainnet" : "Testnet"} boost market at one block. A first read can take
              10 to 40 seconds.
            </p>
            <div className="mt-4 grid gap-3" aria-hidden="true">
              <div className="h-16 animate-pulse rounded-[var(--radius-md)] bg-fill" />
              <div className="h-40 animate-pulse rounded-[var(--radius-md)] bg-fill" />
            </div>
          </div>
        ) : null}

        {view.phase === "error" ? <ErrorState network={view.network} message={view.message} subject="recommendation" onRetry={() => void load(view.network, view.tokenId)} /> : null}

        {ready ? (
          <>
            <TokenCard data={ready.data} />
            <StrategySelector value={strategy} onChange={setStrategy} data={ready.data} />
            <RecommendationView data={ready.data} strategy={strategy} />
            <VotePanel data={ready.data} strategy={strategy} network={network} onRefresh={refreshAfterVote} />
          </>
        ) : null}
      </div>
    </AppShell>
  )
}

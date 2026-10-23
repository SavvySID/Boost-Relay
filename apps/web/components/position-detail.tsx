"use client"

import { useEffect, useRef, type ReactNode } from "react"
import type { MarketDto, PositionDto } from "@/lib/market-dto"
import { amount, boost, boostDelta, compact, integer, utcDateTime } from "@/lib/market-formatting"
import { StatusLabel, lockedBtc, targetText } from "./position-cells"

function Item({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-sm last:border-b-0">
      <dt className="text-fg-2">{label}</dt>
      <dd className="num text-right text-fg">{children}</dd>
    </div>
  )
}

function Address({ label, value, explorerUrl }: { readonly label: string; readonly value: string | null; readonly explorerUrl: string }) {
  return (
    <div className="py-2 text-sm">
      <p className="text-fg-2">{label}</p>
      {value === null ? (
        <p className="text-fg-3">Unavailable (read failed)</p>
      ) : (
        <a href={`${explorerUrl}/address/${value}`} target="_blank" rel="noreferrer" className="num break-all text-fg underline decoration-line-strong underline-offset-4 hover:decoration-btc">
          {value}
        </a>
      )}
    </div>
  )
}

export function PositionDetail({ position: p, data, onClose }: { readonly position: PositionDto; readonly data: MarketDto; readonly onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeButton.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose, p.tokenId])

  const drift = BigInt(p.boostDrift)
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="presentation">
      <button type="button" aria-label="Close details" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-ink-950/60 backdrop-blur-[1px]" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line bg-ink-900 shadow-2xl"
      >
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-line bg-ink-900 px-5 py-4">
          <div>
            <h4 id="detail-title" className="font-condensed text-2xl font-medium">
              veBTC #{p.tokenId}
            </h4>
            <div className="mt-1">
              <StatusLabel status={p.status} />
            </div>
          </div>
          <button ref={closeButton} type="button" onClick={onClose} className="rounded-md border border-line px-2.5 py-1 text-sm text-fg-2 hover:text-fg">
            Close
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          <section>
            <h5 className="text-sm font-medium text-fg">Boost</h5>
            <dl className="mt-1">
              <Item label="Live boost (contract formula)">{boost(p.liveBoost, 4)}</Item>
              <Item label="Applied on veBTC">{boost(p.storedBoost, 4)}</Item>
              <Item label="Difference">{drift === 0n ? "None" : boostDelta(p.boostDrift, 4)}</Item>
            </dl>
            {drift !== 0n ? (
              <p className="mt-2 text-xs leading-relaxed text-fg-3">
                The live value is not yet applied to this veBTC. Anyone can apply it with a permissionless poke on Mezo; Boost Relay
                does not send transactions.
              </p>
            ) : null}
          </section>

          <section>
            <h5 className="text-sm font-medium text-fg">Votes on this gauge</h5>
            <dl className="mt-1">
              <Item label="veMEZO weight">{amount(p.gaugeWeight, 18, 4)}</Item>
              <Item label="Adds no boost">{amount(p.excessWeight, 18, 4)}</Item>
              <Item label="veBTC voting power (unboosted)">{amount(p.unboostedVotingPower, 18, 6)}</Item>
            </dl>
          </section>

          <section>
            <h5 className="text-sm font-medium text-fg">What each boost level needs</h5>
            <table className="num mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-fg-3">
                  <th className="py-1.5 font-normal">Target</th>
                  <th className="py-1.5 text-right font-normal">Total weight</th>
                  <th className="py-1.5 text-right font-normal">From here</th>
                </tr>
              </thead>
              <tbody>
                {(["2x", "3x", "5x"] as const).map((label) => {
                  const t = p.targets[label]
                  return (
                    <tr key={label} className="border-t border-line">
                      <td className="py-2">{label}</td>
                      <td className="py-2 text-right">{t.reachable ? compact(t.requiredWeight) : "–"}</td>
                      <td className="py-2 text-right">{targetText(t)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs leading-relaxed text-fg-3">
              Exact minimum veMEZO weight on this gauge under the contract&apos;s integer rounding, at block{" "}
              {integer(data.meta.blockNumber)}. Requirements drift as voting power decays.
            </p>
          </section>

          <section>
            <h5 className="text-sm font-medium text-fg">Lock</h5>
            <dl className="mt-1">
              <Item label="Locked">{lockedBtc(p)}</Item>
              <Item label="Ends">{p.lock.isPermanent ? "Permanent" : BigInt(p.lock.end) === 0n ? "None" : utcDateTime(p.lock.end)}</Item>
            </dl>
          </section>

          <section>
            <h5 className="text-sm font-medium text-fg">Incentives this epoch</h5>
            {p.incentives.status === "posted" || p.incentives.status === "none-posted" ? (
              p.incentives.tokens.length === 0 ? (
                <p className="mt-1 text-sm text-fg-2">Read successfully: no incentive tokens on this gauge.</p>
              ) : (
                <dl className="mt-1">
                  {p.incentives.tokens.map((t) => (
                    <Item key={t.token} label={t.symbol ?? `${t.token.slice(0, 10)}… (symbol unavailable)`}>
                      {t.decimals === null ? `${t.postedForEpoch} raw units` : amount(t.postedForEpoch, t.decimals, 4)}
                    </Item>
                  ))}
                </dl>
              )
            ) : (
              <p className="mt-1 text-sm text-fg-2">
                {p.incentives.status === "not-read" ? "Not read: the gauge is closed." : "Unavailable: the incentive read failed or the gauge has no incentive contract."}
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-fg-3">Amounts posted so far this epoch. Not a yield or a claimable reward.</p>
          </section>

          <section>
            <h5 className="text-sm font-medium text-fg">Addresses</h5>
            <Address label="Boost gauge" value={p.gauge} explorerUrl={data.meta.explorerUrl} />
            <Address label="Incentive contract" value={p.bribe} explorerUrl={data.meta.explorerUrl} />
            <Address label="veBTC owner" value={p.owner} explorerUrl={data.meta.explorerUrl} />
          </section>
        </div>
      </aside>
    </div>
  )
}

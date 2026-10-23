"use client"

import type { PositionDto } from "@/lib/market-dto"
import { boost, boostDelta, compact, short } from "@/lib/market-formatting"
import { BoostValue, IncentiveCell, LockCell, StatusLabel, ToMaxCell } from "./position-cells"

function AddressLink({ address, explorerUrl }: { readonly address: string | null; readonly explorerUrl: string }) {
  if (address === null) return <span className="text-fg-3">Unavailable</span>
  return (
    <a
      href={`${explorerUrl}/address/${address}`}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="num text-fg-2 underline decoration-line-strong underline-offset-4 hover:text-fg"
      title={address}
    >
      {short(address)}
    </a>
  )
}

export function MarketTable(props: {
  readonly rows: readonly PositionDto[]
  readonly selected: string | null
  readonly explorerUrl: string
  /** Snapshot block time (unix seconds). */
  readonly asOf: string
  readonly onSelect: (tokenId: string, origin: HTMLElement) => void
}) {
  return (
    <>
      {/* Desktop and tablet: a real table. */}
      <div className="mt-5 hidden overflow-x-auto rounded-lg border border-line md:block">
        <table className="w-full min-w-[1080px] text-sm">
          <caption className="sr-only">veBTC boost positions. Select a token id to see details.</caption>
          <thead className="bg-ink-900 text-left text-xs text-fg-3">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-normal">veBTC</th>
              <th scope="col" className="px-3 py-2.5 font-normal">Status</th>
              <th scope="col" className="px-3 py-2.5 text-right font-normal">Votes (veMEZO)</th>
              <th scope="col" className="px-3 py-2.5 font-normal">Live boost</th>
              <th scope="col" className="px-3 py-2.5 text-right font-normal">Applied boost</th>
              <th scope="col" className="px-3 py-2.5 text-right font-normal">Needed for 5x</th>
              <th scope="col" className="px-3 py-2.5 font-normal">Incentives this epoch</th>
              <th scope="col" className="px-3 py-2.5 font-normal">Lock ends</th>
              <th scope="col" className="px-3 py-2.5 font-normal">Gauge</th>
              <th scope="col" className="px-3 py-2.5 font-normal">Owner</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((p) => {
              const selected = props.selected === p.tokenId
              return (
                <tr
                  key={p.tokenId}
                  onClick={(e) => props.onSelect(p.tokenId, e.currentTarget.querySelector("button") ?? e.currentTarget)}
                  className={`cursor-pointer border-t border-line align-top transition-colors hover:bg-ink-900 ${selected ? "bg-ink-850" : ""}`}
                >
                  <th scope="row" className="px-3 py-2.5 text-left font-normal">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        props.onSelect(p.tokenId, e.currentTarget)
                      }}
                      aria-label={`Show details for veBTC #${p.tokenId}`}
                      className="num font-medium text-fg underline decoration-transparent underline-offset-4 hover:decoration-btc"
                    >
                      #{p.tokenId}
                    </button>
                  </th>
                  <td className="px-3 py-2.5">
                    <StatusLabel status={p.status} />
                  </td>
                  <td className="num px-3 py-2.5 text-right">{compact(p.gaugeWeight)}</td>
                  <td className="px-3 py-2.5">
                    <BoostValue value={p.liveBoost} />
                  </td>
                  <td className="num px-3 py-2.5 text-right">
                    {boost(p.storedBoost)}
                    {p.boostDrift !== "0" ? <span className="block text-xs text-fg-3">{boostDelta(p.boostDrift)} pending</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <ToMaxCell position={p} />
                  </td>
                  <td className="px-3 py-2.5">
                    <IncentiveCell position={p} />
                  </td>
                  <td className="px-3 py-2.5">
                    <LockCell position={p} asOf={props.asOf} />
                  </td>
                  <td className="px-3 py-2.5">
                    <AddressLink address={p.gauge} explorerUrl={props.explorerUrl} />
                  </td>
                  <td className="px-3 py-2.5">
                    <AddressLink address={p.owner} explorerUrl={props.explorerUrl} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Phones: one button per position. */}
      <ul className="mt-5 grid gap-2 md:hidden">
        {props.rows.map((p) => (
          <li key={p.tokenId}>
            <button
              type="button"
              onClick={(e) => props.onSelect(p.tokenId, e.currentTarget)}
              className={`grid w-full grid-cols-2 gap-x-4 gap-y-2 rounded-lg border px-4 py-3 text-left ${
                props.selected === p.tokenId ? "border-btc/60 bg-ink-850" : "border-line bg-ink-900"
              }`}
            >
              <span className="num font-medium text-fg">veBTC #{p.tokenId}</span>
              <span className="justify-self-end">
                <StatusLabel status={p.status} />
              </span>
              <span className="text-xs text-fg-3">
                Live boost
                <span className="mt-0.5 block text-sm text-fg">
                  <BoostValue value={p.liveBoost} />
                </span>
              </span>
              <span className="text-right text-xs text-fg-3">
                Votes
                <span className="num mt-0.5 block text-sm text-fg">{compact(p.gaugeWeight)}</span>
              </span>
              <span className="col-span-2 flex items-baseline justify-between border-t border-line pt-2 text-xs text-fg-3">
                Needed for 5x
                <span className="text-sm text-fg">
                  <ToMaxCell position={p} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

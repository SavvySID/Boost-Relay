import type { IncentiveStatus, MarketDto } from "@/lib/market-dto"
import { amount, integer, short, utcDateTime } from "@/lib/market-formatting"

const STATUS_TEXT: Record<IncentiveStatus, string> = {
  posted: "Posted this epoch",
  "none-posted": "Confirmed none this epoch",
  unavailable: "Unavailable (read failed or no incentive contract)",
  "not-read": "Not read (gauge closed)",
}

export function IncentivePanel({ data }: { readonly data: MarketDto }) {
  const { incentives, meta } = data
  const counts: Record<IncentiveStatus, number> = { posted: 0, "none-posted": 0, unavailable: 0, "not-read": 0 }
  for (const p of data.positions) counts[p.incentives.status]++
  const posted = data.positions.filter((p) => p.incentives.status === "posted")

  return (
    <section aria-labelledby="incentives-title" className="border-t border-line py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="incentives-title" className="font-condensed text-xl font-medium">
          Incentives posted this epoch
        </h3>
        <p className="text-xs text-fg-3">
          {utcDateTime(incentives.epochStart)} to {utcDateTime(incentives.epochNext)}, read at block {integer(meta.blockNumber)}
          {incentives.completeness === "partial" ? <span className="text-warn">, partial</span> : null}
        </p>
      </div>
      <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-fg-2">
        Tokens deposited on boost gauges for the current epoch so far. They are paid out to voters by vote share after the epoch
        ends, so they are not a yield or a claimable amount. No prices are shown.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {(Object.keys(STATUS_TEXT) as IncentiveStatus[]).map((s) => (
          <div key={s}>
            <dt className="text-xs leading-snug text-fg-3">{STATUS_TEXT[s]}</dt>
            <dd className="num mt-0.5 text-lg text-fg">{integer(counts[s])}</dd>
          </div>
        ))}
      </dl>

      {posted.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-fg-2">
          No gauge in this snapshot has incentives posted for the current epoch.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line">
          <table className="num w-full min-w-[560px] text-sm">
            <thead className="bg-ink-900 text-left text-xs text-fg-3">
              <tr>
                <th scope="col" className="px-3 py-2 font-normal">veBTC</th>
                <th scope="col" className="px-3 py-2 font-normal">Gauge</th>
                <th scope="col" className="px-3 py-2 font-normal">Token</th>
                <th scope="col" className="px-3 py-2 text-right font-normal">Posted</th>
              </tr>
            </thead>
            <tbody>
              {posted.flatMap((p) =>
                p.incentives.tokens
                  .filter((t) => t.postedForEpoch !== "0")
                  .map((t) => (
                    <tr key={`${p.tokenId}:${t.token}`} className="border-t border-line">
                      <td className="px-3 py-2">#{p.tokenId}</td>
                      <td className="px-3 py-2 text-fg-2" title={p.gauge}>
                        {short(p.gauge)}
                      </td>
                      <td className="px-3 py-2">
                        {t.symbol ?? <span title={t.token}>{short(t.token)} <span className="text-fg-3">(symbol unavailable)</span></span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {t.decimals === null ? `${t.postedForEpoch} raw units` : `${amount(t.postedForEpoch, t.decimals, 4)} ${t.symbol ?? ""}`}
                      </td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

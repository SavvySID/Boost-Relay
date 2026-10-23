import type { IncentiveStatus, MarketDto } from "@/lib/market-dto"
import { amount, integer, short, utcDateTime } from "@/lib/market-formatting"
import { chip, ui } from "@/lib/ui"

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
    <section aria-labelledby="incentives-title" className={`${ui.card} ${ui.cardBody}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="incentives-title" className={ui.sectionTitle}>
          Incentives posted this epoch
        </h3>
        <p className="flex flex-wrap items-center gap-2 text-xs text-fg-3">
          {utcDateTime(incentives.epochStart)} to {utcDateTime(incentives.epochNext)}, read at block {integer(meta.blockNumber)}
          {incentives.completeness === "partial" ? <span className={chip("warn")}>partial</span> : null}
        </p>
      </div>
      <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-fg-2">
        Tokens deposited on boost gauges for the current epoch so far. They are paid out to voters by vote share after the epoch ends, so they are
        not a yield or a claimable amount. No prices are shown.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(STATUS_TEXT) as IncentiveStatus[]).map((s) => (
          <div key={s} className="rounded-[var(--radius-md)] bg-subtle px-3.5 py-3">
            <dt className="text-xs leading-snug text-fg-3">{STATUS_TEXT[s]}</dt>
            <dd className="num mt-1 text-lg font-medium text-fg">{integer(counts[s])}</dd>
          </div>
        ))}
      </dl>

      {posted.length === 0 ? (
        <p className="mt-5 rounded-[var(--radius-md)] bg-subtle px-4 py-6 text-center text-sm text-fg-2">No gauge in this snapshot has incentives posted for the current epoch.</p>
      ) : (
        <div className="-mx-5 mt-5 overflow-x-auto border-t border-line sm:-mx-6">
          <table className="num w-full min-w-[560px] text-sm">
            <thead className="bg-subtle text-left text-xs text-fg-3">
              <tr>
                <th scope="col" className="py-2.5 pl-5 pr-3 font-medium sm:pl-6">veBTC</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Gauge</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Token</th>
                <th scope="col" className="py-2.5 pl-3 pr-5 text-right font-medium sm:pr-6">Posted</th>
              </tr>
            </thead>
            <tbody>
              {posted.flatMap((p) =>
                p.incentives.tokens
                  .filter((t) => t.postedForEpoch !== "0")
                  .map((t) => (
                    <tr key={`${p.tokenId}:${t.token}`} className="border-t border-line">
                      <td className="py-2.5 pl-5 pr-3 sm:pl-6">#{p.tokenId}</td>
                      <td className="px-3 py-2.5 text-fg-2" title={p.gauge}>
                        {short(p.gauge)}
                      </td>
                      <td className="px-3 py-2.5">
                        {t.symbol ?? (
                          <span title={t.token}>
                            {short(t.token)} <span className="text-fg-3">(symbol unavailable)</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 pr-5 text-right sm:pr-6">
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

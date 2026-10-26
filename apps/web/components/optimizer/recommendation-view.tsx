"use client"

import { useState, type ReactNode } from "react"
import { amount, boost, integer, short } from "@/lib/market-formatting"
import type { OptimizerDto, RecommendationDto } from "@/lib/optimizer-dto"
import { compareOutcome } from "@/lib/optimizer-outcome"
import { chip, ui } from "@/lib/ui"
import type { Strategy } from "./strategy-selector"

/** veMEZO amount with up to 4 decimals; tiny non-zero values read "<0.0001" rather than 0. */
function vemezo(v: string): string {
  const n = BigInt(v)
  if (n === 0n) return "0"
  if (n > 0n && n < 10n ** 14n) return "<0.0001"
  return amount(n, 18, 4)
}

function signed(v: string): string {
  const n = BigInt(v)
  return `${n > 0n ? "+" : n < 0n ? "-" : ""}${vemezo((n < 0n ? -n : n).toString())}`
}

function Stat({ label, value, note }: { readonly label: string; readonly value: ReactNode; readonly note?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-subtle px-4 py-3">
      <dt className={ui.label}>{label}</dt>
      <dd className="num mt-1 text-lg font-medium text-fg">{value}</dd>
      {note ? <dd className="mt-0.5 text-xs leading-snug text-fg-3">{note}</dd> : null}
    </div>
  )
}

/** Current -> projected boost on one 1x..5x track. */
function BoostChange({ from, to }: { readonly from: string; readonly to: string }) {
  const pct = (v: string) => Math.max(0, Math.min(100, Number(((BigInt(v) - 10n ** 18n) * 1000n) / (4n * 10n ** 18n)) / 10))
  return (
    <span className="inline-flex items-center gap-2">
      <span className="num w-[7.5rem] text-right">
        {boost(from)} <span className="text-fg-3">to</span> <span className="font-medium text-fg">{boost(to)}</span>
      </span>
      <span aria-hidden="true" className="relative h-1.5 w-16 overflow-hidden rounded-full bg-fill">
        <span className="absolute inset-y-0 left-0 rounded-full bg-line-strong" style={{ width: `${pct(from)}%` }} />
        <span className="absolute inset-y-0 rounded-r-full" style={{ left: `${pct(from)}%`, width: `${Math.max(0, pct(to) - pct(from))}%`, background: "var(--color-viz-boost)" }} />
      </span>
    </span>
  )
}

const STATUS = {
  actionable: { tone: "success" as const, title: "Proposal ready", text: "Every check passed. This is a proposal; nothing is sent unless the NFT's owner reviews and signs it below (Mezo Testnet only)." },
  informational: { tone: "warn" as const, title: "For analysis only", text: "This NFT cannot vote right now, so the plan cannot be used as-is. It shows what a vote would do." },
  blocked: { tone: "danger" as const, title: "No recommendation", text: "A requirement for a trustworthy recommendation is missing." },
}

function percentBps(v: number): string {
  return `${(v / 100).toFixed(v > 0 && v < 10 ? 2 : 1)}%`
}

function Change({ value }: { readonly value: number }) {
  if (value === 0) return <span className="text-fg-3">no change</span>
  return <span className={value > 0 ? "font-medium text-success-fg" : "font-medium text-danger-fg"}>{value > 0 ? `+${integer(value)}` : `-${integer(-value)}`}</span>
}

/** Before -> after numbers for the selected plan. Projections at the source block, never confirmed results. */
function Outcome({ data, rec }: { readonly data: OptimizerDto; readonly rec: RecommendationDto }) {
  const c = compareOutcome(rec, data.candidateMarket.atCap ?? null)
  const s = rec.summary
  if (c === null || s === null) return null
  const rows: { label: string; note: string; before: ReactNode; after: ReactNode; change: ReactNode }[] = [
    {
      label: "Boosted veBTC power",
      note: `Unboosted power x live boost, summed over the ${c.affected} ${c.affected === 1 ? "position" : "positions"} this vote touches.`,
      before: vemezo(c.boostedBefore.toString()),
      after: vemezo(c.boostedAfter.toString()),
      change: (
        <span className={c.boostedChange > 0n ? "font-medium text-success-fg" : c.boostedChange < 0n ? "font-medium text-danger-fg" : "text-fg-3"}>
          {c.boostedChange === 0n ? "no change" : signed(c.boostedChange.toString())}
          {c.boostedChangeBps !== null && c.boostedChange !== 0n ? ` (${c.boostedChange > 0n ? "+" : ""}${percentBps(c.boostedChangeBps)})` : ""}
        </span>
      ),
    },
    {
      label: "At 5x, positions this vote touches",
      note: "Includes positions that lose votes this NFT currently gives them.",
      before: `${c.affectedAtCapBefore} of ${c.affected}`,
      after: `${c.affectedAtCapAfter} of ${c.affected}`,
      change: <Change value={c.affectedAtCapAfter - c.affectedAtCapBefore} />,
    },
  ]
  if (c.marketAtCapBefore !== null && c.marketAtCapAfter !== null) {
    rows.push({
      label: "At 5x, whole market",
      note: `Active positions at the cap, of ${integer(data.candidateMarket.activePositions)} active.`,
      before: integer(c.marketAtCapBefore),
      after: integer(c.marketAtCapAfter),
      change: <Change value={c.marketAtCapAfter - c.marketAtCapBefore} />,
    })
  }
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium text-fg">Projected outcome</h4>
        <p className="text-xs text-fg-3">At block {integer(data.sourceBlock)} with BoostVoter&apos;s formula. A projection, not a confirmed result.</p>
      </div>
      <dl className="mt-2 divide-y divide-line rounded-[var(--radius-md)] border border-line">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] gap-3 bg-subtle px-4 py-2 text-xs text-fg-3 sm:grid">
          <span>Measure</span>
          <span className="text-right">Now</span>
          <span className="text-right">After this vote</span>
          <span className="text-right">Change</span>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] sm:items-center">
            <dt className="min-w-0">
              <span className="text-fg">{r.label}</span>
              <span className="block text-xs leading-snug text-fg-3">{r.note}</span>
            </dt>
            <dd className="num text-right text-fg-2 max-sm:col-start-2 max-sm:row-start-1">
              <span className="sm:hidden">
                {r.before} <span className="text-fg-3">to</span> <span className="font-medium text-fg">{r.after}</span>
              </span>
              <span className="hidden sm:inline">{r.before}</span>
            </dd>
            <dd className="num hidden text-right font-medium text-fg sm:block">{r.after}</dd>
            <dd className="num text-right text-xs max-sm:col-span-2 sm:text-sm">{r.change}</dd>
          </div>
        ))}
      </dl>
      <p className="num mt-2 text-xs leading-relaxed text-fg-3">
        Voting power: {vemezo(c.votesUsed.toString())} of {vemezo(c.votingPower.toString())} veMEZO allocated across {s.gaugesUsed} of {s.maxGauges} allowed gauges;{" "}
        {c.unused === 0n ? "nothing left unallocated." : `${vemezo(c.unused.toString())} left unallocated by vote()'s integer rounding.`}{" "}
        {s.excessAbove5x === "0" ? "No votes land past a 5x cap." : `${vemezo(s.excessAbove5x)} veMEZO lands past a 5x cap (adds no boost there).`}
      </p>
    </div>
  )
}

/** Both strategies side by side for this NFT, with the selected one marked. */
function StrategyComparison({ data, strategy }: { readonly data: OptimizerDto; readonly strategy: Strategy }) {
  const ids = ["max-boosted-power", "max-capped-positions"] as const
  const sums = ids.map((id) => data.recommendations[id].summary)
  const [a, b] = sums
  if (a === null || b === null || a === undefined || b === undefined) return null
  const rows: { label: string; values: [ReactNode, ReactNode] }[] = [
    { label: "Gauges used", values: [`${a.gaugesUsed}`, `${b.gaugesUsed}`] },
    { label: "Positions taken to 5x", values: [integer(a.positionsReaching5x), integer(b.positionsReaching5x)] },
    { label: "Boosted power gain", values: [signed(a.boostedPowerChange), signed(b.boostedPowerChange)] },
    { label: "Votes past a 5x cap", values: [vemezo(a.excessAbove5x), vemezo(b.excessAbove5x)] },
  ]
  return (
    <div>
      <h4 className="text-sm font-medium text-fg">Both strategies for this NFT</h4>
      <div className="mt-2 overflow-hidden rounded-[var(--radius-md)] border border-line">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">The two optimizer strategies compared for this NFT at the same block</caption>
          <thead className="bg-subtle text-left text-xs text-fg-3">
            <tr>
              <th scope="col" className="w-[38%] px-3 py-2 font-medium sm:px-4">Measure</th>
              {ids.map((id) => (
                <th key={id} scope="col" className={`px-3 py-2 text-right font-medium sm:px-4 ${id === strategy ? "text-fg" : ""}`}>
                  {data.strategies[id].label}
                  {id === strategy ? <span className="block text-[11px] font-normal text-fg-3">selected</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line">
                <th scope="row" className="px-3 py-2 text-left font-normal text-fg-2 sm:px-4">
                  {r.label}
                </th>
                {r.values.map((v, i) => (
                  <td key={ids[i]} className={`num px-3 py-2 text-right text-xs [overflow-wrap:anywhere] sm:px-4 sm:text-sm ${ids[i] === strategy ? "font-medium text-fg" : "text-fg-2"}`}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Lines({ rec, explorerUrl }: { readonly rec: RecommendationDto; readonly explorerUrl: string }) {
  const power = BigInt(rec.summary?.votingPower ?? "0")
  const [open, setOpen] = useState<string | null>(null)
  return (
    <ol className="divide-y divide-line">
      {rec.lines.map((l) => {
        const expanded = open === l.gauge
        return (
          <li key={l.gauge} className="py-3">
            <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-2 md:grid-cols-[2rem_9rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,14rem)_auto] md:items-center">
              <span className="num text-sm text-fg-3">{l.rank}</span>
              <span className="num text-sm font-medium text-fg">
                veBTC #{l.tokenId}
                <a href={`${explorerUrl}/address/${l.gauge}`} target="_blank" rel="noreferrer" className="block text-xs font-normal text-fg-3 hover:text-fg" title={l.gauge}>
                  gauge {short(l.gauge)}
                </a>
              </span>
              <span className="num col-start-2 text-sm md:col-start-auto">
                <span className={ui.label}>Proposed votes</span>
                <span className="block font-medium text-fg">
                  {vemezo(l.predictedVotes)}
                  {power > 0n ? <span className="ml-1.5 text-xs font-normal text-fg-3">{percentBps(Number((BigInt(l.predictedVotes) * 10_000n) / power))}</span> : null}
                </span>
              </span>
              <span className="num col-start-2 text-sm md:col-start-auto">
                <span className={ui.label}>Gauge weight now / after</span>
                <span className="block text-fg">
                  {vemezo(l.currentGaugeWeight)} / {vemezo(l.projectedGaugeWeight)}
                </span>
              </span>
              <span className="col-start-2 text-sm md:col-start-auto">
                <span className={`${ui.label} block`}>Live boost</span>
                <BoostChange from={l.currentBoost} to={l.projectedBoost} />
              </span>
              <span className="col-start-2 flex flex-wrap items-center gap-2 md:col-start-auto md:justify-end">
                {l.role === "fills-to-5x" ? <span className={chip("success")}>Reaches 5x</span> : null}
                {l.role === "partial" ? <span className={chip("info")}>Partial</span> : null}
                {l.role === "leftover" ? <span className={chip("warn")}>Past cap</span> : null}
                <button type="button" onClick={() => setOpen(expanded ? null : l.gauge)} aria-expanded={expanded} className={ui.btnQuiet}>
                  {expanded ? "Hide why" : "Why"}
                </button>
              </span>
            </div>
            {expanded ? (
              <ul className="ml-11 mt-2 grid gap-1.5 rounded-[var(--radius-md)] bg-subtle px-4 py-3 text-sm leading-relaxed text-fg-2">
                {l.reasons.map((r) => (
                  <li key={r.code}>{r.text}</li>
                ))}
                {l.nftPriorVotes !== "0" ? <li className="num text-xs text-fg-3">This NFT now: {vemezo(l.nftPriorVotes)} on this gauge.</li> : null}
                {l.excessAbove5x !== "0" ? <li className="num text-xs text-fg-3">Past the 5x requirement: {vemezo(l.excessAbove5x)}.</li> : null}
              </ul>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

export function RecommendationView({ data, strategy }: { readonly data: OptimizerDto; readonly strategy: Strategy }) {
  const rec = data.recommendations[strategy]
  const status = STATUS[rec.status]
  const s = rec.summary
  const [showChecks, setShowChecks] = useState(false)
  const [showCall, setShowCall] = useState(false)

  return (
    <section aria-labelledby="rec-title" className={`${ui.card} ${ui.cardBody} grid grid-cols-[minmax(0,1fr)] gap-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="rec-title" className="text-lg font-medium tracking-tight text-fg">
            {data.strategies[strategy].label}
          </h3>
          <p className="mt-0.5 text-xs text-fg-3">Proposal for veMEZO #{data.token.tokenId} at block {integer(data.sourceBlock)}. Not submitted.</p>
        </div>
        <span className={chip(status.tone)}>{status.title}</span>
      </div>

      <div className={`rounded-[var(--radius-md)] px-4 py-3 text-sm ${rec.status === "actionable" ? "bg-success-bg text-success-fg" : rec.status === "informational" ? "bg-warn-bg text-warn-fg" : "bg-danger-bg text-danger-fg"}`}>
        <p>{status.text}</p>
        {rec.blockers.length > 0 ? (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {rec.blockers.map((b) => (
              <li key={b.code}>{b.text}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {s !== null ? (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Gauges used" value={`${s.gaugesUsed} of ${s.maxGauges}`} note={`${integer(s.candidateCount)} positions are below 5x`} />
            <Stat label="Positions reaching 5x" value={integer(s.positionsReaching5x)} note={`${s.positionsImproved} improved${s.positionsLosingBoost > 0 ? `, ${s.positionsLosingBoost} lose boost` : ""}`} />
            <Stat label="Boosted veBTC power" value={signed(s.boostedPowerChange)} note="Sum of unboosted power x live boost, affected positions" />
            <Stat label="Votes past a 5x cap" value={vemezo(s.excessAbove5x)} note={`of ${vemezo(s.votingPower)} veMEZO; ${vemezo(s.roundingRemainder)} left by rounding`} />
          </dl>
          <p className="text-sm leading-relaxed text-fg-2">{s.objectiveNote}</p>
          <Outcome data={data} rec={rec} />
          <StrategyComparison data={data} strategy={strategy} />
        </>
      ) : null}

      {rec.lines.length > 0 ? (
        <div>
          <h4 className="text-sm font-medium text-fg">Ranked allocation</h4>
          <Lines rec={rec} explorerUrl={data.explorerUrl} />
        </div>
      ) : null}

      {rec.removed.length > 0 ? (
        <div>
          <h4 className="text-sm font-medium text-fg">Existing votes this vote would remove</h4>
          <ul className="num mt-2 grid gap-1 text-sm text-fg-2">
            {rec.removed.map((r) => (
              <li key={r.gauge}>
                {r.tokenId !== null ? `veBTC #${r.tokenId}` : `gauge ${short(r.gauge)}`}: {vemezo(r.priorVotes)} removed
                {r.currentBoost !== null && r.projectedBoost !== null ? `, boost ${boost(r.currentBoost)} to ${boost(r.projectedBoost)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rec.warnings.length > 0 ? (
        <div>
          <h4 className="text-sm font-medium text-fg">Before relying on this</h4>
          <ul className="mt-2 grid gap-1.5 text-sm leading-relaxed text-fg-2">
            {rec.warnings.map((w) => (
              <li key={w.code} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-fg-3" />
                {w.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {rec.checks.length > 0 ? (
          <button type="button" onClick={() => setShowChecks((v) => !v)} aria-expanded={showChecks} className={ui.btnSecondary}>
            {showChecks ? "Hide" : "Show"} validation ({rec.checks.filter((c) => c.ok).length}/{rec.checks.length} passed)
          </button>
        ) : null}
        {rec.voteCall !== null ? (
          <button type="button" onClick={() => setShowCall((v) => !v)} aria-expanded={showCall} className={ui.btnSecondary}>
            {showCall ? "Hide" : "Show"} proposed vote() call
          </button>
        ) : null}
      </div>

      {showChecks ? (
        <ul className="grid gap-1.5 text-sm">
          {rec.checks.map((c) => (
            <li key={c.name} className="flex items-start gap-2">
              <span className={chip(c.ok ? "success" : "danger")}>{c.ok ? "Pass" : "Fail"}</span>
              <span className="text-fg">
                {c.name} <span className="text-fg-3">({c.detail})</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {showCall && rec.voteCall !== null ? (
        <div className="rounded-[var(--radius-md)] border border-line">
          <p className="border-b border-line bg-subtle px-4 py-2.5 text-xs text-fg-2">
            Proposal only, not submitted. {rec.voteCall.executable ? "A later phase can ask the NFT's owner to sign it." : "Not executable now: see the status above."}
          </p>
          <dl className="grid gap-2 px-4 py-3 text-sm">
            <div>
              <dt className={ui.label}>Contract (BoostVoter)</dt>
              <dd className="num break-all text-fg">{rec.voteCall.to}</dd>
            </div>
            <div>
              <dt className={ui.label}>Function</dt>
              <dd className="font-mono text-fg">{rec.voteCall.signature}</dd>
            </div>
            <div>
              <dt className={ui.label}>Weights</dt>
              <dd className="text-xs leading-relaxed text-fg-2">{rec.voteCall.weightSemantics}</dd>
            </div>
            {rec.calldata !== null ? (
              <div>
                <dt className={ui.label}>Calldata (encoded with the verified ABI)</dt>
                <dd className="mt-1 max-h-32 overflow-y-auto break-all rounded-[var(--radius-sm)] bg-subtle p-2 font-mono text-xs text-fg-2">{rec.calldata}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </section>
  )
}

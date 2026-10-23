import type { ReactNode } from "react"
import type { MarketDto } from "@/lib/market-dto"
import { compact, integer, percent } from "@/lib/market-formatting"
import { chip, ui } from "@/lib/ui"

const NETWORK_LABEL = { mainnet: "Mezo Mainnet", testnet: "Mezo Testnet" } as const

function Strong({ children }: { readonly children: ReactNode }) {
  return <span className="font-semibold text-fg">{children}</span>
}

/** The live headline: a sentence written from this snapshot's numbers. */
export function MarketSummary({ data }: { readonly data: MarketDto }) {
  const { summary, meta } = data
  const partial = meta.completeness === "partial"
  return (
    <div className="max-w-[60rem]">
      <p className="flex flex-wrap items-center gap-2 text-sm text-fg-2">
        {NETWORK_LABEL[meta.network]} at block <span className="num">{integer(meta.blockNumber)}</span>
        {partial ? <span className={chip("warn")}>Partial snapshot</span> : null}
      </p>
      <h2 id="overview-title" className="mt-3 text-[clamp(1.5rem,3vw,2.25rem)] font-medium leading-[1.15] tracking-[-0.02em] text-fg-2">
        {summary.livePositions === 0 ? (
          <>No active veBTC boost positions were found at this block.</>
        ) : (
          <>
            <Strong>{compact(summary.excessWeightOnLive)} veMEZO</Strong> of the {compact(summary.weightOnLivePositions)} voting on active veBTC
            positions sits above what a 5x boost needs, while{" "}
            <Strong>
              {integer(summary.unboosted)} active {summary.unboosted === 1 ? "position has" : "positions have"}
            </Strong>{" "}
            no votes at all.
          </>
        )}
      </h2>
      <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-fg-2">
        Votes past a position&apos;s 5x requirement add no further boost to it. They can still earn incentives or off-chain rewards, so this
        measures boost efficiency, not lost income.
      </p>
    </div>
  )
}

function Row(props: { readonly label: string; readonly value: ReactNode; readonly children: ReactNode; readonly partial?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-b border-line py-3.5 last:border-b-0">
      <dt className="text-sm text-fg">{props.label}</dt>
      <dd className="num text-right text-sm font-medium text-fg">
        {props.value}
        {props.partial ? <span className={`ml-2 ${chip("warn")}`}>partial</span> : null}
      </dd>
      <dd className="col-span-2 text-xs leading-relaxed text-fg-3">{props.children}</dd>
    </div>
  )
}

/** Precisely defined market metrics for the selected snapshot. */
export function MetricsLedger({ data }: { readonly data: MarketDto }) {
  const { summary, derived, meta, global } = data
  const partial = meta.completeness === "partial"
  const inactive = data.positions.length - derived.statusCounts.active
  const failed = meta.failures.length
  return (
    <section aria-labelledby="metrics-title" className={`${ui.card} ${ui.cardBody}`}>
      <h3 id="metrics-title" className={ui.sectionTitle}>
        This snapshot
      </h3>
      <dl className="mt-1">
        <Row label="Boost positions read" value={integer(data.positions.length)} partial={partial}>
          veBTC positions with a boost gauge, from token ids 1 to {integer(global.veBtcMaxTokenId)}. Failed reads are excluded, never counted as zero.
        </Row>
        <Row label="Active" value={integer(summary.livePositions)} partial={partial}>
          Gauge open and the veBTC lock still has voting power. {integer(inactive)} more are expired or inactive.
          {derived.liveMatchesActive ? null : " Status and summary counts disagree; treat as partial."}
        </Row>
        <Row label="At the 5x cap" value={integer(summary.atCap)} partial={partial}>
          Active positions receiving the maximum boost.
        </Row>
        <Row label="Below 5x, with votes" value={integer(summary.partiallyBoosted)} partial={partial}>
          Active positions with some veMEZO votes but under the cap.
        </Row>
        <Row label="No votes" value={integer(summary.unboosted)} partial={partial}>
          Active positions with zero veMEZO weight on their gauge, so they stay at 1x.
        </Row>
        <Row
          label="Above the 5x requirement"
          value={
            <>
              {compact(summary.excessWeightOnLive)} <span className="font-normal text-fg-3">({percent(summary.excessShareOfLive, 1)})</span>
            </>
          }
          partial={partial}
        >
          veMEZO weight on active positions beyond the exact amount each needs for 5x, as a share of all weight on active positions.
        </Row>
        <Row label="Needed to bring the rest to 5x" value={compact(derived.additionalWeightToMaxBelowCap)} partial={partial}>
          Extra veMEZO the below-cap active positions need in total, using the contract&apos;s own rounding. All veMEZO voting power today:{" "}
          {compact(global.totalVeMezoVotingPower)}.
          {derived.belowCapNotMaxable > 0 ? ` ${integer(derived.belowCapNotMaxable)} positions cannot reach 5x and are not included.` : ""}
        </Row>
        <Row label="Snapshot" value={partial ? <span className={chip("warn")}>Partial</span> : <span className={chip("success")}>Complete</span>}>
          {partial
            ? `${integer(failed)} ${failed === 1 ? "read" : "reads"} failed. Counts above cover only positions that were read in full.`
            : failed > 0
              ? `Every position was read. ${integer(failed)} optional ${failed === 1 ? "read" : "reads"} (such as owner) failed and show as unavailable.`
              : "Every veBTC id was scanned and every position read succeeded at this block."}
        </Row>
      </dl>
    </section>
  )
}

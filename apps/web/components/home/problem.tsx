/**
 * Why allocation matters. The diagram is a labelled illustration of the contract's rule (boost
 * rises linearly with votes up to the 5x requirement), not market data.
 */
const ROWS = [
  { name: "Position A", votes: 1.6, note: "5x, the cap. The extra votes add no boost here." },
  { name: "Position B", votes: 0.55, note: "3.2x. More votes would still lift it." },
  { name: "Position C", votes: 0, note: "1x. No votes on its gauge at all." },
] as const

const CAP_AT = 62 // % of the track where each position's 5x requirement sits

function Track({ votes }: { readonly votes: number }) {
  const boosting = Math.min(votes, 1) * CAP_AT
  const above = Math.max(0, Math.min(votes - 1, (100 - CAP_AT) / CAP_AT)) * CAP_AT
  return (
    <div className="relative h-3 rounded-full bg-fill">
      {boosting > 0 ? <div className="absolute inset-y-0 left-0 rounded-l-full" style={{ width: `${boosting}%`, background: "var(--color-viz-boost)" }} /> : null}
      {above > 0 ? (
        <div className="absolute inset-y-0 rounded-r-full" style={{ left: `calc(${CAP_AT}% + 2px)`, width: `calc(${above}% - 2px)`, background: "var(--color-viz-over)" }} />
      ) : null}
      <div className="absolute -inset-y-1.5 border-l-2 border-dashed border-fg" style={{ left: `${CAP_AT}%` }} />
    </div>
  )
}

const POINTS = [
  {
    title: "Boost is capped at 5x",
    text: "A veBTC position's boost rises with the veMEZO votes on its gauge, up to the protocol's 5x cap. Past that point, more votes do not raise that position's boost.",
  },
  {
    title: "The target keeps moving",
    text: "veMEZO and veBTC voting power decay every second, and other voters move weight. The votes a position needs for 5x change from block to block, which makes manual allocation hard.",
  },
  {
    title: "Above-cap votes are not worthless",
    text: "They add no boost, but they can still earn posted incentives or count toward other reward programs. Boost Relay measures boost efficiency, not lost income.",
  },
] as const

export function Problem() {
  return (
    <section aria-labelledby="problem-title">
      <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20 lg:py-24">
        <div>
          <h2 id="problem-title" className="text-[clamp(1.75rem,3.2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.025em] text-balance text-fg">
            Boost stops at 5x. Votes don&apos;t.
          </h2>
          <p className="mt-4 max-w-[36rem] text-base leading-relaxed text-fg-2">
            Some veBTC positions collect far more veMEZO than they need for the maximum boost, while other active positions stay under-boosted or get no
            votes at all. Seeing that clearly is the first step to voting better.
          </p>
          <dl className="mt-10 grid gap-7">
            {POINTS.map((p) => (
              <div key={p.title} className="border-t border-line pt-5">
                <dt className="text-base font-medium text-fg">{p.title}</dt>
                <dd className="mt-1.5 max-w-[36rem] text-sm leading-relaxed text-fg-2">{p.text}</dd>
              </div>
            ))}
          </dl>
        </div>

        <figure className="self-center rounded-[var(--radius-lg)] border border-line bg-surface p-5 sm:p-8">
          <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-fg">Three positions, one rule</span>
            <span className="text-xs text-fg-3">Illustration, not live data</span>
          </figcaption>
          <div className="mt-8 grid gap-8">
            {ROWS.map((r) => (
              <div key={r.name}>
                <div className="mb-2.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium text-fg">{r.name}</span>
                  <span className="text-right text-xs text-fg-2">{r.note}</span>
                </div>
                <Track votes={r.votes} />
              </div>
            ))}
          </div>
          <div className="relative mt-3 h-5 text-xs text-fg-2" aria-hidden="true">
            <span className="absolute -translate-x-1/2 whitespace-nowrap font-medium text-fg" style={{ left: `${CAP_AT}%` }}>
              5x requirement
            </span>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-xs text-fg-2">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: "var(--color-viz-boost)" }} />
              Votes that add boost
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-sm" style={{ background: "var(--color-viz-over)" }} />
              Votes above the 5x requirement
            </li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-fg-3">
            Bars show veMEZO votes on each gauge relative to that position&apos;s own 5x requirement. Below it, boost grows in a straight line from 1x;
            BoostVoter computes the exact value with fixed-point math.
          </p>
        </figure>
      </div>
    </section>
  )
}

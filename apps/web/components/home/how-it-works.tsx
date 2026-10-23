const STEPS = [
  {
    title: "Explore the market",
    text: "Inspect real veBTC positions, their live and applied boosts, and the veMEZO votes on every gauge.",
  },
  {
    title: "Choose a strategy",
    text: "Emphasize the total boost improvement, or the number of positions that reach the 5x cap.",
  },
  {
    title: "Review the allocation",
    text: "Check the selected gauges, proposed weights, the current votes being replaced and the expected outcome.",
  },
  {
    title: "Simulate and sign",
    text: "For an eligible Mezo Testnet vote, connect your wallet, review fresh state and the exact calldata, simulate the call, then authorize it yourself.",
  },
] as const

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="bg-warm">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-24">
        <div className="max-w-2xl">
          <h2 id="how-title" className="text-[clamp(1.75rem,3.2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.025em] text-balance text-fg">
            From market data to a signed vote, in four steps
          </h2>
          <p className="mt-3 text-base leading-relaxed text-fg-2">
            Boost Relay never signs or sends a transaction on its own. Each step ends with you deciding what happens next.
          </p>
        </div>

        <ol className="relative mt-12 grid gap-10 lg:grid-cols-4 lg:gap-6">
          {/* Connector: vertical on small screens, horizontal through the step markers on large ones. */}
          <span aria-hidden="true" className="absolute bottom-4 left-[19px] top-4 w-px bg-line-strong lg:bottom-auto lg:left-5 lg:right-[calc(25%-2.4rem)] lg:top-5 lg:h-px lg:w-auto" />
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 lg:block">
              <span
                className={`num relative z-10 flex size-10 items-center justify-center rounded-full border text-sm font-medium ${
                  i === STEPS.length - 1 ? "border-fg bg-fg text-white" : "border-line-strong bg-surface text-fg"
                }`}
              >
                {i + 1}
              </span>
              <div className="lg:mt-6 lg:pr-4">
                <h3 className="text-lg font-medium tracking-tight text-fg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-2">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-12 flex max-w-3xl items-start gap-3 rounded-[var(--radius-md)] border border-line bg-surface px-5 py-4 text-sm leading-relaxed text-fg-body">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 size-5 shrink-0">
            <path d="M10 2.5 4 5v4.6c0 3.6 2.5 6.6 6 7.9 3.5-1.3 6-4.3 6-7.9V5l-6-2.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="m7.5 10 1.8 1.8 3.4-3.6" fill="none" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>
            <span className="font-medium text-fg">Your wallet stays in charge.</span> Connecting only shares your public address. The wallet is asked to sign
            only after you tick the review and click Sign &amp; Submit Vote, and Boost Relay waits for the real chain receipt before calling a vote confirmed.
          </span>
        </p>
      </div>
    </section>
  )
}

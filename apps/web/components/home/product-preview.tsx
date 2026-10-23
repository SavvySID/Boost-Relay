import Link from "next/link"
import { STRATEGIES } from "@boost-relay/optimizer"
import { ui } from "@/lib/ui"
import { ACKNOWLEDGEMENTS } from "@/lib/vote-copy"
import { ClosestToCap } from "./closest-to-cap"

/** The optimizer side is a static picture of the real review step: it has no inputs and sends nothing. */
function OptimizerPreview() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">Vote Optimizer</p>
          <p className="text-xs text-fg-3">Strategy and review</p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full border border-line px-2.5 py-0.5 text-xs text-fg-2">Preview</span>
      </div>
      <div className="grid flex-1 content-start gap-5 p-4 sm:p-5">
        <div>
          <p className="text-xs text-fg-3">Strategies</p>
          <ul className="mt-2 grid gap-2">
            {Object.values(STRATEGIES).map((s, i) => (
              <li key={s.label} className={`flex items-start gap-3 rounded-[var(--radius-md)] border px-3.5 py-3 ${i === 0 ? "border-fg" : "border-line"}`}>
                <span aria-hidden="true" className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${i === 0 ? "border-fg" : "border-line-strong"}`}>
                  {i === 0 ? <span className="size-2 rounded-full bg-fg" /> : null}
                </span>
                <span className="text-sm font-medium text-fg">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs text-fg-3">Before you sign, you confirm that</p>
          <ul className="mt-2 grid gap-2 rounded-[var(--radius-md)] bg-warm px-4 py-3.5 text-sm leading-relaxed text-fg-body">
            {ACKNOWLEDGEMENTS.slice(1, 4).map((a) => (
              <li key={a} className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-fg" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line bg-subtle px-4 py-3 sm:px-5">
        <Link href="/optimizer" className={`${ui.btnQuiet} -ml-3 font-medium text-fg`}>
          Open Vote Optimizer
        </Link>
      </div>
    </div>
  )
}

export function ProductPreview() {
  return (
    <section aria-labelledby="preview-title" className="border-t border-line">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h2 id="preview-title" className="text-[clamp(1.75rem,3.2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.025em] text-balance text-fg">
              Inside the app
            </h2>
            <p className="mt-3 text-base leading-relaxed text-fg-2">
              One panel is real Boost Market data: the active positions that need the fewest extra veMEZO to reach 5x. The other shows how the Vote
              Optimizer asks you to review a plan before anything is signed.
            </p>
          </div>
        </div>
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <ClosestToCap />
          <OptimizerPreview />
        </div>
      </div>
    </section>
  )
}

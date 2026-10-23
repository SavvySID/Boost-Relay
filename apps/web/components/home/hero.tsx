import Link from "next/link"
import { ui } from "@/lib/ui"
import { BoostCurveCard } from "./boost-curve"

function Assurance({ children }: { readonly children: string }) {
  return (
    <li className="flex items-center gap-2">
      <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4 shrink-0 text-fg">
        <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </li>
  )
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="border-b border-line">
      <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-14 lg:pb-24 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-fg-2">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
            Mezo Earn analytics
          </p>
          <h1 id="hero-title" className="mt-6 text-[clamp(2.6rem,5.6vw,4.25rem)] font-medium leading-[1] tracking-[-0.04em] text-balance text-fg">
            Make every veMEZO vote count.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-fg-2">
            See where Bitcoin boosts are underpowered, discover where voting power is going to waste, and build better veMEZO vote allocations with
            transparent on-chain analytics.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/market" className={`${ui.btnPrimary} px-6 py-3 text-base`}>
              Explore Boost Market
            </Link>
            <Link href="/optimizer" className={`${ui.btnSecondary} px-6 py-3 text-base`}>
              Optimize a vote
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-fg-2" aria-label="How Boost Relay works with your assets">
            <Assurance>Non-custodial analytics</Assurance>
            <Assurance>Testnet voting beta</Assurance>
            <Assurance>You sign every vote</Assurance>
          </ul>
        </div>

        <div className="rounded-[28px] bg-warm p-3 sm:p-5 lg:-mr-4 lg:p-6">
          <BoostCurveCard />
        </div>
      </div>
    </section>
  )
}

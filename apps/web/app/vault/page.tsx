import type { Metadata } from "next"
import Link from "next/link"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { chip, ui } from "@/lib/ui"

export const metadata: Metadata = {
  title: "Vault Relay",
  description:
    "Vault Relay is a planned, not-yet-built extension of Boost Relay exploring managed veMEZO voting, reward compounding and a possible liquid receipt token. It is not live and accepts no deposits.",
  openGraph: { title: "Vault Relay | Boost Relay", description: "Research in progress: a possible liquid, managed-voting future for veMEZO. Not live; no deposits." },
}

const H2 = "text-[clamp(1.6rem,3vw,2.4rem)] font-medium leading-[1.1] tracking-[-0.025em] text-balance text-fg"

const DESIGN = [
  {
    title: "Managed voting",
    text: "Pooled veMEZO voting power would follow a published strategy each epoch, such as the Vote Optimizer's boost-improvement plan, instead of every holder allocating by hand.",
  },
  {
    title: "Reward compounding",
    text: "Incentives earned by those votes could be claimed and re-locked, so the position's voting power grows instead of rewards sitting idle.",
  },
  {
    title: "rMEZO receipt token",
    text: "Depositors could receive a token representing their share of the locked voting power and its accrued rewards.",
  },
  {
    title: "A liquid market",
    text: "If rMEZO could trade, holders would have an exit before a multi-year lock ends. That only works with real, sustained liquidity.",
  },
] as const

const DEPENDENCIES = [
  {
    title: "Managed-lock permissions",
    text: "Mezo's veMEZO contract restricts managed locks to approved managers and governance. Whether, and how, an independent vault could use them is unresolved.",
  },
  {
    title: "Reward eligibility and vault economics",
    text: "It is not yet validated which rewards a pooled position would earn, including off-chain programs, or whether compounding would cover the costs of running it.",
  },
  {
    title: "Exit liquidity",
    text: "A receipt token is only useful if it can be sold near its value. No market or liquidity plan for rMEZO exists.",
  },
  {
    title: "Security",
    text: "A contract that holds other people's locked voting power needs a careful design, review and testing. That work has not been done.",
  },
] as const

const ROADMAP = [
  { title: "Validate protocol interfaces and governance permissions", status: "In research" },
  { title: "Verify reward accounting and the vault's security design", status: "Not started" },
  { title: "Evaluate receipt-token mechanics and liquidity requirements", status: "Not started" },
  { title: "Consider testnet experiments, only once the steps above are resolved", status: "Not started" },
] as const

const COMPARISON = [
  { capability: "Live boost analytics on Mainnet and Testnet", today: "Available", vault: "Unchanged" },
  { capability: "Vote recommendations for one veMEZO NFT", today: "Available", vault: "Unchanged" },
  { capability: "Owner-signed voting", today: "Testnet beta", vault: "Unchanged" },
  { capability: "Pooled, managed voting", today: "Not available", vault: "Proposed" },
  { capability: "Reward compounding", today: "Not available", vault: "Proposed" },
  { capability: "rMEZO receipt token", today: "Not available", vault: "Proposed" },
  { capability: "Deposits or withdrawals", today: "Not available", vault: "Not built" },
] as const

export default function VaultPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <SiteHeader />
      <main id="main" className="flex-1">
        <section aria-labelledby="vault-title" className="border-b border-line">
          <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:pb-20 lg:pt-20">
            <nav aria-label="Breadcrumb">
              <ol className="flex items-center gap-1.5 text-xs text-fg-3">
                <li>
                  <Link href="/" className="hover:text-fg">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-fg-2">
                  Vault Relay
                </li>
              </ol>
            </nav>
            <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end">
              <div>
                <span className={chip("warn")}>Research in progress</span>
                <h1 id="vault-title" className="mt-5 text-[clamp(2.6rem,6vw,4.4rem)] font-medium leading-[1] tracking-[-0.04em] text-balance text-fg">
                  Vault Relay
                </h1>
                <p className="mt-4 text-[clamp(1.25rem,2.2vw,1.6rem)] font-medium leading-snug tracking-[-0.01em] text-fg-2">A more liquid future for veMEZO.</p>
                <p className="mt-5 max-w-[40rem] text-base leading-relaxed text-fg-2">
                  Vault Relay explores how locked veMEZO could be voted well every epoch, compound its rewards and stay liquid. It is a research direction for
                  Boost Relay, written down so the idea and its open problems are clear.
                </p>
              </div>
              <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-line-strong p-5 sm:p-6">
                <p className="text-base font-medium text-fg">Vault Relay is not live.</p>
                <ul className="mt-3 grid gap-2 text-sm text-fg-2">
                  {["No vault or rMEZO contract exists or is deployed.", "It accepts no deposits and holds no funds.", "There is no launch date."].map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-fg" />
                      {t}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-fg-2">The Boost Market and the Vote Optimizer work today.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/optimizer" className={ui.btnPrimary}>
                    Open Vote Optimizer
                  </Link>
                  <Link href="/market" className={ui.btnSecondary}>
                    Explore Boost Market
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="why-title">
          <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16 lg:py-20">
            <h2 id="why-title" className={H2}>
              Why a vault at all
            </h2>
            <div className="grid gap-4 text-base leading-relaxed text-fg-2">
              <p>
                veMEZO voting power comes from MEZO locked for up to four years. While it is locked it cannot be sold, and voting it well means returning
                every epoch, reading a market that shifts block by block, and claiming rewards by hand.
              </p>
              <p>
                A shared, managed position could take on that work and keep rewards compounding, and a receipt token could give holders a way out before
                their lock ends. Each of those benefits depends on protocol permissions and market conditions that are not yet established.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="design-title" className="bg-warm">
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-20">
            <div className="max-w-2xl">
              <h2 id="design-title" className={H2}>
                The proposed design
              </h2>
              <p className="mt-3 text-base leading-relaxed text-fg-2">Four parts, all proposals. None of them is implemented.</p>
            </div>
            <dl className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-lg)] border border-line bg-line sm:grid-cols-2">
              {DESIGN.map((d) => (
                <div key={d.title} className="bg-surface p-6">
                  <dt className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-lg font-medium tracking-tight text-fg">{d.title}</span>
                    <span className={chip("neutral")}>Proposed</span>
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-fg-2">{d.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="deps-title">
          <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16 lg:py-20">
            <div>
              <h2 id="deps-title" className={H2}>
                What has to be true first
              </h2>
              <p className="mt-3 text-base leading-relaxed text-fg-2">
                Boost Relay&apos;s feasibility review deferred the pooled vault and the rMEZO token until these are resolved.
              </p>
            </div>
            <dl className="grid gap-6">
              {DEPENDENCIES.map((d) => (
                <div key={d.title} className="border-t border-line pt-5">
                  <dt className="flex flex-wrap items-center gap-2 text-base font-medium text-fg">
                    {d.title}
                    <span className={chip("warn")}>Unresolved</span>
                  </dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-fg-2">{d.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section aria-labelledby="compare-title" className="border-t border-line">
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-20">
            <h2 id="compare-title" className={H2}>
              Available today and planned
            </h2>
            <div className="mt-8 overflow-hidden rounded-[var(--radius-lg)] border border-line">
              <table className="w-full text-sm">
                <caption className="sr-only">What Boost Relay offers today compared with what Vault Relay proposes</caption>
                <thead className="bg-subtle text-left text-xs text-fg-3">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium sm:px-5">Capability</th>
                    <th scope="col" className="px-4 py-3 font-medium sm:px-5">Boost Relay today</th>
                    <th scope="col" className="px-4 py-3 font-medium sm:px-5">With Vault Relay</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((c) => (
                    <tr key={c.capability} className="border-t border-line align-top">
                      <th scope="row" className="px-4 py-3.5 text-left font-normal text-fg sm:px-5">
                        {c.capability}
                      </th>
                      <td className="px-4 py-3.5 sm:px-5">
                        <span className={chip(c.today === "Available" ? "success" : c.today === "Testnet beta" ? "info" : "neutral")}>{c.today}</span>
                      </td>
                      <td className="px-4 py-3.5 text-fg-2 sm:px-5">{c.vault}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section aria-labelledby="roadmap-title" className="bg-warm">
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-20">
            <div className="max-w-2xl">
              <h2 id="roadmap-title" className={H2}>
                Research roadmap
              </h2>
              <p className="mt-3 text-base leading-relaxed text-fg-2">An order of work, not a schedule. None of these steps is complete, and there are no dates.</p>
            </div>
            <ol className="mt-10 grid gap-4 lg:grid-cols-4">
              {ROADMAP.map((r, i) => (
                <li key={r.title} className="rounded-[var(--radius-lg)] border border-line bg-surface p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="num flex size-8 items-center justify-center rounded-full border border-line-strong text-sm font-medium text-fg">{i + 1}</span>
                    <span className={chip(r.status === "In research" ? "info" : "neutral")}>{r.status}</span>
                  </div>
                  <p className="mt-4 text-base font-medium leading-snug text-fg">{r.title}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="vault-next-title">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between lg:py-20">
            <div className="max-w-xl">
              <h2 id="vault-next-title" className={H2}>
                Use what works today
              </h2>
              <p className="mt-3 text-base leading-relaxed text-fg-2">
                See where boosts stand on the live market, or build a vote allocation for your own veMEZO NFT.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/market" className={`${ui.btnPrimary} px-6 py-3 text-base`}>
                Explore Boost Market
              </Link>
              <Link href="/optimizer" className={`${ui.btnSecondary} px-6 py-3 text-base`}>
                Open Vote Optimizer
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

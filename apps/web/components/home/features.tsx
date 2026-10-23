import Link from "next/link"
import { STRATEGIES } from "@boost-relay/optimizer"
import { chip, ui } from "@/lib/ui"

function Bullets({ items }: { readonly items: readonly string[] }) {
  return (
    <ul className="mt-5 grid gap-2.5 text-sm text-fg-2">
      {items.map((i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-fg" />
          {i}
        </li>
      ))}
    </ul>
  )
}

export function Features() {
  return (
    <section aria-labelledby="features-title" className="border-t border-line">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-24">
        <div className="max-w-2xl">
          <h2 id="features-title" className="text-[clamp(1.75rem,3.2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.025em] text-balance text-fg">
            Two tools you can use today. One in research.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-fg-2">
            The Boost Market and the Vote Optimizer work now, on Mezo Mainnet and Testnet. Vault Relay is a planned extension and is not live.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
          <article aria-labelledby="feature-market" className="flex flex-col rounded-[var(--radius-lg)] border border-line bg-surface p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-fg-2">Boost Market</p>
              <span className={chip("success")}>Live on Mainnet and Testnet</span>
            </div>
            <h3 id="feature-market" className="mt-4 text-2xl font-medium tracking-[-0.02em] text-balance text-fg">
              See the boost landscape.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-2">Every veBTC boost position on Mezo, read at one block and checked against the contract&apos;s own math.</p>
            <Bullets
              items={[
                "Boost positions and their gauges",
                "Live calculated boost next to the boost applied on veBTC",
                "veMEZO votes on each gauge",
                "The exact extra votes each position needs for 5x",
                "Incentives posted for the current epoch",
                "The source block and how fresh the data is",
              ]}
            />
            <div className="mt-auto pt-8">
              <Link href="/market" className={ui.btnPrimary}>
                Explore Boost Market
              </Link>
            </div>
          </article>

          <article aria-labelledby="feature-optimizer" className="flex flex-col rounded-[var(--radius-lg)] border border-line bg-surface p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-fg-2">Vote Optimizer</p>
              <span className={chip("info")}>Testnet voting beta</span>
            </div>
            <h3 id="feature-optimizer" className="mt-4 text-2xl font-medium tracking-[-0.02em] text-balance text-fg">
              Turn data into a better allocation.
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-2">
              Enter a veMEZO token id and choose what to optimize. The plan accounts for the NFT&apos;s current voting power, the votes it already has, the
              contract&apos;s per-vote gauge limit and how BoostVoter.vote() actually splits weight.
            </p>
            <dl className="mt-5 grid gap-3">
              {Object.values(STRATEGIES).map((s) => (
                <div key={s.label} className="rounded-[var(--radius-md)] bg-subtle px-4 py-3">
                  <dt className="text-sm font-medium text-fg">{s.label}</dt>
                  <dd className="mt-0.5 text-sm text-fg-2">{s.objective}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-sm leading-relaxed text-fg-2">
              Before anything is sent, the recommendation is recalculated from fresh chain data and simulated as your account. On Mezo Testnet, the NFT&apos;s
              owner reviews and signs the vote in their own wallet.
            </p>
            <div className="mt-auto pt-8">
              <Link href="/optimizer" className={ui.btnPrimary}>
                Open Vote Optimizer
              </Link>
            </div>
          </article>

          <article aria-labelledby="feature-vault" className="rounded-[var(--radius-lg)] border-2 border-dashed border-line-strong p-6 sm:p-8 lg:col-span-2">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-fg-2">Vault Relay</p>
                  <span className={chip("warn")}>In research, not live</span>
                </div>
                <h3 id="feature-vault" className="mt-4 text-2xl font-medium tracking-[-0.02em] text-balance text-fg">
                  A more liquid future for veMEZO.
                </h3>
                <p className="mt-2 max-w-[40rem] text-sm leading-relaxed text-fg-2">
                  A long-term idea: a managed voting strategy that compounds rewards, with a possible liquid token representing locked voting power. It is not
                  built or deployed, accepts no deposits and has no launch date.
                </p>
                <div className="mt-6">
                  <Link href="/vault" className={ui.btnSecondary}>
                    Explore Vault Relay
                  </Link>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-fg">Why it is on hold</p>
                <ul className="mt-3 grid gap-2.5 text-sm text-fg-2">
                  {[
                    "Managed-lock permissions are unresolved",
                    "Reward eligibility and vault economics need validation",
                    "Exit liquidity is not established",
                    "The security design needs more work",
                  ].map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full border border-fg-3" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

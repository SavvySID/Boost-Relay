import type { ReactNode } from "react"
import { amount, integer, percent, short, utcDateTime } from "@/lib/market-formatting"
import type { OptimizerDto } from "@/lib/optimizer-dto"
import { chip, ui } from "@/lib/ui"

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className={ui.label}>{label}</dt>
      <dd className="num mt-1 text-sm font-medium text-fg">{children}</dd>
    </div>
  )
}

/** Read-only facts about the selected veMEZO NFT, read at the recommendation's source block. */
export function TokenCard({ data }: { readonly data: OptimizerDto }) {
  const t = data.token
  const lastVoted = BigInt(t.lastVoted)
  const votedThisEpoch = lastVoted >= BigInt(data.epoch.epochStart)
  const eligibility = t.canVoteThisEpoch
    ? { tone: "success" as const, text: "Can vote this epoch" }
    : votedThisEpoch
      ? { tone: "warn" as const, text: "Already voted this epoch" }
      : { tone: "warn" as const, text: data.epoch.phase === "distribution" ? "Voting not open yet" : "Voting window closed" }

  return (
    <section aria-labelledby="token-title" className={`${ui.card} ${ui.cardBody}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="token-title" className="text-lg font-medium tracking-tight text-fg">
          veMEZO #{t.tokenId}
        </h3>
        <div className="flex flex-wrap gap-2">
          <span className={chip(eligibility.tone)}>{eligibility.text}</span>
          <span className={chip(t.allocation.complete ? "neutral" : "danger")}>
            {t.allocation.complete ? (t.allocation.entries.length === 0 ? "No boost votes yet" : `${t.allocation.entries.length} existing boost votes`) : "Existing votes unreadable"}
          </span>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <Field label="Owner">
          <a href={`${data.explorerUrl}/address/${t.owner}`} target="_blank" rel="noreferrer" className={ui.link} title={t.owner}>
            {short(t.owner)}
          </a>
        </Field>
        <Field label="Voting power">
          {amount(t.votingPower, 18, 4)} veMEZO
          <span className="block text-xs font-normal text-fg-3">{percent({ numerator: t.votingPower, denominator: data.totalVeMezoVotingPower }, 4)} of all veMEZO</span>
        </Field>
        <Field label="Locked">
          {amount(t.lockAmount, 18, 2)} MEZO {t.isPermanent ? "(permanent)" : `until ${utcDateTime(t.lockEnd).replace(", 00:00 UTC", "")}`}
        </Field>
        <Field label="Last boost vote">{lastVoted === 0n ? "Never" : utcDateTime(t.lastVoted)}</Field>
      </dl>
      {t.allocation.entries.length > 0 ? (
        <div className="mt-4 rounded-[var(--radius-md)] bg-subtle px-4 py-3 text-sm">
          <p className="text-fg-2">
            Existing votes ({amount(t.allocation.usedWeight, 18, 4)} veMEZO in total). A new vote first removes all of these:
          </p>
          <ul className="num mt-2 grid gap-1 text-xs text-fg-2 sm:grid-cols-2">
            {t.allocation.entries.map((e) => (
              <li key={e.gauge}>
                {e.tokenId !== null ? `veBTC #${e.tokenId}` : short(e.gauge)}: {amount(e.votes, 18, 4)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {!t.allocation.complete ? (
        <p className="mt-3 rounded-[var(--radius-md)] bg-danger-bg px-4 py-3 text-sm text-danger-fg">{t.allocation.issues.join(" ")}</p>
      ) : null}
      <p className="mt-3 text-xs text-fg-3">
        Read at block {integer(data.sourceBlock)}, the same block as the market data below.
        {t.votedAnywhere && t.allocation.entries.length === 0 ? " This NFT also has votes in Mezo's third-party gauge voter; those are separate from boost votes." : ""}
      </p>
    </section>
  )
}

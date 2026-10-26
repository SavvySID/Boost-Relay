import type { OptimizerDto } from "@/lib/optimizer-dto"
import { utcDateTime } from "@/lib/market-formatting"
import { VOTE_END_MARGIN_SECONDS } from "@/lib/vote-rules"

/** "2 days 3 h", "5 h 10 min" or "12 min" until a unix time. */
export function timeUntil(unixSeconds: string, nowMs: number): string {
  const s = Math.max(0, Number(unixSeconds) - Math.floor(nowMs / 1000))
  const d = Math.floor(s / 86_400)
  const h = Math.floor((s % 86_400) / 3_600)
  const m = Math.floor((s % 3_600) / 60)
  if (d > 0) return `${d} ${d === 1 ? "day" : "days"} ${h} h`
  if (h > 0) return `${h} h ${m} min`
  return `${m} min`
}

/**
 * When to run the optimizer, from the protocol's own schedule (the epoch read with the snapshot).
 * BoostVoter accepts votes from one hour after an epoch starts until one hour before it ends.
 */
export function VoteTiming({ epoch, nowMs }: { readonly epoch: OptimizerDto["epoch"]; readonly nowMs: number }) {
  const now = Math.floor(nowMs / 1000)
  const voteStart = Number(epoch.voteStart)
  const voteEnd = Number(epoch.voteEnd)
  const nextStart = Number(epoch.epochNext) + 3_600

  let title: string
  let body: string
  if (now < voteStart) {
    title = `Voting opens ${utcDateTime(epoch.voteStart)}`
    body = `That is in ${timeUntil(epoch.voteStart, nowMs)}, one hour after the epoch starts.`
  } else if (now < voteEnd) {
    title = `Voting for this epoch closes ${utcDateTime(epoch.voteEnd)}, in ${timeUntil(epoch.voteEnd, nowMs)}`
    body = `Incentives and other voters keep changing until then, so a plan prepared in the last few hours reflects the most complete picture. Boost Relay stops preparing votes ${VOTE_END_MARGIN_SECONDS / 60} minutes before the close.`
  } else {
    title = "Voting for this epoch has closed"
    body = `The next window opens ${utcDateTime(String(nextStart))}. Recommendations stay available for analysis.`
  }
  return (
    <div className="flex gap-3 rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3 text-sm">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-2">
        <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 6v4.25l2.75 1.75" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="leading-relaxed text-fg-2">
        <span className="font-medium text-fg">{title}.</span> {body}
      </p>
    </div>
  )
}

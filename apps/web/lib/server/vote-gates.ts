import type { MarketSnapshot, NetworkName } from "@boost-relay/mezo"
import type { OptimizerToken, Recommendation } from "@boost-relay/optimizer"
import type { VoteGate } from "../vote-dto"

/** A prepared vote must come from a snapshot whose block is at most this old. */
export const MAX_SNAPSHOT_AGE_SECONDS = 180
/** Refuse to prepare inside the last minutes of the vote window, so signing does not race its close. */
export const VOTE_END_MARGIN_SECONDS = 300

export interface GateInput {
  readonly network: NetworkName
  /** Connected account, lower- or mixed-case hex. */
  readonly account: string
  readonly snapshot: MarketSnapshot
  readonly token: OptimizerToken
  readonly recommendation: Recommendation
  /** Server clock, unix seconds. */
  readonly nowSeconds: bigint
}

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/**
 * Every condition that must hold before a vote may be signed. Mirrors BoostVoter.vote()'s own
 * checks (owner or approved, onlyNewEpoch, vote window, gauge count, duplicates, alive gauges,
 * non-zero shares) and adds the data-quality checks the recommendation depends on.
 */
export function assessVote(input: GateInput): VoteGate[] {
  const { snapshot, token, recommendation: rec } = input
  const epoch = snapshot.global.epoch
  const age = input.nowSeconds - snapshot.meta.blockTimestamp
  const exists = !/^0x0{40}$/i.test(token.owner)
  const weights = rec.voteCall?.weights ?? []
  const weightSum = weights.reduce((s, w) => s + w, 0n)
  const failedChecks = rec.checks.filter((c) => !c.ok)
  const timeLeft = epoch.voteEnd - input.nowSeconds

  return [
    {
      id: "network-testnet",
      label: "Testnet only",
      ok: input.network === "testnet",
      detail: input.network === "testnet" ? "Mezo Testnet (chain 31611)." : "Voting is disabled on mainnet during the testnet beta.",
    },
    { id: "token-exists", label: "NFT exists", ok: exists, detail: exists ? `veMEZO #${token.tokenId} exists.` : `veMEZO #${token.tokenId} does not exist.` },
    {
      id: "owner-matches",
      label: "Connected account owns the NFT",
      ok: exists && same(token.owner, input.account),
      detail: exists && same(token.owner, input.account) ? "Owner matches the connected account." : `veMEZO #${token.tokenId} is owned by ${token.owner}, not the connected account.`,
    },
    { id: "power-positive", label: "Voting power above zero", ok: token.votingPower > 0n, detail: token.votingPower > 0n ? "Voting power is known and positive." : "This NFT has no voting power." },
    {
      id: "not-voted-this-epoch",
      label: "Not voted this epoch",
      ok: token.lastVoted < epoch.epochStart,
      detail: token.lastVoted < epoch.epochStart ? "No BoostVoter vote yet this epoch." : "This NFT already voted this epoch; BoostVoter allows one vote per epoch.",
    },
    {
      id: "in-vote-window",
      label: "Inside the voting window",
      ok: epoch.phase === "voting" && timeLeft > BigInt(VOTE_END_MARGIN_SECONDS),
      detail:
        epoch.phase !== "voting"
          ? epoch.phase === "distribution"
            ? "Voting opens one hour after the epoch starts."
            : "The voting window for this epoch has closed."
          : timeLeft > BigInt(VOTE_END_MARGIN_SECONDS)
            ? `Window closes in ${Math.floor(Number(timeLeft) / 60)} minutes.`
            : "The window closes within five minutes; wait for the next epoch.",
    },
    {
      id: "snapshot-complete",
      label: "Market snapshot complete",
      ok: snapshot.meta.completeness === "complete",
      detail: snapshot.meta.completeness === "complete" ? "Every veBTC position was read." : `${snapshot.meta.failures.length} reads failed.`,
    },
    {
      id: "snapshot-fresh",
      label: "Market data is recent",
      ok: age >= 0n && age <= BigInt(MAX_SNAPSHOT_AGE_SECONDS),
      detail: `Block ${snapshot.meta.blockNumber} is ${age} seconds old (limit ${MAX_SNAPSHOT_AGE_SECONDS}).`,
    },
    {
      id: "allocation-known",
      label: "Existing votes accounted for",
      ok: token.allocation.complete,
      detail: token.allocation.complete
        ? token.allocation.entries.length === 0
          ? "This NFT has no existing boost votes to replace."
          : `${token.allocation.entries.length} existing votes are replaced by this vote.`
        : `Existing votes could not be fully read: ${token.allocation.issues.join("; ")}`,
    },
    {
      id: "recommendation-actionable",
      label: "Recommendation is actionable",
      ok: rec.status === "actionable",
      detail: rec.status === "actionable" ? "All optimizer preconditions hold." : rec.blockers.map((b) => b.text).join(" ") || rec.warnings.map((w) => w.text).join(" "),
    },
    {
      id: "allocation-checks",
      label: "Gauges and weights valid",
      ok: rec.checks.length > 0 && failedChecks.length === 0,
      detail: failedChecks.length === 0 ? `${rec.checks.length} checks passed: alive, unique, within maxVotingNum, positive shares.` : failedChecks.map((c) => c.name).join("; "),
    },
    {
      id: "weights-sum-to-power",
      label: "Weights sum to the NFT's power",
      ok: weights.length > 0 && weightSum === token.votingPower,
      detail: weightSum === token.votingPower ? "Each gauge receives exactly its weight at the source block." : `Weights sum to ${weightSum}, power is ${token.votingPower}.`,
    },
  ]
}

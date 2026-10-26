import type { OptimizerDto } from "./optimizer-dto"
import type { PreparedVote } from "./vote-dto"

export type PostVoteCheck =
  | { readonly status: "verified"; readonly block: string; readonly gauges: number; readonly totalVotes: bigint }
  | { readonly status: "not-visible-yet"; readonly reason: string }
  | { readonly status: "different"; readonly reason: string }

/**
 * After a confirmed receipt and a fresh re-read: does BoostVoter now record this NFT's vote for this
 * epoch on exactly the gauges that were signed? Never infers success from the receipt alone.
 */
export function checkRecordedVote(prepared: PreparedVote, data: OptimizerDto): PostVoteCheck {
  if (data.network !== prepared.network || data.token.tokenId !== prepared.tokenId) return { status: "not-visible-yet", reason: "The page shows a different NFT or network." }
  if (BigInt(data.token.lastVoted) < BigInt(prepared.epochStart)) return { status: "not-visible-yet", reason: "The chain read after the vote does not show it yet; RPC nodes can lag by a few seconds." }
  if (!data.token.allocation.complete) return { status: "not-visible-yet", reason: "The NFT's new allocation could not be fully read." }
  const recorded = new Set(data.token.allocation.entries.map((e) => e.gauge.toLowerCase()))
  const expected = new Set(prepared.gauges.map((g) => g.toLowerCase()))
  const same = recorded.size === expected.size && [...expected].every((g) => recorded.has(g))
  if (!same) return { status: "different", reason: "BoostVoter records a vote for this epoch, but on different gauges than the ones you signed." }
  const totalVotes = data.token.allocation.entries.reduce((s, e) => s + BigInt(e.votes), 0n)
  return { status: "verified", block: data.sourceBlock, gauges: recorded.size, totalVotes }
}

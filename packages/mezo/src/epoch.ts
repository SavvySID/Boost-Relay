/**
 * Epoch timing, mirrored from contracts/libraries/ProtocolTimeLibrary.sol (BoostVoter source):
 *   epochStart(t)     = t - (t % WEEK)
 *   epochNext(t)      = t - (t % WEEK) + WEEK
 *   epochVoteStart(t) = t - (t % WEEK) + 1 hours
 *   epochVoteEnd(t)   = t - (t % WEEK) + WEEK - 1 hours
 * All values are unix seconds as bigint (block.timestamp units).
 */

export const WEEK = 604_800n
export const HOUR = 3_600n

function assertTimestamp(t: bigint): void {
  if (t < 0n) throw new RangeError(`timestamp must be non-negative, got ${t}`)
}

export function epochStart(t: bigint): bigint {
  assertTimestamp(t)
  return t - (t % WEEK)
}

export function epochNext(t: bigint): bigint {
  return epochStart(t) + WEEK
}

export function epochVoteStart(t: bigint): bigint {
  return epochStart(t) + HOUR
}

export function epochVoteEnd(t: bigint): bigint {
  return epochStart(t) + WEEK - HOUR
}

/**
 * - "distribution": t <= voteStart. vote/reset/poke revert with DistributeWindow.
 * - "voting": voteStart < t <= voteEnd. Normal voting.
 * - "whitelist-only": t > voteEnd. vote() reverts NotWhitelistedNFT unless isWhitelistedNFT.
 */
export type EpochPhase = "distribution" | "voting" | "whitelist-only"

export interface EpochInfo {
  readonly timestamp: bigint
  readonly epochStart: bigint
  readonly epochNext: bigint
  readonly voteStart: bigint
  readonly voteEnd: bigint
  readonly phase: EpochPhase
  /** Seconds until voteEnd; 0 once the normal voting window has closed. */
  readonly secondsUntilVoteEnd: bigint
}

export function getEpochInfo(t: bigint): EpochInfo {
  const start = epochStart(t)
  const voteStart = start + HOUR
  const voteEnd = start + WEEK - HOUR
  // NonStakingVoter.onlyNewEpoch: reverts if block.timestamp <= epochVoteStart.
  // NonStakingVoter.vote: reverts if timestamp > epochVoteEnd && !isWhitelistedNFT.
  const phase: EpochPhase = t <= voteStart ? "distribution" : t <= voteEnd ? "voting" : "whitelist-only"
  return {
    timestamp: t,
    epochStart: start,
    epochNext: start + WEEK,
    voteStart,
    voteEnd,
    phase,
    secondsUntilVoteEnd: t < voteEnd ? voteEnd - t : 0n,
  }
}

/**
 * Whether BoostVoter.vote(tokenId, ...) passes the epoch checks at time t for a non-whitelisted NFT:
 * `epochStart(t) > lastVoted[tokenId]` (onlyNewEpoch), `t > voteStart`, and `t <= voteEnd`.
 * Ownership, gauge validity and weights are checked elsewhere.
 */
export function canVoteAt(t: bigint, lastVoted: bigint): boolean {
  if (lastVoted < 0n) throw new RangeError(`lastVoted must be non-negative, got ${lastVoted}`)
  const info = getEpochInfo(t)
  return info.epochStart > lastVoted && info.phase === "voting"
}

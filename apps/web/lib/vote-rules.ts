/**
 * Timing and size rules shared by the server gates and the browser flow, so both sides fail closed
 * at the same moments.
 */

/** A prepared vote must come from a snapshot whose block is at most this old. */
export const MAX_SNAPSHOT_AGE_SECONDS = 180
/** No vote is prepared, simulated or sent inside the last minutes of the vote window. */
export const VOTE_END_MARGIN_SECONDS = 300
/** A prepared vote must be signed within this window or prepared again. */
export const PREPARED_TTL_MS = 120_000
/** Sanity bound on gauges in one call, checked before any RPC. The contract's maxVotingNum is the real limit. */
export const MAX_GAUGES_PER_CALL = 64

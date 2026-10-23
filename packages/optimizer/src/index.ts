// @boost-relay/optimizer: deterministic veMEZO vote allocation that mirrors BoostVoter.vote().
// Pure computation. It reads nothing from the chain and never signs or sends a transaction.

export { boostAt, boostedPower, buildCandidates, priorVotesByGauge, projectVote, splitVotes, type CandidateSet, type Projection } from "./allocate.js"
export { DEFAULT_MIN_ALLOCATION, STRATEGIES, planMaxBoostedPower, planMaxCappedPositions, recommend, recommendAll } from "./strategies.js"
export { checkAllocation, checkPreconditions, type Preconditions } from "./validate.js"
export type {
  Address,
  AllocationLine,
  Candidate,
  CheckResult,
  Issue,
  OptimizerContext,
  OptimizerInput,
  OptimizerToken,
  ProposedVoteCall,
  Reason,
  ReasonCode,
  Recommendation,
  RecommendationStatus,
  RecommendationSummary,
  RemovedVoteLine,
  StrategyId,
} from "./types.js"

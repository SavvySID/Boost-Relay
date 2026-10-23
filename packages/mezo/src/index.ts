// @boost-relay/mezo: read-only Mezo data layer and boost math for Boost Relay.
// Nothing in this package signs, sends or requires a private key.

export {
  CHAINS,
  EXPLORER_API,
  NETWORKS,
  RPC_ENV_VAR,
  assertNetworkName,
  isNetworkName,
  mezoMainnet,
  mezoTestnet,
  resolveRpcUrl,
  type NetworkName,
} from "./config/chains.js"
export {
  DEPLOYMENTS,
  EIP1967_IMPLEMENTATION_SLOT,
  getDeployment,
  type MezoContracts,
  type MezoDeployment,
  type MezoTokens,
} from "./config/addresses.js"
export { boostVoterAbi, bribeVotingRewardAbi, factoryRegistryAbi, votingEscrowAbi } from "./abis/index.js"

export {
  BOOST_TARGETS,
  BoostMathOverflowError,
  MAX_BOOST,
  MIN_BOOST,
  PRECISION,
  analyzeBoost,
  boostableVeRatio,
  classifyPosition,
  computeBoost,
  normalizeStoredBoost,
  requiredWeightForBoost,
  summarizeMarket,
  votingVeRatio,
  type BoostAnalysis,
  type BoostContext,
  type BoostInputs,
  type BoostTargetLabel,
  type MarketSummary,
  type PositionStatus,
  type Ratio,
  type TargetStatus,
  type UnreachableReason,
  type WeightRequirement,
} from "./boost.js"
export { HOUR, WEEK, canVoteAt, epochNext, epochStart, epochVoteEnd, epochVoteStart, getEpochInfo, type EpochInfo, type EpochPhase } from "./epoch.js"

export {
  ALLOCATION_PROBE_MARGIN,
  ChainMismatchError,
  GlobalStateReadError,
  NotFoundError,
  createMezoReader,
  viemChainAccess,
  type ChainAccess,
  type GaugeMappingScan,
  type IncentivesRead,
  type MappingEntry,
  type MezoReader,
  type MezoReaderOptions,
  type PositionsRead,
  type SnapshotOptions,
  type SnapshotResult,
} from "./reader.js"
export {
  createMulticallExecutor,
  viemAggregate3Transport,
  type Aggregate3Call,
  type Aggregate3Result,
  type Aggregate3Transport,
  type CallExecutor,
  type CallFailureKind,
  type CallResult,
  type ContractCall,
  type ExecuteOptions,
  type MulticallExecutorOptions,
} from "./executor.js"
export {
  decideCacheReuse,
  deserializeGaugeMappingCache,
  serializeGaugeMappingCache,
  type CacheDecision,
  type GaugeMappingCache,
} from "./cache.js"
export { verifyDeployment, type CheckStatus, type DeploymentVerification, type VerificationCheck } from "./verification.js"
export { formatBoost, formatFixed, formatRatioPercent, formatTokenAmount, ratioToPpm, shortAddress } from "./formatting.js"
export type {
  BlockRef,
  BoostPosition,
  GaugeIncentives,
  GlobalState,
  IncentiveTokenAmount,
  LockInfo,
  MarketSnapshot,
  ReadFailure,
  SnapshotMeta,
  VeMezoPosition,
  VeMezoVoteAllocation,
} from "./types.js"

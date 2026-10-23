import { PRECISION, analyzeBoost, classifyPosition, getEpochInfo, summarizeMarket, type BoostPosition, type MarketSnapshot } from "@boost-relay/mezo"
import type { Address, OptimizerInput, OptimizerToken } from "../src/index.js"

/**
 * Hand-checkable market: Tm = 1000, Tb = 100 (tokens). For a position with unboosted power p:
 *   boostableVeRatio = Tb / p, so the exact 5x requirement is 10 x p tokens of gauge weight,
 *   and boosted power p x boost = p + 0.4 x W below the cap (slope 4 x Tb / Tm = 0.4 for everyone).
 */
export const P = PRECISION
export const t = (n: number | bigint): bigint => BigInt(n) * P
export const T = 1_792_705_788n // inside the voting window of the epoch starting 1_792_627_200
export const EPOCH_START = 1_792_627_200n
export const gauge = (n: number): Address => `0x${(0x1000 + n).toString(16).padStart(40, "0")}`

export interface PositionSpec {
  readonly id: number
  readonly power: number // tokens
  readonly weight: number // tokens (current gauge weight, including any prior votes of the NFT)
  readonly alive?: boolean
  readonly expired?: boolean
  readonly gaugeOverride?: Address
}

export function position(s: PositionSpec, Tm = t(1000), Tb = t(100)): BoostPosition {
  const alive = s.alive ?? true
  const lock = { amount: t(1), end: s.expired ? T - 1n : T + 30n * 86_400n, isPermanent: false, storedBoostRaw: 0n }
  const power = s.expired ? 0n : t(s.power)
  return {
    tokenId: BigInt(s.id),
    gauge: s.gaugeOverride ?? gauge(s.id),
    bribe: null,
    owner: `0x${"ab".repeat(20)}`,
    gaugeAlive: alive,
    lock,
    unboostedVotingPower: power,
    gaugeWeight: t(s.weight),
    status: classifyPosition({ gaugeAlive: alive, lockAmount: lock.amount, lockEnd: lock.end, isPermanent: false, unboostedVotingPower: power, timestamp: T }),
    analysis: analyzeBoost({ gaugeWeight: t(s.weight), totalVeMezoVotingPower: Tm, totalUnboostedVeBtcVotingPower: Tb, positionUnboostedVotingPower: power }, 0n),
    onchainBoost: null,
  }
}

export function snapshot(specs: readonly PositionSpec[], options: { maxVotingNum?: bigint; partial?: boolean; timestamp?: bigint } = {}): MarketSnapshot {
  const positions = specs.map((s) => position(s))
  const ts = options.timestamp ?? T
  return {
    meta: {
      network: "testnet",
      chainId: 31611,
      blockNumber: 500n,
      blockTimestamp: ts,
      fetchedAt: "2026-10-23T00:00:00.000Z",
      ageSeconds: 0,
      completeness: options.partial ? "partial" : "complete",
      mappingSource: "scan",
      failures: options.partial ? [{ key: "mapping:9", kind: "rpc", message: "timeout" }] : [],
    },
    global: {
      totalVeMezoVotingPower: t(1000),
      totalUnboostedVeBtcVotingPower: t(100),
      boostVoterTotalWeight: positions.reduce((s, p) => s + p.gaugeWeight, 0n),
      maxVotingNum: options.maxVotingNum ?? 30n,
      gaugeCount: BigInt(positions.length),
      veBtcMaxTokenId: BigInt(specs.length),
      veMezoMaxTokenId: 1000n,
      epoch: getEpochInfo(ts),
    },
    positions,
    summary: summarizeMarket(positions),
    incentives: { included: false, completeness: "complete", byGauge: [], failures: [] },
  }
}

export function token(power: number | bigint, options: Partial<OptimizerToken> & { prior?: readonly [number, number][] } = {}): OptimizerToken {
  const entries = (options.prior ?? []).map(([g, v]) => ({ gauge: gauge(g), votes: t(v) }))
  return {
    tokenId: 924n,
    owner: "0x00000000000000000000000000000000000a11CE",
    votingPower: typeof power === "bigint" ? power : t(power),
    lastVoted: 0n,
    votedAnywhere: entries.length > 0,
    lockEnd: 1_918_425_600n,
    isPermanent: false,
    allocation: { usedWeight: entries.reduce((s, e) => s + e.votes, 0n), entries, complete: true, issues: [] },
    blockNumber: 500n,
    ...options,
  }
}

export function input(snap: MarketSnapshot, tok: OptimizerToken, strategy: OptimizerInput["strategy"] = "max-boosted-power"): OptimizerInput {
  return { snapshot: snap, token: tok, strategy, context: { network: "testnet", chainId: 31611, boostVoter: "0x21d7bDF5a5929AD179F8cA0c9014A0B62ae6Bfd1" } }
}

/**
 * Base market used across tests (requirements are 10 x power):
 *   #1 power 10, weight 20 -> needs 100, headroom 80
 *   #2 power 5,  weight 10 -> needs 50,  headroom 40
 *   #3 power 2,  weight 0  -> needs 20,  headroom 20
 *   #4 power 1,  weight 10 -> needs 10,  already at 5x
 *   #5 expired (no power)
 *   #6 gauge killed
 */
export const BASE: readonly PositionSpec[] = [
  { id: 1, power: 10, weight: 20 },
  { id: 2, power: 5, weight: 10 },
  { id: 3, power: 2, weight: 0 },
  { id: 4, power: 1, weight: 10 },
  { id: 5, power: 3, weight: 4, expired: true },
  { id: 6, power: 3, weight: 0, alive: false },
]

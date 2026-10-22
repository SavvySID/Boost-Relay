import { getAddress, type Address } from "viem"
import type { NetworkName } from "./config/chains.js"

/**
 * veBTC tokenId -> boost gauge mapping, produced by scanning BoostVoter.boostableTokenIdToGauge.
 *
 * Why reuse is safe: in the verified BoostVoter source the mapping is only ever *added to* in
 * _createBoostGauge (BoostVoter.sol:142), which always creates a new gauge and pushes it onto
 * `gauges` (NonStakingVoter.sol:442). So if BoostVoter.length() is unchanged since the scan, no
 * mapping was added, including for veBTC ids minted after the scan. Entries are only ever
 * *removed* in notifyBoostableBurned (BoostVoter.sol:247), and the reader re-reads every cached
 * entry at the snapshot block, so removals are caught too.
 */
export interface GaugeMappingCache {
  readonly network: NetworkName
  readonly boostVoter: Address
  /** BoostVoter.length() at scan time. */
  readonly gaugeCount: bigint
  /** veBTC.tokenId() at scan time; ids 1..n were scanned. */
  readonly scannedThroughTokenId: bigint
  readonly scannedAtBlock: bigint
  /** Unix ms. */
  readonly scannedAt: number
  readonly entries: readonly { readonly tokenId: bigint; readonly gauge: Address }[]
}

export type CacheDecision =
  | { readonly reuse: true }
  | { readonly reuse: false; readonly reason: "missing" | "other-deployment" | "gauge-count-changed" | "expired" }

export function decideCacheReuse(
  cache: GaugeMappingCache | undefined,
  current: { readonly network: NetworkName; readonly boostVoter: Address; readonly gaugeCount: bigint },
  options: { readonly maxAgeMs?: number; readonly now?: number } = {},
): CacheDecision {
  if (cache === undefined) return { reuse: false, reason: "missing" }
  if (cache.network !== current.network || getAddress(cache.boostVoter) !== getAddress(current.boostVoter)) {
    return { reuse: false, reason: "other-deployment" }
  }
  if (cache.gaugeCount !== current.gaugeCount) return { reuse: false, reason: "gauge-count-changed" }
  if (options.maxAgeMs !== undefined && (options.now ?? Date.now()) - cache.scannedAt > options.maxAgeMs) {
    return { reuse: false, reason: "expired" }
  }
  return { reuse: true }
}

interface SerializedCache {
  readonly version: 1
  readonly network: NetworkName
  readonly boostVoter: Address
  readonly gaugeCount: string
  readonly scannedThroughTokenId: string
  readonly scannedAtBlock: string
  readonly scannedAt: number
  readonly entries: readonly [string, Address][]
}

export function serializeGaugeMappingCache(cache: GaugeMappingCache): string {
  const data: SerializedCache = {
    version: 1,
    network: cache.network,
    boostVoter: cache.boostVoter,
    gaugeCount: cache.gaugeCount.toString(),
    scannedThroughTokenId: cache.scannedThroughTokenId.toString(),
    scannedAtBlock: cache.scannedAtBlock.toString(),
    scannedAt: cache.scannedAt,
    entries: cache.entries.map((e) => [e.tokenId.toString(), e.gauge]),
  }
  return JSON.stringify(data)
}

/** Throws on any malformed field rather than returning a partially valid cache. */
export function deserializeGaugeMappingCache(json: string): GaugeMappingCache {
  const data = JSON.parse(json) as Partial<SerializedCache>
  if (data.version !== 1) throw new Error("unsupported gauge mapping cache version")
  if (data.network !== "mainnet" && data.network !== "testnet") throw new Error("invalid cache network")
  if (!Array.isArray(data.entries)) throw new Error("invalid cache entries")
  const big = (v: unknown, name: string): bigint => {
    if (typeof v !== "string" || !/^\d+$/.test(v)) throw new Error(`invalid cache field ${name}`)
    return BigInt(v)
  }
  return {
    network: data.network,
    boostVoter: getAddress(String(data.boostVoter)),
    gaugeCount: big(data.gaugeCount, "gaugeCount"),
    scannedThroughTokenId: big(data.scannedThroughTokenId, "scannedThroughTokenId"),
    scannedAtBlock: big(data.scannedAtBlock, "scannedAtBlock"),
    scannedAt: typeof data.scannedAt === "number" ? data.scannedAt : Number.NaN,
    entries: data.entries.map(([id, gauge]) => ({ tokenId: big(id, "entry.tokenId"), gauge: getAddress(gauge) })),
  }
}

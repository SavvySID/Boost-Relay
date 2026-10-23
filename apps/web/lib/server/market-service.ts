import {
  ChainMismatchError,
  GlobalStateReadError,
  createMezoReader,
  type GaugeMappingCache,
  type MezoReader,
  type NetworkName,
} from "@boost-relay/mezo"
import type { MarketDto } from "../market-dto"
import { toMarketDto } from "./to-dto"

/** Re-serve a snapshot for this long when the client does not ask for a refresh. */
export const SNAPSHOT_TTL_MS = 60_000
/** Even an explicit refresh re-serves a snapshot younger than this, to protect the public RPC. */
export const MIN_REFRESH_INTERVAL_MS = 15_000

interface Entry {
  readonly dto: MarketDto
  readonly cachedAt: number
  readonly durationMs: number
}

interface ServiceState {
  readers: Map<NetworkName, MezoReader>
  snapshots: Map<NetworkName, Entry>
  inflight: Map<NetworkName, Promise<Entry>>
  mappings: Map<NetworkName, GaugeMappingCache>
}

// Kept on globalThis so dev-server hot reloads do not drop in-flight reads or caches.
const globalKey = Symbol.for("boost-relay.market-service")
const holder = globalThis as unknown as Record<symbol, ServiceState | undefined>
const state: ServiceState = (holder[globalKey] ??= {
  readers: new Map(),
  snapshots: new Map(),
  inflight: new Map(),
  mappings: new Map(),
})

function readerFor(network: NetworkName): MezoReader {
  let reader = state.readers.get(network)
  if (reader === undefined) {
    // RPC overrides come from MEZO_MAINNET_RPC_URL / MEZO_TESTNET_RPC_URL; never sent to the client.
    reader = createMezoReader({ network, env: process.env })
    state.readers.set(network, reader)
  }
  return reader
}

async function load(network: NetworkName): Promise<Entry> {
  const started = Date.now()
  const mapping = state.mappings.get(network)
  const { snapshot, cache } = await readerFor(network).readMarketSnapshot({
    ...(mapping !== undefined ? { cache: mapping } : {}),
    includeIncentives: true,
  })
  if (cache !== null) state.mappings.set(network, cache)
  else state.mappings.delete(network)
  const entry: Entry = { dto: toMarketDto(snapshot), cachedAt: Date.now(), durationMs: Date.now() - started }
  state.snapshots.set(network, entry)
  return entry
}

export interface MarketResult {
  readonly entry: Entry
  readonly source: "fresh" | "cache"
}

/**
 * One snapshot per network at a time: concurrent requests share the in-flight read, and a
 * cached snapshot (with its original block and timestamp) is re-served inside the TTL.
 */
export async function getMarket(network: NetworkName, options: { readonly refresh: boolean }): Promise<MarketResult> {
  const cached = state.snapshots.get(network)
  if (cached !== undefined) {
    const age = Date.now() - cached.cachedAt
    if (age < (options.refresh ? MIN_REFRESH_INTERVAL_MS : SNAPSHOT_TTL_MS)) return { entry: cached, source: "cache" }
  }
  let pending = state.inflight.get(network)
  if (pending === undefined) {
    pending = load(network).finally(() => state.inflight.delete(network))
    state.inflight.set(network, pending)
  }
  return { entry: await pending, source: "fresh" }
}

/** Maps reader errors to messages that are safe to show (no RPC URLs, keys or stack traces). */
export function describeError(error: unknown, network: NetworkName): { code: string; message: string } {
  if (error instanceof ChainMismatchError) {
    return { code: "wrong-chain", message: `The ${network} RPC reported chain ${error.observed}, expected ${error.expected}. No data was read.` }
  }
  if (error instanceof GlobalStateReadError) {
    return { code: "protocol-read-failed", message: `Could not read Mezo ${network} protocol totals from the RPC. Try again in a minute.` }
  }
  const text = error instanceof Error ? error.message : ""
  if (/timeout|timed out|deadline/i.test(text)) {
    return { code: "rpc-timeout", message: `The Mezo ${network} RPC timed out while reading the snapshot. Try again in a minute.` }
  }
  return { code: "snapshot-failed", message: `Could not read a Mezo ${network} snapshot from the RPC. Try again in a minute.` }
}

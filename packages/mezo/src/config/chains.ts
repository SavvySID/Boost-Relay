import { defineChain, type Chain } from "viem"

/**
 * Mezo networks. Values mirror the official viem config in github.com/mezo-org/chains
 * (src/index.ts @ d2c07dc) and were re-confirmed with eth_chainId on 2026-10-22.
 */
export type NetworkName = "mainnet" | "testnet"

export const NETWORKS: readonly NetworkName[] = ["mainnet", "testnet"] as const

const MULTICALL3 = "0xca11bde05977b3631167028862be2a173976ca11" as const

export const mezoMainnet: Chain = defineChain({
  id: 31612,
  name: "Mezo Mainnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: {
    // validationcloud is the first official endpoint and handled pinned-block batches in testing.
    // boar.network is official too but timed out on 100-call batches; imperator returned HTTP 405.
    default: { http: ["https://mainnet.mezo.public.validationcloud.io"] },
  },
  blockExplorers: {
    default: { name: "Mezo Mainnet Explorer", url: "https://explorer.mezo.org" },
  },
  contracts: { multicall3: { address: MULTICALL3 } },
})

export const mezoTestnet: Chain = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.test.mezo.org"] },
  },
  blockExplorers: {
    default: { name: "Mezo Testnet Explorer", url: "https://explorer.test.mezo.org" },
  },
  contracts: { multicall3: { address: MULTICALL3 } },
  testnet: true,
})

export const CHAINS: Record<NetworkName, Chain> = {
  mainnet: mezoMainnet,
  testnet: mezoTestnet,
}

/** Blockscout v2 API roots, used only by verification tooling. */
export const EXPLORER_API: Record<NetworkName, string> = {
  mainnet: "https://api.explorer.mezo.org/api/v2",
  testnet: "https://api.explorer.test.mezo.org/api/v2",
}

/** Environment variable that overrides the default RPC for a network. */
export const RPC_ENV_VAR: Record<NetworkName, string> = {
  mainnet: "MEZO_MAINNET_RPC_URL",
  testnet: "MEZO_TESTNET_RPC_URL",
}

export function isNetworkName(value: unknown): value is NetworkName {
  return value === "mainnet" || value === "testnet"
}

/** Throws on anything other than "mainnet" or "testnet"; never guesses a default network. */
export function assertNetworkName(value: unknown): NetworkName {
  if (!isNetworkName(value)) {
    throw new Error(`Unknown Mezo network "${String(value)}". Expected "mainnet" or "testnet".`)
  }
  return value
}

/**
 * RPC URL for a network: an explicit override wins, then the network's env var, then the
 * official default. The override is only ever applied to the network it was given for.
 */
export function resolveRpcUrl(
  network: NetworkName,
  options: { override?: string; env?: Record<string, string | undefined> } = {},
): string {
  const fromEnv = options.env?.[RPC_ENV_VAR[network]]
  const url = options.override ?? (fromEnv && fromEnv.trim() !== "" ? fromEnv.trim() : undefined)
  if (url !== undefined) {
    if (!/^https?:\/\//.test(url)) throw new Error(`RPC URL for ${network} must be http(s): ${url}`)
    return url
  }
  const defaultUrl = CHAINS[network].rpcUrls.default.http[0]
  if (defaultUrl === undefined) throw new Error(`No default RPC configured for ${network}`)
  return defaultUrl
}

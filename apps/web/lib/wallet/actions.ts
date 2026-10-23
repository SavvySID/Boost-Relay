import { mezoTestnet } from "@boost-relay/mezo/chains"
import { UNRECOGNIZED_CHAIN, errorCode, parseChainId, toHexChainId, type Eip1193Provider } from "./eip1193"

/** Mezo Testnet, from the verified chain config (chain 31611, BTC gas with 18 decimals). */
export const TESTNET_CHAIN_ID = mezoTestnet.id

export interface Connection {
  readonly account: string
  readonly chainId: number
}

/** Explicit, user-initiated connection request (eth_requestAccounts opens the wallet prompt). */
export async function requestConnection(provider: Eip1193Provider): Promise<Connection> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as unknown
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") throw new Error("The wallet returned no account.")
  const chainId = parseChainId(await provider.request({ method: "eth_chainId" }))
  return { account: accounts[0], chainId }
}

/** Current account and chain without prompting (eth_accounts never opens a prompt). */
export async function readConnection(provider: Eip1193Provider): Promise<Connection | null> {
  const accounts = (await provider.request({ method: "eth_accounts" })) as unknown
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") return null
  const chainId = parseChainId(await provider.request({ method: "eth_chainId" }))
  return { account: accounts[0], chainId }
}

/** wallet_addEthereumChain parameters built only from the verified chain config. */
export function testnetChainParameters() {
  return {
    chainId: toHexChainId(mezoTestnet.id),
    chainName: mezoTestnet.name,
    nativeCurrency: { name: mezoTestnet.nativeCurrency.name, symbol: mezoTestnet.nativeCurrency.symbol, decimals: mezoTestnet.nativeCurrency.decimals },
    rpcUrls: [...mezoTestnet.rpcUrls.default.http],
    blockExplorerUrls: mezoTestnet.blockExplorers ? [mezoTestnet.blockExplorers.default.url] : [],
  }
}

/**
 * Asks the wallet to switch to Mezo Testnet (only ever called from a button the user clicked).
 * Adds the chain first if the wallet does not know it, then re-reads the wallet's actual chain id.
 */
export async function requestTestnetSwitch(provider: Eip1193Provider): Promise<number> {
  const chainId = toHexChainId(TESTNET_CHAIN_ID)
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] })
  } catch (error) {
    if (errorCode(error) !== UNRECOGNIZED_CHAIN) throw error
    await provider.request({ method: "wallet_addEthereumChain", params: [testnetChainParameters()] })
  }
  return parseChainId(await provider.request({ method: "eth_chainId" }))
}

/** Best-effort permission revoke on explicit disconnect; app state is cleared either way. */
export async function revokeConnection(provider: Eip1193Provider): Promise<void> {
  try {
    await provider.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] })
  } catch {
    // Not every wallet supports revoking; disconnecting the app does not depend on it.
  }
}

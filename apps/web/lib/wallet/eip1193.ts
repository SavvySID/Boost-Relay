/**
 * Minimal EIP-1193 / EIP-6963 types. Boost Relay talks to injected wallets (MetaMask, Rabby and
 * other EIP-6963 wallets) directly with these requests; no wallet SDK, hosted service or project id.
 */

export interface Eip1193Provider {
  request(args: { method: string; params?: readonly unknown[] | object }): Promise<unknown>
  on?(event: string, listener: (...args: unknown[]) => void): void
  removeListener?(event: string, listener: (...args: unknown[]) => void): void
}

/** EIP-6963 provider info announced by the wallet extension. */
export interface WalletInfo {
  readonly uuid: string
  readonly name: string
  readonly icon: string
  readonly rdns: string
}

export interface DiscoveredWallet {
  readonly info: WalletInfo
  readonly provider: Eip1193Provider
}

/** EIP-1193 error codes Boost Relay reacts to. */
export const USER_REJECTED = 4001
export const UNSUPPORTED_METHOD = 4200
export const UNRECOGNIZED_CHAIN = 4902

export function errorCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code
    if (typeof code === "number") return code
    const inner = (error as { data?: { originalError?: { code?: unknown } } }).data?.originalError?.code
    if (typeof inner === "number") return inner
  }
  return undefined
}

export function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && typeof (error as { message?: unknown }).message === "string") return (error as { message: string }).message
  return String(error)
}

/** Chain id from a wallet (hex or decimal). Anything unreadable throws, so callers fail closed. */
export function parseChainId(value: unknown): number {
  let id = Number.NaN
  if (typeof value === "string") {
    if (/^0x[0-9a-fA-F]{1,13}$/.test(value)) id = Number.parseInt(value, 16)
    else if (/^\d{1,15}$/.test(value)) id = Number.parseInt(value, 10)
  } else if (typeof value === "number") id = value
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("wallet returned an unreadable chain id")
  return id
}

export function toHexChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`
}

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

export function parseChainId(value: unknown): number {
  if (typeof value === "string") return value.startsWith("0x") ? Number.parseInt(value, 16) : Number.parseInt(value, 10)
  if (typeof value === "number") return value
  throw new Error("wallet returned an unreadable chain id")
}

export function toHexChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`
}

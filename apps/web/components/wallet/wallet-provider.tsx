"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { requestConnection, requestTestnetSwitch, revokeConnection } from "@/lib/wallet/actions"
import { USER_REJECTED, errorCode, errorMessage, parseChainId, type DiscoveredWallet, type Eip1193Provider } from "@/lib/wallet/eip1193"

export type WalletStatus = "disconnected" | "connecting" | "connected"

export interface WalletState {
  readonly wallets: readonly DiscoveredWallet[]
  readonly status: WalletStatus
  readonly wallet: DiscoveredWallet | null
  readonly account: string | null
  readonly chainId: number | null
  /** Last connection or switch problem, in plain words. */
  readonly error: string | null
  readonly connect: (uuid: string) => Promise<void>
  readonly disconnect: () => Promise<void>
  readonly switchToTestnet: () => Promise<void>
  readonly clearError: () => void
}

const WalletContext = createContext<WalletState | null>(null)

interface AnnounceEvent extends Event {
  readonly detail: DiscoveredWallet
}

/**
 * Wallet discovery and connection. Discovery (EIP-6963 announcements, plus a legacy window.ethereum
 * fallback) never prompts the user. A connection prompt only ever follows a click on "Connect".
 */
export function WalletProvider({ children }: { readonly children: ReactNode }) {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([])
  const [status, setStatus] = useState<WalletStatus>("disconnected")
  const [wallet, setWallet] = useState<DiscoveredWallet | null>(null)
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const active = useRef<DiscoveredWallet | null>(null)

  useEffect(() => {
    const found = new Map<string, DiscoveredWallet>()
    const onAnnounce = (event: Event) => {
      const detail = (event as AnnounceEvent).detail
      if (!detail?.info?.uuid || typeof detail.provider?.request !== "function") return
      found.set(detail.info.uuid, detail)
      setWallets([...found.values()])
    }
    window.addEventListener("eip6963:announceProvider", onAnnounce)
    window.dispatchEvent(new Event("eip6963:requestProvider"))
    // Legacy injected provider, used only when no wallet announces itself via EIP-6963.
    const legacy = (window as unknown as { ethereum?: Eip1193Provider }).ethereum
    const timer = window.setTimeout(() => {
      if (found.size === 0 && legacy && typeof legacy.request === "function") {
        setWallets([{ info: { uuid: "legacy-injected", name: "Browser wallet", icon: "", rdns: "injected" }, provider: legacy }])
      }
    }, 400)
    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce)
      window.clearTimeout(timer)
    }
  }, [])

  // Track account and chain changes on the connected wallet.
  useEffect(() => {
    const provider = wallet?.provider
    if (!provider?.on) return
    const onAccounts = (...args: unknown[]) => {
      const list = args[0]
      if (Array.isArray(list) && typeof list[0] === "string") setAccount(list[0])
      else {
        setAccount(null)
        setChainId(null)
        setStatus("disconnected")
        setWallet(null)
        active.current = null
      }
    }
    const onChain = (...args: unknown[]) => {
      try {
        setChainId(parseChainId(args[0]))
      } catch {
        setChainId(null)
      }
    }
    const onDisconnect = () => {
      setAccount(null)
      setChainId(null)
      setStatus("disconnected")
    }
    provider.on("accountsChanged", onAccounts)
    provider.on("chainChanged", onChain)
    provider.on("disconnect", onDisconnect)
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts)
      provider.removeListener?.("chainChanged", onChain)
      provider.removeListener?.("disconnect", onDisconnect)
    }
  }, [wallet])

  const connect = useCallback(
    async (uuid: string) => {
      const target = wallets.find((w) => w.info.uuid === uuid)
      if (!target) return
      setError(null)
      setStatus("connecting")
      try {
        const c = await requestConnection(target.provider)
        active.current = target
        setWallet(target)
        setAccount(c.account)
        setChainId(c.chainId)
        setStatus("connected")
      } catch (e) {
        setStatus("disconnected")
        setError(errorCode(e) === USER_REJECTED ? "The connection request was rejected in the wallet." : `The wallet did not connect: ${errorMessage(e)}`)
      }
    },
    [wallets],
  )

  const disconnect = useCallback(async () => {
    const current = active.current
    active.current = null
    setWallet(null)
    setAccount(null)
    setChainId(null)
    setStatus("disconnected")
    if (current) await revokeConnection(current.provider)
  }, [])

  const switchToTestnet = useCallback(async () => {
    const current = active.current
    if (!current) return
    setError(null)
    try {
      setChainId(await requestTestnetSwitch(current.provider)) // the wallet's actual chain, re-read after the request
    } catch (e) {
      setError(errorCode(e) === USER_REJECTED ? "The network switch was rejected in the wallet." : `The wallet could not switch to Mezo Testnet: ${errorMessage(e)}`)
    }
  }, [])

  const value = useMemo<WalletState>(
    () => ({ wallets, status, wallet, account, chainId, error, connect, disconnect, switchToTestnet, clearError: () => setError(null) }),
    [wallets, status, wallet, account, chainId, error, connect, disconnect, switchToTestnet],
  )
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext)
  if (ctx === null) throw new Error("useWallet must be used inside WalletProvider")
  return ctx
}

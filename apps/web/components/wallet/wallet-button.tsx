"use client"

import { useEffect, useRef, useState } from "react"
import { short } from "@/lib/market-formatting"
import { chip, ui } from "@/lib/ui"
import { TESTNET_CHAIN_ID } from "@/lib/wallet/actions"
import { useWallet } from "./wallet-provider"

const CHAIN_NAMES: Record<number, string> = { 31611: "Mezo Testnet", 31612: "Mezo Mainnet" }

export function chainLabel(chainId: number | null): string {
  if (chainId === null) return "Unknown network"
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`
}

/** Top-bar wallet control: connect (explicit click), connected account and network, disconnect. */
export function WalletButton() {
  const w = useWallet()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("mousedown", onDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  const connected = w.status === "connected" && w.account !== null
  return (
    <div ref={root} className="relative">
      {connected ? (
        <button key="account" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" className={ui.btnSecondary}>
          <span aria-hidden="true" className={`size-2 rounded-full ${w.chainId === TESTNET_CHAIN_ID ? "bg-success-fg" : "bg-warn-fg"}`} />
          <span className="num">{short(w.account ?? "")}</span>
        </button>
      ) : (
        <button key="connect" type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog" disabled={w.status === "connecting"} className={ui.btnPrimary}>
          {w.status === "connecting" ? "Check your wallet…" : "Connect wallet"}
        </button>
      )}

      {open ? (
        <div role={connected ? "menu" : "dialog"} aria-label={connected ? "Wallet" : "Connect a wallet"} className="absolute right-0 top-full z-50 mt-2 w-72 rounded-[var(--radius-lg)] border border-line bg-surface p-3 shadow-[var(--shadow-raise)]">
          {connected ? (
            <div className="grid gap-3 p-1 text-sm">
              <div>
                <p className={ui.label}>Connected account</p>
                <p className="num mt-0.5 break-all font-medium text-fg">{w.account}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className={ui.label}>Wallet network</span>
                <span className={chip(w.chainId === TESTNET_CHAIN_ID ? "success" : "warn")}>{chainLabel(w.chainId)}</span>
              </div>
              {w.wallet ? <p className="text-xs text-fg-3">Via {w.wallet.info.name}</p> : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  void w.disconnect()
                }}
                className={ui.btnSecondary}
              >
                Disconnect
              </button>
            </div>
          ) : w.wallets.length === 0 ? (
            <div className="p-1 text-sm text-fg-2">
              <p className="font-medium text-fg">No browser wallet found</p>
              <p className="mt-1 leading-relaxed">Install an EVM wallet extension such as MetaMask or Rabby, then reload. Browsing and the optimizer work without a wallet.</p>
            </div>
          ) : (
            <div className="grid gap-1">
              <p className="px-1 pb-1 text-xs text-fg-3">Boost Relay never asks for a seed phrase or private key.</p>
              {w.wallets.map((d) => (
                <button
                  key={d.info.uuid}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    void w.connect(d.info.uuid)
                  }}
                  className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-sm font-medium text-fg hover:bg-subtle"
                >
                  {d.info.icon ? <img src={d.info.icon} alt="" className="size-6 rounded" /> : <span aria-hidden="true" className="size-6 rounded bg-fill" />}
                  {d.info.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
      {w.error !== null && !open ? (
        <p role="alert" className="absolute right-0 top-full z-40 mt-2 w-72 rounded-[var(--radius-md)] bg-danger-bg px-3 py-2 text-xs text-danger-fg">
          {w.error}{" "}
          <button type="button" onClick={w.clearError} className="underline">
            Dismiss
          </button>
        </p>
      ) : null}
    </div>
  )
}

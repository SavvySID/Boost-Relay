"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import type { NetworkName } from "@/lib/market-dto"
import { NAV, isActive, type NavItem } from "@/lib/site"
import { ui } from "@/lib/ui"
import { withNetwork } from "@/lib/use-network"
import { WalletButton } from "../wallet/wallet-button"
import { Wordmark } from "./brand"

/**
 * Global navigation for every page. App pages (Boost Market, Vote Optimizer) show the wallet
 * control and keep the selected network in their links; marketing pages show "Launch app".
 * Opening or closing the mobile menu never touches the wallet.
 */
export function SiteHeader(props: { readonly network?: NetworkName; readonly app?: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  // Close the menu after navigating.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false)
        toggle.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const href = (item: NavItem) => (item.keepsNetwork && props.network !== undefined ? withNetwork(item.href, props.network) : item.href)

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/90 backdrop-blur-md">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-[var(--shadow-raise)]"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Boost Relay home" className="mr-2 shrink-0 rounded-md">
          <Wordmark compact />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = isActive(item.href, pathname)
              return (
                <li key={item.href}>
                  <Link
                    href={href(item)}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${active ? "bg-fill text-fg" : "text-fg-2 hover:bg-subtle hover:text-fg"}`}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {props.app ? (
            <WalletButton />
          ) : (
            <Link href="/market" className={`${ui.btnPrimary} whitespace-nowrap`}>
              Launch app
            </Link>
          )}
          <button
            ref={toggle}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "Close menu" : "Open menu"}
            className="inline-flex size-10 items-center justify-center rounded-full text-fg transition-colors hover:bg-fill lg:hidden"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
              {open ? (
                <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <nav id={menuId} aria-label="Main" hidden={!open} className="border-t border-line bg-page lg:hidden">
        <ul className="mx-auto grid max-w-[1200px] gap-1 px-4 py-3 sm:px-6">
          {NAV.map((item) => {
            const active = isActive(item.href, pathname)
            return (
              <li key={item.href}>
                <Link
                  href={href(item)}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-between rounded-[var(--radius-md)] px-4 py-3 text-base font-medium ${active ? "bg-fill text-fg" : "text-fg-2 hover:bg-subtle hover:text-fg"}`}
                >
                  {item.label}
                  {active ? <span className="text-xs font-normal text-fg-3">Current page</span> : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </header>
  )
}

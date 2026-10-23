"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"
import type { NetworkName } from "@/lib/market-dto"
import { chip } from "@/lib/ui"
import { withNetwork } from "@/lib/use-network"
import { WalletButton } from "./wallet/wallet-button"

const NAV: readonly { readonly href: string; readonly label: string; readonly icon: ReactNode }[] = [
  {
    href: "/",
    label: "Boost Market",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
        <path d="M4 19V5M4 19h16M8 15v-3M12 15V8M16 15v-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/optimizer",
    label: "Vote Optimizer",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
        <rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="m8.5 12.5 2.5 2.5 4.5-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

/** Boost Relay mark: two rising chevrons. */
export function BrandMark({ className = "" }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M5 13 12 6.5 19 13" fill="none" stroke="var(--color-accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19 12 12.5 19 19" fill="none" stroke="var(--color-fg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function NetworkBadge({ network }: { readonly network: NetworkName }) {
  return <span className={chip(network === "mainnet" ? "neutral" : "info")}>{network === "mainnet" ? "Mainnet" : "Testnet"}</span>
}

export function AppShell(props: {
  readonly network: NetworkName
  readonly title: string
  readonly actions: ReactNode
  readonly children: ReactNode
}) {
  const pathname = usePathname()
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href))
  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-[var(--shadow-raise)]">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line lg:flex">
        <div className="flex h-[60px] items-center gap-2 px-4">
          <BrandMark className="size-6 shrink-0" />
          <span className="whitespace-nowrap text-base font-semibold tracking-tight text-fg">Boost Relay</span>
          <NetworkBadge network={props.network} />
        </div>
        <nav aria-label="Boost Relay" className="mt-1 px-4">
          <ul className="grid gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={withNetwork(n.href, props.network)}
                  aria-current={active(n.href) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium transition-colors ${
                    active(n.href) ? "bg-fill text-fg" : "text-fg-2 hover:bg-subtle hover:text-fg"
                  }`}
                >
                  {n.icon}
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mx-0 my-4 border-t border-line" />
        <div className="px-4">
          <a
            href={props.network === "mainnet" ? "https://mezo.org" : "https://testnet.mezo.org/home"}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium text-fg-2 hover:bg-subtle hover:text-fg"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M4 12h16M12 4c2.5 2.6 2.5 13.4 0 16M12 4c-2.5 2.6-2.5 13.4 0 16" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Open the Mezo app
          </a>
        </div>
        <p className="mt-auto px-5 pb-5 text-xs leading-relaxed text-fg-3">
          Analytics built on public Mezo contracts. Votes are signed only by your own wallet. Independent project, not affiliated with or endorsed by Mezo.
        </p>
      </aside>

      <div className="min-w-0">
        <header className="z-30 border-b border-line bg-page/95 backdrop-blur md:sticky md:top-0">
          <div className="flex min-h-[60px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
            <div className="flex items-center gap-2.5 lg:hidden">
              <BrandMark className="size-6" />
              <span className="font-semibold tracking-tight text-fg">Boost Relay</span>
              <NetworkBadge network={props.network} />
            </div>
            <p className="hidden text-sm text-fg-2 lg:block">{props.title}</p>
            <div className="ml-auto flex flex-wrap items-center gap-2.5">
              {props.actions}
              <WalletButton />
            </div>
          </div>
          <nav aria-label="Boost Relay sections" className="flex gap-1 border-t border-line px-3 py-2 lg:hidden">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={withNetwork(n.href, props.network)}
                aria-current={active(n.href) ? "page" : undefined}
                className={`flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium ${active(n.href) ? "bg-fill text-fg" : "text-fg-2"}`}
              >
                {n.icon}
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
          {props.children}
        </main>
      </div>
    </div>
  )
}

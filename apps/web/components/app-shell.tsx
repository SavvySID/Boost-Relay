import type { ReactNode } from "react"

export function AppShell({ header, children }: { readonly header: ReactNode; readonly children: ReactNode }) {
  return (
    <>
      <a
        href="#positions"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink-850 focus:px-3 focus:py-2"
      >
        Skip to positions
      </a>
      {header}
      <main className="mx-auto w-full max-w-[1320px] px-4 pb-16 sm:px-6">{children}</main>
    </>
  )
}

/** Boost Relay mark: two stacked chevrons rising out of a base line. */
export function BrandMark({ className = "" }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
      <path d="M7 13.5 12 9l5 4.5" fill="none" stroke="#f7931a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 17.5 12 13l5 4.5" fill="none" stroke="#f7931a" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

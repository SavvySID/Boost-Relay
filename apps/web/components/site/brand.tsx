/** Boost Relay mark: two rising chevrons. */
export function BrandMark({ className = "", tone = "default" }: { readonly className?: string; readonly tone?: "default" | "inverse" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M5 13 12 6.5 19 13" fill="none" stroke="var(--color-accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M5 19 12 12.5 19 19"
        fill="none"
        stroke={tone === "inverse" ? "#ffffff" : "var(--color-fg)"}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Mark and name. `compact` hides the name on very narrow screens so header controls fit. */
export function Wordmark({ tone = "default", compact = false }: { readonly tone?: "default" | "inverse"; readonly compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <BrandMark className="size-6 shrink-0" tone={tone} />
      <span className={`whitespace-nowrap text-[15px] font-semibold tracking-tight ${tone === "inverse" ? "text-white" : "text-fg"} ${compact ? "max-[359px]:sr-only" : ""}`}>
        Boost Relay
      </span>
    </span>
  )
}

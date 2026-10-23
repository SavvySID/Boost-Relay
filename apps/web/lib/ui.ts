/**
 * Shared component recipes on top of the tokens in app/globals.css. Components use these instead
 * of ad-hoc colors so the Boost Market and the Vote Optimizer stay one visual system.
 */
export const ui = {
  card: "rounded-[var(--radius-lg)] border border-line bg-surface",
  cardBody: "p-5 sm:p-6",
  sectionTitle: "text-base font-medium tracking-tight text-fg",
  label: "text-xs text-fg-3",
  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40",
  btnSecondary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-fill px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-fill-hover disabled:cursor-not-allowed disabled:opacity-50",
  btnQuiet: "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-fg-2 transition-colors hover:bg-fill hover:text-fg",
  input:
    "w-full rounded-[var(--radius-md)] border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-3 focus:border-fg focus:outline-none focus-visible:outline-2",
  link: "text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent",
  chip: {
    base: "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
    success: "bg-success-bg text-success-fg",
    info: "bg-info-bg text-info-fg",
    warn: "bg-warn-bg text-warn-fg",
    danger: "bg-danger-bg text-danger-fg",
    neutral: "bg-fill text-fg-2",
  },
} as const

export type ChipTone = Exclude<keyof typeof ui.chip, "base">

export function chip(tone: ChipTone): string {
  return `${ui.chip.base} ${ui.chip[tone]}`
}

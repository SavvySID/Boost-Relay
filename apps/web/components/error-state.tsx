import type { NetworkName } from "@/lib/market-dto"
import { ui } from "@/lib/ui"

export function ErrorState({
  network,
  message,
  onRetry,
  subject = "snapshot",
}: {
  readonly network: NetworkName
  readonly message: string
  readonly onRetry: () => void
  readonly subject?: string
}) {
  return (
    <div role="alert" className="max-w-[44rem] rounded-[var(--radius-lg)] bg-danger-bg px-5 py-5">
      <p className="font-medium text-danger-fg">
        No Mezo {network === "mainnet" ? "Mainnet" : "Testnet"} {subject} to show
      </p>
      <p className="mt-1 text-sm leading-relaxed text-fg-body">{message}</p>
      <p className="mt-1 text-sm leading-relaxed text-fg-2">Boost Relay only shows numbers it read from the chain, so nothing is estimated in their place.</p>
      <button type="button" onClick={onRetry} className={`mt-4 ${ui.btnPrimary}`}>
        Try again
      </button>
    </div>
  )
}

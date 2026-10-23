import type { NetworkName } from "@/lib/market-dto"
import { ui } from "@/lib/ui"

function Bar({ className }: { readonly className: string }) {
  return <div className={`animate-pulse rounded-[var(--radius-sm)] bg-fill ${className}`} />
}

export function LoadingState({ network, subject = "every veBTC position" }: { readonly network: NetworkName; readonly subject?: string }) {
  return (
    <div aria-busy="true" className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="rounded-[var(--radius-lg)] bg-warm p-5 sm:p-8">
        <p role="status" className="text-sm text-fg-2">
          Reading Mezo {network === "mainnet" ? "Mainnet" : "Testnet"}: scanning {subject} at one block. A first read takes about 10 to 40 seconds.
        </p>
        <div className="mt-5 grid max-w-[60rem] gap-3" aria-hidden="true">
          <Bar className="h-8 w-11/12" />
          <Bar className="h-8 w-3/4" />
          <Bar className="mt-4 h-4 w-full" />
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" aria-hidden="true">
        <div className={`${ui.card} ${ui.cardBody} grid gap-3`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Bar key={i} className="h-9" />
          ))}
        </div>
        <div className={`${ui.card} ${ui.cardBody}`}>
          <Bar className="h-56" />
        </div>
      </div>
    </div>
  )
}

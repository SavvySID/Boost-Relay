import type { NetworkName } from "@/lib/market-dto"

export function ErrorState({ network, message, onRetry }: { readonly network: NetworkName; readonly message: string; readonly onRetry: () => void }) {
  return (
    <div role="alert" className="my-10 max-w-[44rem] rounded-lg border border-bad/40 bg-bad/10 px-5 py-5">
      <p className="font-medium text-fg">No Mezo {network === "mainnet" ? "Mainnet" : "Testnet"} snapshot to show</p>
      <p className="mt-1 text-sm leading-relaxed text-fg-2">{message}</p>
      <p className="mt-1 text-sm leading-relaxed text-fg-3">Boost Relay only shows numbers it read from the chain, so nothing is estimated in their place.</p>
      <button type="button" onClick={onRetry} className="mt-4 rounded-lg border border-line-strong bg-ink-850 px-3 py-1.5 text-sm text-fg hover:border-btc/60">
        Try again
      </button>
    </div>
  )
}

import type { NetworkName } from "@/lib/market-dto"

function Bar({ className }: { readonly className: string }) {
  return <div className={`animate-pulse rounded bg-ink-850 ${className}`} />
}

export function LoadingState({ network }: { readonly network: NetworkName }) {
  return (
    <div aria-busy="true" className="py-8 lg:py-10">
      <p role="status" className="text-sm text-fg-2">
        Reading Mezo {network === "mainnet" ? "Mainnet" : "Testnet"}: scanning every veBTC position at one block. A first read
        takes about 10 to 40 seconds.
      </p>
      <div className="mt-6 grid max-w-[62rem] gap-3" aria-hidden="true">
        <Bar className="h-9 w-11/12" />
        <Bar className="h-9 w-3/4" />
        <Bar className="mt-6 h-4 w-full" />
        <div className="grid grid-cols-3 gap-4">
          <Bar className="h-12" />
          <Bar className="h-12" />
          <Bar className="h-12" />
        </div>
      </div>
      <div className="mt-10 grid gap-6 border-t border-line pt-8 lg:grid-cols-[5fr_6fr]" aria-hidden="true">
        <div className="grid gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Bar key={i} className="h-10" />
          ))}
        </div>
        <Bar className="h-56" />
      </div>
    </div>
  )
}

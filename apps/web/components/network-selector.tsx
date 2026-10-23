import type { NetworkName } from "@/lib/market-dto"

const OPTIONS: readonly { readonly id: NetworkName; readonly label: string }[] = [
  { id: "mainnet", label: "Mainnet" },
  { id: "testnet", label: "Testnet" },
]

export function NetworkSelector({ value, onChange }: { readonly value: NetworkName; readonly onChange: (n: NetworkName) => void }) {
  return (
    <fieldset className="shrink-0">
      <legend className="sr-only">Mezo network</legend>
      <div className="inline-flex rounded-lg border border-line bg-ink-900 p-0.5">
        {OPTIONS.map((o) => (
          <label key={o.id} className="relative cursor-pointer">
            <input
              type="radio"
              name="network"
              value={o.id}
              checked={value === o.id}
              onChange={() => onChange(o.id)}
              className="peer sr-only"
            />
            <span className="block rounded-md px-3 py-1.5 text-sm text-fg-2 transition-colors peer-checked:bg-ink-800 peer-checked:text-fg peer-focus-visible:outline-2 peer-focus-visible:outline-btc hover:text-fg">
              Mezo {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

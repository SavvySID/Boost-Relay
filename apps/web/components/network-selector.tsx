import type { NetworkName } from "@/lib/market-dto"

const OPTIONS: readonly { readonly id: NetworkName; readonly label: string }[] = [
  { id: "mainnet", label: "Mainnet" },
  { id: "testnet", label: "Testnet" },
]

/** Mezo-style segmented control: gray pill track, white raised thumb. */
export function NetworkSelector({ value, onChange }: { readonly value: NetworkName; readonly onChange: (n: NetworkName) => void }) {
  return (
    <fieldset className="shrink-0">
      <legend className="sr-only">Mezo network</legend>
      <div className="inline-flex rounded-full bg-fill p-1">
        {OPTIONS.map((o) => (
          <label key={o.id} className="relative cursor-pointer">
            <input type="radio" name="network" value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} className="peer sr-only" />
            <span className="block rounded-full px-3.5 py-1.5 text-sm font-medium text-fg-2 transition-colors peer-checked:bg-surface peer-checked:text-fg peer-checked:shadow-[var(--shadow-raise)] peer-focus-visible:outline-2 peer-focus-visible:outline-accent hover:text-fg">
              Mezo {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

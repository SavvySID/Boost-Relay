import type { OptimizerDto } from "@/lib/optimizer-dto"

export type Strategy = "max-boosted-power" | "max-capped-positions"

const ORDER: readonly Strategy[] = ["max-boosted-power", "max-capped-positions"]

/** Two radio cards; both recommendations are already computed, so switching never re-reads the chain. */
export function StrategySelector({ value, onChange, data }: { readonly value: Strategy; readonly onChange: (s: Strategy) => void; readonly data: OptimizerDto }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-fg">Strategy</legend>
      <div className="grid gap-3 md:grid-cols-2">
        {ORDER.map((id) => {
          const s = data.strategies[id]
          const on = value === id
          return (
            <label key={id} className={`relative block cursor-pointer rounded-[var(--radius-lg)] border p-4 transition-colors ${on ? "border-fg bg-surface" : "border-line bg-surface hover:border-line-strong"}`}>
              <input type="radio" name="strategy" value={id} checked={on} onChange={() => onChange(id)} className="peer sr-only" />
              <span aria-hidden="true" className={`absolute right-4 top-4 grid size-4 place-items-center rounded-full border ${on ? "border-fg" : "border-line-strong"}`}>
                {on ? <span className="size-2 rounded-full bg-fg" /> : null}
              </span>
              <span className="block pr-8 text-sm font-medium text-fg">{s.label}</span>
              <span className="mt-1 block text-sm leading-relaxed text-fg-2">{s.objective}</span>
              <span className="mt-2 block text-xs leading-relaxed text-fg-3">{s.guarantee}</span>
              <span className="pointer-events-none absolute inset-0 rounded-[var(--radius-lg)] peer-focus-visible:outline-2 peer-focus-visible:outline-accent" />
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

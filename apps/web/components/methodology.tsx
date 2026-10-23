import type { MarketDto } from "@/lib/market-dto"
import { integer, utcDateTime } from "@/lib/market-formatting"

export function Methodology({ data }: { readonly data: MarketDto }) {
  const { meta, global } = data
  return (
    <footer className="border-t border-line pt-6 text-xs leading-relaxed text-fg-3">
      <h3 className="text-sm font-medium text-fg-2">How these numbers are read</h3>
      <div className="mt-2 grid max-w-[72ch] gap-2">
        <p>
          Everything on this page comes from Mezo {meta.network === "mainnet" ? "Mainnet" : "Testnet"} contracts (BoostVoter, veMEZO, veBTC and each
          gauge&apos;s incentive contract) read at block {integer(meta.blockNumber)} ({utcDateTime(meta.blockTimestamp)}). Live boost uses the same integer math
          as BoostVoter.getBoost. No figure here comes from earlier research snapshots.
        </p>
        <p>
          Votes can be cast in this epoch until {utcDateTime(global.epoch.voteEnd)}. A position counts as active when its gauge is open and its veBTC lock
          still has voting power.
        </p>
        <p>Read-only: Boost Relay does not connect a wallet and never signs or sends a transaction. It is an independent project, not affiliated with Mezo.</p>
      </div>
    </footer>
  )
}

const PRINCIPLES = [
  {
    title: "Public, on-chain data",
    text: "Every number is read from Mezo's own contracts (BoostVoter, veMEZO, veBTC and the gauge incentive contracts) through public RPC.",
  },
  {
    title: "Transparent math",
    text: "Boost and the votes needed for 5x use BoostVoter's own fixed-point formula. At checked blocks it matched the contract's getBoost for every position on both networks.",
  },
  {
    title: "Source block on every view",
    text: "Each snapshot names the block it was read at and how old it is, and marks itself partial when any read fails.",
  },
  {
    title: "Your signature, your wallet",
    text: "Votes are signed in the NFT owner's own browser wallet. Boost Relay never asks for a seed phrase or private key.",
  },
  {
    title: "No custody",
    text: "Boost Relay never holds NFTs, MEZO, BTC or MUSD, and has no vault or pooled funds today.",
  },
  {
    title: "Testnet-only execution",
    text: "In the current beta, votes can be submitted on Mezo Testnet only. Mainnet is analytics, read-only.",
  },
] as const

export function Principles() {
  return (
    <section aria-labelledby="principles-title" className="border-t border-line">
      <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:py-24">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
          <div>
            <h2 id="principles-title" className="text-[clamp(1.75rem,3.2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.025em] text-balance text-fg">
              Built to be checked
            </h2>
            <p className="mt-3 text-base leading-relaxed text-fg-2">
              Boost Relay has not been audited and makes no security certification. It is designed so you can verify what it shows.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-fg-3">
              Market data and simulations describe one block. Voting power decays and other voters act, so figures can go stale; the app re-reads the chain
              before preparing a vote.
            </p>
          </div>
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="border-t border-fg pt-4">
                <dt className="text-base font-medium text-fg">{p.title}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-fg-2">{p.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

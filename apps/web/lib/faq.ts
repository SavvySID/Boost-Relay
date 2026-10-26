/**
 * Homepage FAQ. The same text feeds the visible accordion and the FAQPage structured data, so the
 * two can never disagree.
 */
export interface FaqItem {
  readonly id: string
  readonly question: string
  readonly answer: string
}

export const FAQ: readonly FaqItem[] = [
  {
    id: "what",
    question: "What is Boost Relay?",
    answer:
      "Boost Relay is an independent analytics and vote-allocation interface for Mezo's veBTC boost gauges and the veMEZO voting system. It shows where boosts are under-powered or capped, and recommends how a veMEZO NFT could split its votes.",
  },
  {
    id: "custody",
    question: "Does Boost Relay hold my funds or NFT?",
    answer:
      "No. Boost Relay is built around non-custodial wallet interaction: it never holds NFTs or tokens, and it never needs your private key or seed phrase. Eligible votes are signed by the NFT owner directly in their own wallet.",
  },
  {
    id: "networks",
    question: "Which networks are supported?",
    answer:
      "Mezo Mainnet and Mezo Testnet are both supported for read-only analytics. Submitting a vote is a beta that works on Mezo Testnet only; voting on mainnet is disabled.",
  },
  {
    id: "auto-vote",
    question: "Does Boost Relay automatically vote for me?",
    answer:
      "No. The optimizer produces a recommendation. You review the proposal, re-check it against fresh chain data, and explicitly authorize any eligible transaction in your own wallet. Nothing is signed or sent automatically.",
  },
  {
    id: "math",
    question: "How is boost calculated?",
    answer:
      "Boost Relay mirrors the verified BoostVoter boost calculation with the same fixed-point integer arithmetic, including the protocol's 5x cap. Boost grows with the share of veMEZO votes on a position's gauge relative to that position's share of veBTC voting power.",
  },
  {
    id: "applied",
    question: "Why might the boost in the dashboard differ from the applied boost?",
    answer:
      "The live boost is calculated from current votes and voting power. The boost stored on a veBTC position changes only when the permissionless boost update (pokeBoost) is called for it, so the two can differ until then. Boost Relay does not call that update for you.",
  },
  {
    id: "above-cap",
    question: "Does an allocation above the 5x cap earn nothing?",
    answer:
      "Not necessarily. Votes past a position's 5x requirement cannot raise its boost any further, but they may still earn posted incentives or count toward other reward programs. Boost Relay measures boost efficiency, not lost income.",
  },
  {
    id: "vault",
    question: "What is Vault Relay?",
    answer:
      "Vault Relay is a planned extension that explores managed voting, reward compounding and possible liquidity for locked voting power. It is not live: there is no vault contract, it accepts no deposits and there is no launch date.",
  },
  {
    id: "live",
    question: "Are the market statistics live?",
    answer:
      "They come from on-chain snapshots read at a single block. Every view shows that block and how old it is, and a snapshot is marked partial when any read fails. Figures can go stale as the chain moves, so refresh before acting on them.",
  },
  {
    id: "official",
    question: "Is Boost Relay an official Mezo product?",
    answer: "No. Boost Relay is an independent project and is not affiliated with, endorsed by or operated by Mezo.",
  },
  {
    id: "incentives",
    question: "Are displayed incentives guaranteed earnings?",
    answer:
      "No. Incentives shown are what has been posted for the current epoch. Posted incentives and past voting data do not guarantee future earnings, prices or any particular reward for you.",
  },
  {
    id: "business",
    question: "How will Boost Relay sustain itself?",
    answer:
      "Today everything on Boost Relay is free: there is no fee and no token. The plan, which is not live, keeps the Boost Market and the Vote Optimizer free and charges for extras: alerts for veBTC holders when their boost slips below 5x (with the exact veMEZO needed to get back), and, if Vault Relay ever launches, a small fee on the rewards it compounds.",
  },
  {
    id: "advice",
    question: "Is the Vote Optimizer financial advice?",
    answer:
      "No. Its output is a recommendation computed from observed chain state and the strategy you choose. You remain responsible for reviewing each transaction and its risks.",
  },
]

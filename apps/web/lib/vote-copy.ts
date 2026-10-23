/** What the owner confirms before "Sign & Submit Vote". Shared by the vote panel and the site preview. */
export const ACKNOWLEDGEMENTS = [
  "This records veMEZO's vote in BoostVoter for the current epoch.",
  "Any existing boost votes of this NFT are removed and replaced by this allocation (BoostVoter resets them first).",
  "BoostVoter allows one vote per NFT per epoch; it cannot be changed again until the next epoch.",
  "Live boost changes when the vote lands, but the boost applied to each veBTC updates only after someone calls the permissionless pokeBoost. Boost Relay does not poke.",
  "You are signing a blockchain transaction with your own wallet and will pay network gas in BTC.",
] as const

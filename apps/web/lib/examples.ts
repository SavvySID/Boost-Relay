/**
 * Public Mezo Mainnet veMEZO NFTs used by "Try an example", so anyone can see the optimizer work
 * without owning one. Checked read-only on 2026-10-26: each exists, has voting power and stays
 * locked well past the Wave 1 judging period. Example mode is analysis only; Boost Relay never
 * votes for these NFTs (mainnet voting is disabled, and only an NFT's owner can sign).
 */
export const MAINNET_EXAMPLES: readonly { readonly tokenId: string; readonly note: string }[] = [
  { tokenId: "91", note: "Large permanent lock that already votes: shows how its current votes would be replaced." },
  { tokenId: "100", note: "Permanent lock with no boost votes yet: a fresh allocation." },
  { tokenId: "139", note: "Smaller position, locked until 2029." },
]

export function isMainnetExample(tokenId: string): boolean {
  return MAINNET_EXAMPLES.some((e) => e.tokenId === tokenId)
}

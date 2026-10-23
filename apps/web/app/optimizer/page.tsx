import type { Metadata } from "next"
import { Suspense } from "react"
import { VoteOptimizer } from "@/components/optimizer/vote-optimizer"

export const metadata: Metadata = {
  title: "Vote Optimizer",
  description: "veMEZO vote recommendations computed with BoostVoter's exact vote() and boost math, with owner-signed voting on Mezo Testnet.",
  openGraph: { title: "Vote Optimizer | Boost Relay", description: "Turn a veMEZO NFT's voting power into a better boost allocation, then review and sign it yourself on Mezo Testnet." },
}

export default function OptimizerPage() {
  return (
    <Suspense>
      <VoteOptimizer />
    </Suspense>
  )
}

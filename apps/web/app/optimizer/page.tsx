import type { Metadata } from "next"
import { Suspense } from "react"
import { VoteOptimizer } from "@/components/optimizer/vote-optimizer"

export const metadata: Metadata = {
  title: "Vote Optimizer | Boost Relay",
  description: "veMEZO vote recommendations computed with BoostVoter's exact vote() and boost math, with owner-signed voting on Mezo Testnet.",
}

export default function OptimizerPage() {
  return (
    <Suspense>
      <VoteOptimizer />
    </Suspense>
  )
}

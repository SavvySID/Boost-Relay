import type { Metadata } from "next"
import { Suspense } from "react"
import { BoostMarket } from "@/components/boost-market"

export const metadata: Metadata = {
  title: "Boost Market",
  description: "Every veBTC boost position on Mezo, read at one block: live and applied boost, veMEZO votes, the exact votes each position needs for 5x, and posted incentives.",
  openGraph: { title: "Boost Market | Boost Relay", description: "Live veBTC boost positions, votes and 5x requirements on Mezo, read at one block." },
}

export default function MarketPage() {
  // useSearchParams (the network lives in the URL) needs a Suspense boundary for static rendering.
  return (
    <Suspense>
      <BoostMarket />
    </Suspense>
  )
}

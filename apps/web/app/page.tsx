import { Suspense } from "react"
import { BoostMarket } from "@/components/boost-market"

export default function Page() {
  // useSearchParams (the network lives in the URL) needs a Suspense boundary for static rendering.
  return (
    <Suspense>
      <BoostMarket />
    </Suspense>
  )
}

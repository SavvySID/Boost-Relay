"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import type { NetworkName } from "./market-dto"

/**
 * The selected network lives in the URL (?network=testnet), so the Boost Market and the Vote
 * Optimizer always show the same network and links can be shared. Mainnet is the default.
 */
export function useNetwork(): readonly [NetworkName, (n: NetworkName) => void] {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const network: NetworkName = params.get("network") === "testnet" ? "testnet" : "mainnet"
  const setNetwork = useCallback(
    (next: NetworkName) => {
      const q = new URLSearchParams(params.toString())
      if (next === "mainnet") q.delete("network")
      else q.set("network", next)
      const query = q.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [params, pathname, router],
  )
  return [network, setNetwork] as const
}

/** Same-network link to another page. */
export function withNetwork(path: string, network: NetworkName): string {
  return network === "mainnet" ? path : `${path}?network=${network}`
}

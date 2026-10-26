/** Site-wide navigation. Every destination is an internal route; nothing leaves Boost Relay. */
export interface NavItem {
  readonly href: string
  readonly label: string
  /** App pages keep the selected network (?network=testnet) when linking to each other. */
  readonly keepsNetwork: boolean
}

export const NAV: readonly NavItem[] = [
  { href: "/", label: "Home", keepsNetwork: false },
  { href: "/market", label: "Boost Market", keepsNetwork: true },
  { href: "/optimizer", label: "Vote Optimizer", keepsNetwork: true },
  { href: "/vault", label: "Vault Relay", keepsNetwork: false },
  { href: "/#faq", label: "FAQ", keepsNetwork: false },
]

export function isActive(href: string, pathname: string): boolean {
  if (href.includes("#")) return false
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export const SITE_DESCRIPTION =
  "A boost vote optimizer for Mezo: see where veBTC boosts are underpowered and where veMEZO votes sit above the 5x cap, then build and sign a better allocation."

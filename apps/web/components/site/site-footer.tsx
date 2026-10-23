import Link from "next/link"
import { Wordmark } from "./brand"

const PRODUCT = [
  { href: "/market", label: "Boost Market" },
  { href: "/optimizer", label: "Vote Optimizer" },
  { href: "/vault", label: "Vault Relay" },
] as const

const SITE = [
  { href: "/", label: "Home" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
] as const

function Column(props: { readonly title: string; readonly links: readonly { readonly href: string; readonly label: string }[] }) {
  return (
    <div>
      <h2 className="text-sm font-medium text-fg">{props.title}</h2>
      <ul className="mt-3 grid gap-2.5 text-sm">
        {props.links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-fg-2 transition-colors hover:text-fg">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-line bg-page">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:py-16">
        <div className="col-span-2 max-w-sm md:col-span-1">
          <Link href="/" aria-label="Boost Relay home" className="inline-block rounded-md">
            <Wordmark />
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-fg-2">
            Analytics and vote allocation for Mezo&apos;s veBTC boost gauges. Built on public contract data; every vote is signed by its owner&apos;s own wallet.
          </p>
        </div>
        <Column title="Product" links={PRODUCT} />
        <Column title="Site" links={SITE} />
        <div>
          <h2 className="text-sm font-medium text-fg">Networks</h2>
          <dl className="mt-3 grid gap-2.5 text-sm">
            <div>
              <dt className="text-fg">Mezo Mainnet</dt>
              <dd className="text-fg-3">Analytics, read-only</dd>
            </div>
            <div>
              <dt className="text-fg">Mezo Testnet</dt>
              <dd className="text-fg-3">Analytics and voting beta</dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-4 py-6 text-xs leading-relaxed text-fg-3 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>Boost Relay is an independent project. It is not affiliated with, endorsed by or operated by Mezo.</p>
          <p className="shrink-0">© {year} Boost Relay</p>
        </div>
      </div>
    </footer>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { ui } from "@/lib/ui"

export const metadata: Metadata = { title: "Page not found" }

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <SiteHeader />
      <main id="main" className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col justify-center px-4 py-24 sm:px-6">
        <p className="text-sm text-fg-3">404</p>
        <h1 className="mt-2 text-[clamp(2rem,4.4vw,3rem)] font-medium leading-[1.05] tracking-[-0.03em] text-balance text-fg">This page does not exist.</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-fg-2">The link may be old or mistyped. The live market and the vote optimizer are one click away.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/market" className={`${ui.btnPrimary} px-6 py-3 text-base`}>
            Explore Boost Market
          </Link>
          <Link href="/" className={`${ui.btnSecondary} px-6 py-3 text-base`}>
            Go to the homepage
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

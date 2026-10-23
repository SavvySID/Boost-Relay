"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import type { NetworkName } from "@/lib/market-dto"
import { SiteFooter } from "./site/site-footer"
import { SiteHeader } from "./site/site-header"

/**
 * Layout for the working app pages (Boost Market, Vote Optimizer): the global site navigation,
 * then a page toolbar with the network selector, data freshness and refresh.
 */
export function AppShell(props: {
  readonly network: NetworkName
  readonly title: string
  readonly actions: ReactNode
  readonly children: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <SiteHeader app network={props.network} />
      <div className="border-b border-line">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb">
              <ol className="flex items-center gap-1.5 text-xs text-fg-3">
                <li>
                  <Link href="/" className="hover:text-fg">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-fg-2">
                  {props.title}
                </li>
              </ol>
            </nav>
            <h1 className="mt-0.5 text-xl font-medium tracking-tight text-fg">{props.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 md:ml-auto">{props.actions}</div>
        </div>
      </div>
      <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
        {props.children}
      </main>
      <SiteFooter />
    </div>
  )
}

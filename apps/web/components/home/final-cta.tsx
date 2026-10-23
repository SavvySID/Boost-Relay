import Link from "next/link"
import { BrandMark } from "../site/brand"

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="px-4 pb-16 sm:px-6 lg:pb-24">
      <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[28px] bg-fg px-6 py-14 text-white sm:px-12 lg:px-16 lg:py-20">
        <BrandMark tone="inverse" className="pointer-events-none absolute -bottom-16 -right-10 size-[22rem] opacity-[0.14] sm:size-[28rem]" />
        <div className="relative max-w-2xl">
          <h2 id="cta-title" className="text-[clamp(2rem,4.4vw,3.5rem)] font-medium leading-[1.04] tracking-[-0.03em]">
            Find the votes that move Bitcoin boosts.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75">
            Start with the live market, then turn a veMEZO NFT&apos;s voting power into an allocation you can check line by line.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/market" className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-base font-medium text-fg transition-colors hover:bg-fill">
              Explore Boost Market
            </Link>
            <Link
              href="/optimizer"
              className="inline-flex items-center justify-center rounded-full border border-white/35 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-white/10"
            >
              Build an allocation
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

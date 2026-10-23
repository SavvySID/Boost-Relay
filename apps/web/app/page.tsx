import type { Metadata } from "next"
import { Features } from "@/components/home/features"
import { FaqList } from "@/components/home/faq"
import { FinalCta } from "@/components/home/final-cta"
import { Hero } from "@/components/home/hero"
import { HowItWorks } from "@/components/home/how-it-works"
import { LiveMarketProvider } from "@/components/home/live-market"
import { MarketNow } from "@/components/home/market-now"
import { Principles } from "@/components/home/principles"
import { Problem } from "@/components/home/problem"
import { ProductPreview } from "@/components/home/product-preview"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"
import { FAQ } from "@/lib/faq"

export const metadata: Metadata = {
  title: { absolute: "Boost Relay: make every veMEZO vote count" },
}

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
}

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <SiteHeader />
      <main id="main" className="flex-1">
        <LiveMarketProvider>
          <Hero />
          <MarketNow />
          <Problem />
          <Features />
          <HowItWorks />
          <ProductPreview />
        </LiveMarketProvider>
        <Principles />
        <section id="faq" aria-labelledby="faq-title" className="bg-warm">
          <div className="mx-auto grid max-w-[1200px] grid-cols-[minmax(0,1fr)] gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] lg:gap-16 lg:py-24">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <h2 id="faq-title" className="text-[clamp(1.75rem,3.2vw,2.75rem)] font-medium leading-[1.08] tracking-[-0.025em] text-balance text-fg">
                Frequently asked questions
              </h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-fg-2">What Boost Relay does, what it never does, and where the numbers come from.</p>
            </div>
            <FaqList />
          </div>
        </section>
        <div className="pt-16 lg:pt-24">
          <FinalCta />
        </div>
      </main>
      <SiteFooter />
      {/* Structured data mirrors the visible FAQ text exactly (same source). */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }} />
    </div>
  )
}

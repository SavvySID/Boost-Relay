"use client"

import Link from "next/link"
import { ui } from "@/lib/ui"

/**
 * Last-resort boundary for unexpected rendering errors. It never shows the error message (which can
 * carry internal details); the digest lets server logs be matched to a report.
 */
export default function ErrorPage({ error, reset }: { readonly error: Error & { digest?: string }; readonly reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-[1200px] flex-col justify-center bg-page px-4 py-24 sm:px-6">
      <h1 className="text-[clamp(2rem,4.4vw,3rem)] font-medium leading-[1.05] tracking-[-0.03em] text-balance text-fg">Something went wrong on this page.</h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-fg-2">
        Nothing was signed or sent. Try again, or go back to the homepage.
        {error.digest ? <span className="mt-2 block text-xs text-fg-3">Reference: {error.digest}</span> : null}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={reset} className={`${ui.btnPrimary} px-6 py-3 text-base`}>
          Try again
        </button>
        <Link href="/" className={`${ui.btnSecondary} px-6 py-3 text-base`}>
          Go to the homepage
        </Link>
      </div>
    </main>
  )
}

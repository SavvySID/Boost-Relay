"use client"

import { useState } from "react"
import { FAQ } from "@/lib/faq"

/** Accordion of real buttons: Enter and Space toggle, aria-expanded reflects state, several may stay open. */
export function FaqList() {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="border-t border-line-strong">
      {FAQ.map((item) => {
        const expanded = open.has(item.id)
        return (
          <div key={item.id} className="border-b border-line-strong">
            <h3>
              <button
                type="button"
                id={`faq-q-${item.id}`}
                aria-expanded={expanded}
                aria-controls={`faq-a-${item.id}`}
                onClick={() => toggle(item.id)}
                className="flex w-full items-center justify-between gap-6 py-5 text-left text-base font-medium text-fg"
              >
                {item.question}
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-line-strong bg-surface">
                  <svg viewBox="0 0 16 16" className={`size-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
                    <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
            </h3>
            <div id={`faq-a-${item.id}`} role="region" aria-labelledby={`faq-q-${item.id}`} hidden={!expanded}>
              <p className="max-w-[62ch] pb-6 pr-12 text-sm leading-relaxed text-fg-2">{item.answer}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

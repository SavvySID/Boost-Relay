import type { Metadata, Viewport } from "next"
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google"
import type { ReactNode } from "react"
import "./globals.css"

const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap" })
const plexCondensed = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-plex-condensed",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Boost Market | Boost Relay",
  description: "More effective votes. Better Bitcoin boosts. Read-only veMEZO boost analytics for Mezo.",
}

export const viewport: Viewport = {
  themeColor: "#14181f",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" className={`${plex.variable} ${plexCondensed.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}

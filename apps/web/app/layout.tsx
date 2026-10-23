import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter_Tight } from "next/font/google"
import type { ReactNode } from "react"
import { WalletProvider } from "@/components/wallet/wallet-provider"
import { SITE_DESCRIPTION } from "@/lib/site"
import "./globals.css"

// Open-licensed stand-ins for Mezo's commercial Riforma LL (UI) and Riforma Mono (code) typefaces.
const ui = Inter_Tight({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-ui", display: "swap" })
const code = Geist_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-code", display: "swap" })

export const metadata: Metadata = {
  title: { default: "Boost Relay: make every veMEZO vote count", template: "%s | Boost Relay" },
  description: SITE_DESCRIPTION,
  applicationName: "Boost Relay",
  openGraph: { type: "website", siteName: "Boost Relay", title: "Boost Relay: make every veMEZO vote count", description: SITE_DESCRIPTION },
  twitter: { card: "summary", title: "Boost Relay: make every veMEZO vote count", description: SITE_DESCRIPTION },
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${code.variable}`}>
      <body className="min-h-dvh">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  )
}

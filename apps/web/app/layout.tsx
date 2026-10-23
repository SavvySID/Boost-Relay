import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter_Tight } from "next/font/google"
import type { ReactNode } from "react"
import { WalletProvider } from "@/components/wallet/wallet-provider"
import "./globals.css"

// Open-licensed stand-ins for Mezo's commercial Riforma LL (UI) and Riforma Mono (code) typefaces.
const ui = Inter_Tight({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-ui", display: "swap" })
const code = Geist_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-code", display: "swap" })

export const metadata: Metadata = {
  title: "Boost Relay",
  description: "More effective votes. Better Bitcoin boosts. veMEZO boost analytics, vote recommendations and owner-signed testnet voting for Mezo.",
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

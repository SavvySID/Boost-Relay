import path from "node:path"
import type { NextConfig } from "next"

const isDev = process.env.NODE_ENV === "development"

/**
 * Content Security Policy. Pages are prerendered, so per-request nonces are not available; inline
 * scripts (Next.js's own bootstrap) are allowed, everything else is same-origin only. The browser only
 * ever talks to this server (connect-src 'self'); wallet extensions run in their own context.
 * frame-ancestors 'none' keeps the signing UI from being framed (clickjacking).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Only honoured over HTTPS, so it is inert in local development.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
]

const nextConfig: NextConfig = {
  // npm workspaces hoist dependencies to the repository root.
  turbopack: { root: path.join(process.cwd(), "..", "..") },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
  async redirects() {
    // The Boost Market used to live at "/". Old links such as /?network=testnet keep working.
    return [{ source: "/", has: [{ type: "query", key: "network" }], destination: "/market", permanent: false }]
  },
}

export default nextConfig

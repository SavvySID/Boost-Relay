import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // npm workspaces hoist dependencies to the repository root.
  turbopack: { root: path.join(process.cwd(), "..", "..") },
  poweredByHeader: false,
  async redirects() {
    // The Boost Market used to live at "/". Old links such as /?network=testnet keep working.
    return [{ source: "/", has: [{ type: "query", key: "network" }], destination: "/market", permanent: false }]
  },
}

export default nextConfig

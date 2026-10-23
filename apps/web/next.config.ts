import path from "node:path"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // npm workspaces hoist dependencies to the repository root.
  turbopack: { root: path.join(process.cwd(), "..", "..") },
  poweredByHeader: false,
}

export default nextConfig

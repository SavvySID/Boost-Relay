import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const src = (p: string): string => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    // Web tests run against the package source, so they never depend on a stale dist build.
    alias: [
      { find: /^@boost-relay\/mezo\/formatting$/, replacement: src("./packages/mezo/src/formatting.ts") },
      { find: /^@boost-relay\/mezo$/, replacement: src("./packages/mezo/src/index.ts") },
      { find: /^@\/(.*)$/, replacement: src("./apps/web/$1") },
    ],
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    // Unit tests must never touch the network; RPC checks live in scripts/ (npm run verify:*).
    environment: "node",
  },
})

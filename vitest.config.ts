import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    // Unit tests must never touch the network; RPC checks live in scripts/ (npm run verify:*).
    environment: "node",
  },
})

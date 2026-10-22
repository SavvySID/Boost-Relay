// Read-only: checks chain ids, address format, deployed code, contract cross-references,
// proxy implementations, Multicall3 and a live bribe contract. Sends no transactions.
// Usage: npm run verify:addresses [-- mainnet|testnet ...]

import { NETWORKS, assertNetworkName, verifyDeployment, type NetworkName } from "../packages/mezo/src/index.js"

const requested = process.argv.slice(2)
const networks: readonly NetworkName[] = requested.length > 0 ? requested.map(assertNetworkName) : NETWORKS

let failed = false
for (const network of networks) {
  const result = await verifyDeployment(network, { env: process.env })
  console.log(`\n=== ${network} ===`)
  console.log(`rpc:      ${result.rpcUrl}`)
  console.log(`chain id: expected ${result.expectedChainId}, observed ${result.observedChainId ?? "unavailable"}`)
  console.log(`block:    ${result.blockNumber ?? "n/a"}`)
  for (const check of result.checks) {
    const tag = check.status === "pass" ? "PASS" : check.status === "warn" ? "WARN" : "FAIL"
    const detail = [
      check.expected !== undefined ? `expected ${check.expected}` : null,
      check.observed !== undefined ? `observed ${check.observed}` : null,
    ]
      .filter(Boolean)
      .join(", ")
    console.log(`  [${tag}] ${check.name}${detail ? ` (${detail})` : ""}`)
  }
  const counts = { pass: 0, warn: 0, fail: 0 }
  for (const check of result.checks) counts[check.status]++
  console.log(`  -> ${counts.pass} passed, ${counts.warn} warnings, ${counts.fail} failed`)
  if (!result.ok) failed = true
}
if (failed) process.exitCode = 1

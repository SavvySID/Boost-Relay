// Read-only readiness check for the Mezo Testnet vote flow. It uses eth_chainId, eth_getCode, view
// calls and eth_call simulations only: nothing is signed, sent or broadcast, and no key is needed.
// A passing eth_call shows the call would succeed at that block; it is not a real transaction.
//
// Usage: npm run verify:vote -- --token <veMEZO id> [--strategy max-boosted-power|max-capped-positions]

import { createPublicClient, http, type Address, type PublicClient } from "viem"
import {
  CHAINS,
  NETWORKS,
  boostVoterAbi,
  createMezoReader,
  formatBoost,
  formatTokenAmount,
  getDeployment,
  getEpochInfo,
  resolveRpcUrl,
  type MarketSnapshot,
} from "../packages/mezo/src/index.js"
import { recommend, type OptimizerToken } from "../packages/optimizer/src/index.js"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const tokenArg = arg("token")
if (tokenArg === undefined || !/^[1-9]\d{0,29}$/.test(tokenArg)) {
  console.error("Usage: npm run verify:vote -- --token <veMEZO id> [--strategy max-boosted-power|max-capped-positions]")
  process.exit(2)
}
const tokenId = BigInt(tokenArg)
const strategy = arg("strategy") === "max-capped-positions" ? "max-capped-positions" : "max-boosted-power"
/** A well-known address that owns no veMEZO: used to prove non-owners are refused. */
const NON_OWNER: Address = "0x000000000000000000000000000000000000dEaD"

let failures = 0
const report = (ok: boolean, label: string, detail = "") => {
  if (!ok) failures++
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`)
}
const info = (label: string, detail: string) => console.log(`INFO ${label}: ${detail}`)

function client(network: "mainnet" | "testnet"): PublicClient {
  return createPublicClient({ chain: CHAINS[network], transport: http(resolveRpcUrl(network, { env: process.env }), { timeout: 30_000, retryCount: 1 }) }) as PublicClient
}

// 1. Both networks: chain id and deployed code.
for (const network of NETWORKS) {
  const c = client(network)
  const d = getDeployment(network)
  const chainId = await c.getChainId()
  report(chainId === d.chainId, `${network} RPC chain id`, `${chainId} (expected ${d.chainId})`)
  for (const [name, address] of [
    ["BoostVoter", d.contracts.boostVoter],
    ["veMEZO", d.contracts.veMezo],
    ["veBTC", d.contracts.veBtc],
  ] as const) {
    const code = await c.getCode({ address })
    report(code !== undefined && code.length > 2, `${network} ${name} has code`, address)
  }
}

// 2. Testnet snapshot, token state and recommendation at one block.
const testnet = client("testnet")
const deployment = getDeployment("testnet")
const reader = createMezoReader({ network: "testnet", env: process.env })
const started = Date.now()
const { snapshot } = await reader.readMarketSnapshot({ includeOnchainBoost: true, includeIncentives: true })
const block = snapshot.meta.blockNumber
const age = BigInt(Math.floor(Date.now() / 1000)) - snapshot.meta.blockTimestamp
info("testnet snapshot", `block ${block}, ${snapshot.positions.length} positions, read in ${((Date.now() - started) / 1000).toFixed(1)} s`)
report(snapshot.meta.completeness === "complete", "snapshot complete", `${snapshot.meta.failures.length} failed reads`)
report(age >= 0n && age < 180n, "snapshot fresh", `block is ${age} s old`)

const [position, allocation] = await Promise.all([reader.readVeMezoPosition(tokenId, block), reader.readVeMezoVoteAllocation(tokenId, block)])
const [usedWeights, lastVoted] = await Promise.all([
  testnet.readContract({ address: deployment.contracts.boostVoter, abi: boostVoterAbi, functionName: "usedWeights", args: [tokenId], blockNumber: block }),
  testnet.readContract({ address: deployment.contracts.boostVoter, abi: boostVoterAbi, functionName: "lastVoted", args: [tokenId], blockNumber: block }),
])
info(`veMEZO #${tokenId}`, `owner ${position.owner}, power ${formatTokenAmount(position.votingPower, 18, 4)}, lastVoted ${position.lastVoted}, usedWeights ${usedWeights}`)
report(position.lastVoted === lastVoted, "reader lastVoted equals BoostVoter.lastVoted", String(lastVoted))
report(allocation.usedWeight === usedWeights && allocation.complete, "existing allocation fully read", `${allocation.entries.length} gauges, sum equals usedWeights`)
const epoch = getEpochInfo(snapshot.meta.blockTimestamp)
info("epoch", `phase ${epoch.phase}, voting closes ${new Date(Number(epoch.voteEnd) * 1000).toISOString()}`)
info("vote status", position.canVoteThisEpoch ? "can vote this epoch (unvoted)" : "cannot vote this epoch (already voted or outside the window)")

const token: OptimizerToken = {
  tokenId,
  owner: position.owner,
  votingPower: position.votingPower,
  lastVoted: position.lastVoted,
  votedAnywhere: position.votedAnywhere,
  lockEnd: position.lock.end,
  isPermanent: position.lock.isPermanent,
  allocation,
  blockNumber: position.blockNumber,
}
const context = { network: "testnet" as const, chainId: deployment.chainId, boostVoter: deployment.contracts.boostVoter }
const rec = recommend({ snapshot, token, strategy, context })
info("recommendation", `${strategy}: status ${rec.status}, ${rec.lines.length} gauges`)
report(rec.checks.length > 0 && rec.checks.every((c) => c.ok), "allocation checks pass", rec.checks.filter((c) => !c.ok).map((c) => c.name).join("; ") || `${rec.checks.length} checks`)
const weightSum = (rec.voteCall?.weights ?? []).reduce((s, w) => s + w, 0n)
report(rec.voteCall !== null && weightSum === position.votingPower, "weights sum to the NFT's voting power at the block", `${weightSum}`)
const byGauge = new Map(snapshot.positions.map((p) => [p.gauge.toLowerCase(), p]))
const boostsMatch = rec.lines.every((l) => {
  const p = byGauge.get(l.gauge.toLowerCase())
  return p !== undefined && p.onchainBoost !== null && p.onchainBoost === l.currentBoost
})
report(boostsMatch, "each chosen gauge's current boost equals on-chain getBoost", rec.lines.map((l) => `#${l.tokenId} ${formatBoost(l.currentBoost)}`).join(", "))

// The optimizer must not depend on optional incentive data.
const withoutIncentives: MarketSnapshot = { ...snapshot, positions: snapshot.positions.map((p) => ({ ...p, incentives: null }) as unknown as typeof p) }
const rec2 = recommend({ snapshot: withoutIncentives, token, strategy, context })
report(JSON.stringify(rec2.voteCall, (_, v) => (typeof v === "bigint" ? v.toString() : v)) === JSON.stringify(rec.voteCall, (_, v) => (typeof v === "bigint" ? v.toString() : v)), "recommendation is unchanged without incentive data")

// 3. eth_call simulations (read-only).
if (rec.voteCall !== null) {
  const args = [tokenId, [...rec.voteCall.gauges], [...rec.voteCall.weights]] as const
  const latest = await testnet.getBlockNumber()
  try {
    await testnet.simulateContract({ address: deployment.contracts.boostVoter, abi: boostVoterAbi, functionName: "vote", args, account: position.owner, blockNumber: latest })
    report(position.canVoteThisEpoch, "eth_call as the owner succeeds", `block ${latest}; eth_call only, nothing sent`)
  } catch (error) {
    const name = (error as { walk?: (fn: (e: unknown) => boolean) => unknown }).walk?.((e) => (e as { data?: { errorName?: string } })?.data?.errorName !== undefined) as { data?: { errorName?: string } } | undefined
    report(!position.canVoteThisEpoch, "eth_call as the owner", `reverted (${name?.data?.errorName ?? "unknown"})${position.canVoteThisEpoch ? " although the NFT can vote" : ", expected: it cannot vote now"}`)
  }
  try {
    await testnet.simulateContract({ address: deployment.contracts.boostVoter, abi: boostVoterAbi, functionName: "vote", args, account: NON_OWNER, blockNumber: latest })
    report(false, "eth_call as a non-owner reverts", "it did not revert")
  } catch (error) {
    const name = (error as { walk?: (fn: (e: unknown) => boolean) => unknown }).walk?.((e) => (e as { data?: { errorName?: string } })?.data?.errorName !== undefined) as { data?: { errorName?: string } } | undefined
    report(name?.data?.errorName === "NotApprovedOrOwner" || !position.canVoteThisEpoch, "eth_call as a non-owner reverts", name?.data?.errorName ?? "reverted")
  }
} else {
  info("simulation", "skipped: no vote call could be built for this NFT")
}

console.log(`\n${failures === 0 ? "All checks passed" : `${failures} check(s) failed`}. Read-only: no transaction was signed or sent.`)
process.exit(failures === 0 ? 0 : 1)

# Boost Relay

Non-custodial analytics for Mezo Earn's boost market: which veBTC positions are over-boosted, under-boosted or unboosted, and the exact veMEZO vote weight each one needs to reach 2x, 3x or 5x.

This repository currently contains the **data and math foundation** (`@boost-relay/mezo`). The dashboard and the vote optimizer come next and will use this package's API.

## Safety model

- **Read-only.** Nothing in this repo signs, sends or broadcasts a transaction, and nothing needs a private key.
- Future votes will be **signed by the user's own wallet** against Mezo's official `BoostVoter`. This package never submits them.
- No custody of NFTs or tokens; no vault, receipt token or keeper.

## Layout

```
packages/mezo/
  src/config/chains.ts      Mezo mainnet (31612) / testnet (31611), RPC resolution, no silent fallback
  src/config/addresses.ts   Verified contract addresses by role, with provenance
  src/abis/                 ABIs generated from Blockscout-verified sources (+ hand-written bribe ABI)
  src/boost.ts              Exact BoostVoter._getBoost mirror, minimum-weight math, analysis, summary
  src/epoch.ts              ProtocolTimeLibrary mirror and vote-window rules
  src/executor.ts           Multicall3 aggregate3 batching: pinned block, chunking, split-on-failure
  src/reader.ts             Typed snapshots: global state, positions, incentives, veMEZO positions
  src/cache.ts              Provably safe tokenId->gauge mapping cache (+ JSON serialization)
  src/verification.ts       On-chain deployment checks used by verify:addresses
  src/formatting.ts         bigint-only display helpers
  test/                     Offline unit tests + a real mainnet fixture
scripts/
  verify-addresses.ts       Read-only deployment verification for both networks
  verify-boost.ts           Pinned-block comparison of local math vs on-chain getBoost()
```

## Commands

```bash
npm install
npm test                    # offline unit tests (no network)
npm run typecheck
npm run build               # emits packages/mezo/dist
npm run verify:addresses    # read-only RPC checks, both networks (or: -- mainnet)
npm run verify:boost -- --network mainnet [--block 12694524] [--fixture path] [--no-incentives]
```

Optional RPC overrides go in `.env` (see `.env.example`): `MEZO_MAINNET_RPC_URL`, `MEZO_TESTNET_RPC_URL`.

## Using the data layer

```ts
import { createMezoReader, formatBoost, formatRatioPercent } from "@boost-relay/mezo"

const reader = createMezoReader({ network: "mainnet" })
const { snapshot, cache } = await reader.readMarketSnapshot() // pinned to one block

if (snapshot.meta.completeness !== "complete") {
  // Show as partial; never present it as the whole market.
}
for (const p of snapshot.positions) {
  console.log(p.tokenId, p.status, formatBoost(p.analysis.liveBoost), p.analysis.targets["5x"])
}
console.log(formatRatioPercent(snapshot.summary.excessShareOfLive))

// Next refresh: reuses the gauge mapping while BoostVoter.length() is unchanged.
await reader.readMarketSnapshot(cache ? { cache } : {})
```

## The boost formula

From the verified `BoostVoter._getBoost` (identical on testnet and mainnet), with 1e18 precision and truncating division:

```
vR    = Tm > 0 ? W * 1e18 / Tm : 0            W  = BoostVoter.weights(gauge)
bR    = p  > 0 ? Tb * 1e18 / p : 0            Tm = veMEZO.totalVotingPower()
boost = min(5e18, 1e18 + 4 * bR * vR / 1e18)  Tb = veBTC.unboostedTotalVotingPower()
                                              p  = veBTC.unboostedVotingPowerOfNFT(id)
```

Minimum weight for a target `b`: `vRneed = ceil((b − 1e18)·1e18 / (4·bR))`, then `W = ceil(vRneed·Tm / 1e18)`. This is exact under the contract's flooring.

## Verification status (read-only, reproduced by `npm run verify:*`)

| Check | Result |
|---|---|
| `verify:addresses` mainnet | 71/71 pass (chain id, checksums, code, cross-references, implementations, Multicall3, bribe selectors) |
| `verify:addresses` testnet | 71/71 pass |
| Mainnet block 12,694,524: local boost vs `getBoost()` | 294/294 exact; minimum-weight self-check 495/495 |
| Same block: veMEZO weight above the 5x requirement on live positions | 17,506,532 of 59,533,214 (29.406%) |
| Testnet block 16,307,502: local boost vs `getBoost()` | 519/519 exact; self-check 381/381 |

"Above the 5x requirement" means weight that adds no boost to its target at that block. Voters may still earn incentives or off-chain rewards for it.

## Known limitations

- Incentive amounts are what has been **posted** for the current epoch (`tokenRewardsPerEpoch`), not what anyone will earn.
- Rewards paid through Mezo's off-chain "Academy" program are not visible on-chain and are not included.
- Mezo can upgrade its proxies; `verify:addresses` warns if an implementation slot changes.
- Public RPCs: `eth_getLogs` is capped at 10,000 blocks, so the reader scans state rather than events. Heavy views (`getBoost`) use small chunks.

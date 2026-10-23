# Boost Relay

Non-custodial analytics for Mezo Earn's boost market: which veBTC positions are over-boosted, under-boosted or unboosted, and the exact veMEZO vote weight each one needs to reach 2x, 3x or 5x.

This repository contains:

- **`@boost-relay/mezo`**: the read-only data layer and exact boost math.
- **`@boost-relay/optimizer`**: a pure, deterministic vote-allocation optimizer that mirrors `BoostVoter.vote()`.
- **`apps/web`**: the **Boost Market** dashboard (`/`) and the **Vote Optimizer** (`/optimizer`), built with Next.js on both packages. On Mezo Testnet the optimizer can hand a recommendation to the NFT owner's own wallet to sign (testnet beta).

Mainnet is read-only.

## Vote Optimizer

Enter a veMEZO token id at `/optimizer?network=testnet`. The server then:

1. Reads, at the same block as the market snapshot, the NFT's voting power, lock, `lastVoted`, and every existing BoostVoter vote. It proves the allocation is complete by checking that `sum(votes) == usedWeights`.
2. Runs two strategies (both deterministic, with ties broken by the lower veBTC id):
   - **Maximize boost improvement.** Fills the largest gaps to 5x first. This is optimal for the gain in boosted veBTC power (unboosted power x boost) under the gauge limit, up to rounding.
   - **Maximize positions at 5x.** Fills the cheapest gaps first. This is optimal for the count of positions reaching 5x.
3. Mirrors `vote()` exactly:
   - weights are relative;
   - each gauge gets `floor(weight x power / sum)`;
   - the NFT's prior votes are removed first;
   - at most `maxVotingNum` gauges, with no duplicates.
4. Validates the result and returns a proposed `vote()` call, encoded with the verified ABI. Nothing is sent from here; see the next section.

A partial snapshot, an unreadable allocation, or zero power blocks the recommendation. An NFT that already voted this epoch, or is outside the voting window, gets an informational result only.

## Voting with your wallet (Mezo Testnet beta)

Below a recommendation, **Vote with your wallet** lets the NFT's owner cast it on Mezo Testnet. It works in two stages, and only the owner can vote: there are no delegated operators or approvals.

**Wallet connection.** The app talks to injected browser wallets directly over EIP-1193. It discovers them with EIP-6963 and falls back to `window.ethereum`. There is no WalletConnect and no wallet SDK.

- The page never prompts the wallet on load. It connects only when you click Connect.
- Account and chain changes are followed live.
- If the wallet is on another chain, the app shows a notice. It switches only when you click **Switch wallet to Mezo Testnet**. The switch adds the chain from the verified config if the wallet doesn't know it, then re-reads the chain id.

**Stage A: Prepare & simulate** (`GET /api/vote/prepare`). The server:

- reads a fresh snapshot, and the NFT's power, lock and existing votes at that block;
- recomputes the chosen strategy;
- checks 12 gates: testnet, the NFT exists, the connected account is the owner, power > 0, not voted this epoch, inside the vote window with a 5-minute margin, snapshot complete and under 3 minutes old, existing votes fully read, actionable plan, plan checks pass, weights sum to power;
- simulates `vote()` with `eth_call` **from the connected account** at the latest block.

Nothing is signed. The review then shows the exact call: chain, from, BoostVoter, method, token, every gauge and weight, and the votes it replaces. The calldata is shown on request. A prepared vote expires after 2 minutes, and it is invalidated if the account or chain changes or the window closes.

**Stage B: Sign & Submit Vote.** This is enabled only after you tick the acknowledgement. The click:

1. Re-reads the wallet without prompting.
2. Re-encodes the calldata in the browser and checks it matches.
3. Re-simulates on the server (`POST /api/vote/simulate`).
4. Sends one `eth_sendTransaction` to the wallet.
5. Waits for the real receipt (`GET /api/vote/receipt`).

It never treats wallet approval as success and never resubmits. Each outcome has its own state: rejected, simulation failed, pending, reverted, confirmed, receipt unknown, and refresh failed.

After a confirmed vote the optimizer re-reads the chain. Live boost reflects the vote at once. The boost applied to each veBTC changes only after someone calls the permissionless `pokeBoost`, and Boost Relay never pokes.

On mainnet the panel shows "Voting is disabled", and the prepare API returns 403.

## Design

The visual system follows the public Mezo testnet app: white surfaces, `#E8E8E8` lines and fills, black pill actions, segmented controls, 8/12/16px radii, and Mezo red `#FF004D` as a sparing accent. Tokens live in `apps/web/app/globals.css` and component recipes in `apps/web/lib/ui.ts`.

Mezo's typefaces (Riforma LL, GT Alpina) are commercially licensed, so Inter Tight and Geist Mono stand in for them. Boost Relay is an independent project, not affiliated with or endorsed by Mezo.

## Run the dashboard

```bash
npm install
npm run dev          # builds @boost-relay/mezo, then starts http://localhost:3000
# or, production:
npm run build && npm start
```

The browser calls `GET /api/market?network=mainnet|testnet` (add `&refresh=1` to re-read). The server reads one pinned-block snapshot with `@boost-relay/mezo` and returns it as JSON, with every bigint as a decimal string. Behavior:

- **Cache:** a snapshot is re-served for 60 s with its original block and time. A forced refresh re-reads at most once every 15 s per network.
- **No overlap:** concurrent requests share one in-flight read.
- **Mapping cache:** the veBTC gauge mapping is reused while `BoostVoter.length()` is unchanged.
- **No mixing:** switching networks aborts the previous request and clears its data.

A cold mainnet read takes about 8 to 15 s on the public RPC.

## Safety model

- **The server never signs.** It only reads chain state and runs `eth_call` simulations. There are no keys, no `eth_sendRawTransaction` and no write clients.
- **Only the owner's wallet sends.** Votes are signed by the NFT owner's own wallet against Mezo's official `BoostVoter`, on testnet only, after an explicit click. Boost Relay never asks for a seed phrase or private key.
- **No automatic transactions.** No retries or resubmission, and no `poke` or `pokeBoost`.
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
npm test                    # offline unit tests (no network): packages + web, wallet flow with mocked providers
npm run typecheck           # package, scripts and the web app (strict)
npm run build               # packages/mezo/dist, then the Next.js production build
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
- Voting is a testnet beta for injected browser wallets only. There is no WalletConnect or mobile deep link, and no delegated operators.
- A passing simulation is not a guarantee: weights and power can change before the transaction is included.

# Boost Relay: Mezo Buildathon submission report

**Boost vote optimizer for Mezo.** Boost Relay shows where veBTC boosts are underpowered and where veMEZO votes sit past the 5x cap, then builds a better `BoostVoter.vote()` allocation that the NFT's owner reviews, simulates and signs with their own wallet.

- **Live site:** https://boost-relay.vercel.app
- **Boost Market:** https://boost-relay.vercel.app/market (add `?network=testnet` for testnet)
- **Vote Optimizer, no wallet needed:** https://boost-relay.vercel.app/optimizer?token=91&example=1 (a real public mainnet veMEZO NFT, read-only)
- **Code:** https://github.com/SavvySID/Boost-Relay
- **Track fit:** Access & Distribution for MEZO: a tool that makes MEZO's core utility (veMEZO voting and the veBTC boost it drives) easier to use well.

## 1. The problem

On Mezo, veMEZO holders vote on veBTC boost gauges. A position's boost grows with the votes on its gauge, up to a hard 5x cap. Past the cap, more votes add no boost to that position, while other active positions stay under-boosted or get no votes at all. The exact votes a position needs change every block as voting power decays and other voters act, so allocating by hand is guesswork.

Measured read-only by `npm run verify:boost` on Mezo Mainnet at block 12,786,939 (2026-10-26 20:48 UTC): 13,836,651 veMEZO, **23.27% of all weight on active positions, sat above what those positions need for 5x**. The live site recomputes this at every snapshot.

Votes past the cap can still earn incentives or other rewards, so this measures boost efficiency, not lost income.

## 2. What works today (shipped)

| Feature | Where | Status |
|---|---|---|
| **Boost Market:** every veBTC boost position read at one block, with live vs applied boost, votes, exact extra veMEZO needed for 5x, posted incentives, freshness and partial-data labels | `/market` | Mainnet and Testnet, read-only |
| **"Where a vote helps" views:** closest to 5x, lowest boost, needs the most votes, posted incentives | `/market` | Mainnet and Testnet |
| **Vote Optimizer:** two strategies (most boosted-power gain, most positions at 5x) that mirror `vote()` exactly (relative weights, integer rounding, the gauge limit, existing votes replaced) | `/optimizer` | Mainnet and Testnet |
| **Projected outcome:** before/after boosted power, positions at 5x (touched and market-wide), each gauge's share, power used vs left over, both strategies side by side, per-gauge "why" | `/optimizer` | Projections, labelled as such |
| **Try an example:** three verified public mainnet NFTs (#91, #100, #139) so anyone can see a full recommendation without a wallet | `/optimizer` | Read-only |
| **Best time to vote:** the voting-window close from the on-chain epoch schedule, with guidance | `/optimizer` | Both networks |
| **Owner-signed voting:** prepare and simulate as your account, then review the exact call, estimated fee and acknowledgement, then sign in your own wallet, then a real receipt checked against the reviewed call, then the recorded vote re-read from BoostVoter | `/optimizer?network=testnet` | **Testnet only**; mainnet voting is disabled on the server |
| **Website:** homepage with live market data, FAQ, Vault Relay research page | `/`, `/vault` | Live |

Boost Relay deploys **no smart contract of its own, by design**. Your wallet calls Mezo's own `BoostVoter.vote()` directly, so Boost Relay never holds NFTs, MEZO, BTC or MUSD.

## 3. Mezo integration

| Contract | Mezo Testnet (31611) | Mezo Mainnet (31612) | Used for |
|---|---|---|---|
| BoostVoter | [`0x21d7…6Bfd1`](https://explorer.test.mezo.org/address/0x21d7bDF5a5929AD179F8cA0c9014A0B62ae6Bfd1) | [`0x2Ba6…13d1`](https://explorer.mezo.org/address/0x2Ba614a598Cffa5a19d683cDCA97bac3a49313d1) | gauge weights, `getBoost`, existing votes, `vote()` |
| veMEZO | [`0xaCE8…111b`](https://explorer.test.mezo.org/address/0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b) | [`0xb90f…0122`](https://explorer.mezo.org/address/0xb90fdAd3DFD180458D62Cc6acedc983D78E20122) | voting power, owner, lock |
| veBTC | [`0x38E3…130a`](https://explorer.test.mezo.org/address/0x38E35d92E6Bfc6787272A62345856B13eA12130a) | [`0x3D4b…f279`](https://explorer.mezo.org/address/0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279) | positions, unboosted power, applied boost |
| Gauges and incentive (bribe) contracts | discovered on-chain | discovered on-chain | gauge liveness, posted incentives |
| Multicall3 | `0xca11…ca11` | `0xca11…ca11` | batched reads at one pinned block |

Addresses are taken from the verified sources on Mezo's explorers and re-checked on-chain by `npm run verify:addresses` and `npm run verify:vote`.

## 4. Architecture

```
Browser (Next.js pages)
  │  same-origin API only; strict CSP, no direct RPC from the page
  ▼
API routes (Next.js on Vercel)          @boost-relay/optimizer (pure, deterministic)
  /api/market   snapshot at one block ──► strategies that mirror BoostVoter.vote()
  /api/optimize recommendation           @boost-relay/mezo (read-only data layer)
  /api/vote/prepare  gates + eth_call ──► exact BoostVoter._getBoost math, Multicall3
  /api/vote/simulate re-check + eth_call   reads at a pinned block, public Mezo RPCs
  /api/vote/receipt  receipt + tx check
  │
Wallet (injected, EIP-6963) ── signs vote() directly to Mezo's BoostVoter (testnet only)
```

The server has no wallet client, keys or signing code; a unit test enforces this. Every vote is signed in the owner's own browser wallet.

## 5. Evidence

### A real vote signed with an installed wallet (Mezo Testnet)

- **Transaction:** [`0xaf10ea12…1911b`](https://explorer.test.mezo.org/tx/0xaf10ea12eda1afc7be212b388e2166560c0b96c37254ec365f6a97af31e1911b), block 16,383,013, 2026-10-26 14:51:20 UTC, status **success**.
- **Decoded call:** `BoostVoter.vote(924, [0xF7b0…E3F3], [89.7145… veMEZO])`. That is a single gauge, the one for veBTC #503, which is Boost Relay's "Maximize boost improvement" plan for veMEZO #924.
- **Re-read from BoostVoter afterwards:**
  - `lastVoted(924)` equals the block's timestamp;
  - `votes(924, gauge)` = 89.714486 veMEZO = `usedWeights(924)`;
  - there is one gauge entry, and value and chain id are 0 and 31611.

### Boost math equals the contract

`npm run verify:boost`, read-only, on 2026-10-26:

| Network | Block | Local formula = on-chain `getBoost` | Minimum-weight self-check (2x/3x/5x) |
|---|---|---|---|
| Mainnet | 12,786,939 | 293 / 293 | 501 ok, 0 bad |
| Testnet | 16,388,163 | 530 / 530 | 414 ok, 0 bad |

Pinned fixtures from both networks (`packages/mezo/test/fixtures/`) keep this parity in the unit tests. They cover capped, partial, unvoted and zero-power positions, and check that one wei less than the computed 5x minimum falls short.

### Tests (2026-10-26, this version)

- **Unit and integration (offline, `npm test`):** 183 tests in 15 files. They cover:
  - boost math and contract parity;
  - optimizer strategies and the before/after comparison;
  - API input validation, rate limits and error sanitising;
  - the wallet flow with mocked wallets: rejections, reverts, a wrong transaction behind a hash, unknown receipts, double clicks;
  - the post-vote check, which never claims success from a receipt alone.
- **TypeScript strict typecheck and production build:** pass.
- **Browser suites, headless Edge, mock wallets only, run against a local production build: 153 checks.**

  | Suite | Checks |
  |---|---|
  | Vote flow | 49 |
  | Site | 55 |
  | Market | 26 |
  | Optimizer | 23 |

  They cover 320 to 1440 px layouts, no wallet prompt on load, CSP with zero violations, and same-origin requests only. No suite signs or sends anything.
- **Read-only readiness check (`npm run verify:vote -- --token <id>`):** checks chain ids and contract code on both networks, a fresh snapshot, the token's state against direct contract reads, and `eth_call` as the owner and as a non-owner.

## 6. Business model (planned, nothing is charged today)

- **Free:** the Boost Market and the Vote Optimizer stay free. That's the funnel.
- **Paid boost alerts for veBTC holders:** "your boost dropped below 5x; you need X more veMEZO to get back".
- **Later:** if Vault Relay ships, a small fee on the rewards it compounds.

## 7. Known limitations (honest)

- **Voting:** submitting votes is a Mezo Testnet beta; mainnet is analytics only.
- **Wallets:** injected browser wallets only. There's no WalletConnect, mobile deep link or delegated voting.
- **Rate limits** live in each server instance (in memory), so they are best-effort across instances. A Vercel firewall rule is the planned cross-instance limit.
- **Simulation is not a guarantee:** the chain can change between the final simulation and inclusion; the app then reports the revert.
- **Testnet RPC flakiness:** the public Mezo Testnet RPC is load-balanced, and in a sample some nodes answered "not found" for an already-mined transaction (about 15–20% of lookups). Receipt lookups retry, and an unknown receipt is shown as unknown, never as success.
- **No historical charts:** reliable history would need an indexer, and the public RPC caps log queries. Every number is a single-block snapshot with its block and age shown.
- **Vault Relay is research only.** Pooled voting needs a MANAGED veNFT, which the Mezo team must grant.

## 8. Next (Wave 2, not part of this submission)

- MUSD (and MEZO/BTC) incentive posting for veBTC holders.
- An incentive-aware optimizer strategy.
- A small pass-through incentive router contract.
- Boost alerts.
- Vault Relay, if the Mezo team grants a managed veNFT.

## 9. Verify it yourself

```bash
npm ci
npm test && npm run typecheck && npm run build
npm run verify:boost -- --network mainnet --no-incentives   # local math vs on-chain getBoost, read-only
npm run verify:vote -- --token <veMEZO id>                  # read-only readiness check, eth_call only
npm run dev                                                 # http://localhost:3000
```

import type { Address } from "viem"
import type { NetworkName } from "./chains.js"

/**
 * Contract roles Boost Relay touches.
 *
 * Boost path (what this project is about):
 *   veMEZO NFT --vote--> BoostVoter --boost gauge per veBTC--> veBTC NFT (the boost target)
 *
 * Not the boost path (listed so they are never confused with it):
 *   - poolsVoter: veBTC's own voter for DEX pool gauges / MEZO emissions.
 *   - thirdPartyVoter: a secondary veMEZO voter for third-party gauges. A veMEZO with votes there
 *     also has `voted == true` on the escrow, which matters for merges/withdrawals.
 */
export interface MezoContracts {
  /** BoostVoter proxy: veMEZO holders vote here; it is veBTC's `booster`. */
  readonly boostVoter: Address
  /** veMEZO VotingEscrow proxy (ERC-721, splits disabled). `voter()` == boostVoter. */
  readonly veMezo: Address
  /** veBTC VotingEscrow proxy (ERC-721). Boost targets. `booster()` == boostVoter. */
  readonly veBtc: Address
  /** veBTC `voter()`: pool-gauge voting for veBTC. Not part of the boost path. */
  readonly poolsVoter: Address
  /** veMEZO secondary voter (`isSecondaryVoter` == true). Not part of the boost path. */
  readonly thirdPartyVoter: Address
  /** Gauge factory approved in the registry and used for boost gauges. */
  readonly boostGaugeFactory: Address
  /** Creates one BribeVotingReward per gauge (`gaugeFactoryToVotingRewardsFactory`). */
  readonly votingRewardsFactory: Address
  /** BoostVoter.factoryRegistry(). */
  readonly factoryRegistry: Address
  /** BoostVoter.forwarder() (ERC-2771 trusted forwarder). */
  readonly forwarder: Address
  /** Canonical Multicall3; used by the app bundle and confirmed by aggregate3 calls. */
  readonly multicall3: Address
}

export interface MezoTokens {
  /** ERC-20 view of native BTC; veBTC.token(). */
  readonly btc: Address
  /** veMEZO.token(). */
  readonly mezo: Address
  /** MUSD stablecoin (mezo.org docs contract list). */
  readonly musd: Address
}

export interface MezoDeployment {
  readonly network: NetworkName
  readonly chainId: number
  readonly contracts: MezoContracts
  readonly tokens: MezoTokens
  /** EIP-1967 implementation slots observed on 2026-10-22; a change means Mezo upgraded. */
  readonly implementations: {
    readonly boostVoter: Address
    readonly veMezo: Address
    readonly veBtc: Address
    readonly poolsVoter: Address
    readonly thirdPartyVoter: Address
  }
  /** BoostVoter.governor() == veMEZO.team() at observation time. */
  readonly governance: Address
}

/*
 * Provenance for every proxy address: testnet.mezo.org app bundle `_assets/constants-BeGa9gJO.js`,
 * pairs of the form `address: JM ? <mainnet> : <testnet>` with `JM = VM === "mainnet"`.
 * Factory, registry and forwarder addresses come from on-chain getters on BoostVoter/FactoryRegistry.
 * All have code, and their implementations are Blockscout-verified (2026-10-22).
 */
export const DEPLOYMENTS: Record<NetworkName, MezoDeployment> = {
  mainnet: {
    network: "mainnet",
    chainId: 31612,
    contracts: {
      boostVoter: "0x2Ba614a598Cffa5a19d683cDCA97bac3a49313d1",
      veMezo: "0xb90fdAd3DFD180458D62Cc6acedc983D78E20122",
      veBtc: "0x3D4b1b884A7a1E59fE8589a3296EC8f8cBB6f279",
      poolsVoter: "0x48233cCC97B87Ba93bCA212cbEe48e3210211f03",
      thirdPartyVoter: "0x2e6D2F2CaCC1d24F9f9358030674eB307397A6EB",
      boostGaugeFactory: "0x4150DcE1c6d013fa7EBaf4fFCd879D08daA0CCAd",
      votingRewardsFactory: "0x30019D85a86ABD3cDA1167F4C052690c32FBDEc2",
      factoryRegistry: "0x04B94f55780682478c8D8329368AAAfD320F4D32",
      forwarder: "0xE6F919e62c370Ef04EDF4cA5E2a901Ea1aa87085",
      multicall3: "0xca11bde05977b3631167028862be2a173976ca11",
    },
    tokens: {
      btc: "0x7b7C000000000000000000000000000000000000",
      mezo: "0x7B7c000000000000000000000000000000000001",
      musd: "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186",
    },
    implementations: {
      boostVoter: "0xa696dc56522e41811d06bbda83c1a6d976637624",
      veMezo: "0x38fb7e0a3a7f1dd8610fa84c446e924e58d30d9c",
      veBtc: "0x41d0d67648bec455052e17264ce1fc2314b75ae3",
      poolsVoter: "0xa62060d57e04d6c799b58188dc654b85addd1465",
      thirdPartyVoter: "0x8d696ae943b97ff36449014e4400a9560d1664dc",
    },
    governance: "0x98D8899c3030741925BE630C710A98B57F397C7a",
  },
  testnet: {
    network: "testnet",
    chainId: 31611,
    contracts: {
      boostVoter: "0x21d7bDF5a5929AD179F8cA0c9014A0B62ae6Bfd1",
      veMezo: "0xaCE816CA2bcc9b12C59799dcC5A959Fb9b98111b",
      veBtc: "0x38E35d92E6Bfc6787272A62345856B13eA12130a",
      poolsVoter: "0x263F1Fd5fB7F866881e1B6cD7d5d6c40Fd985F0D",
      thirdPartyVoter: "0x62FE6d71BE2Ac2806Da046bf93b02C279246251D",
      boostGaugeFactory: "0x2c015840D034fE74BEA8C62Dd00A11e3aa338aD5",
      votingRewardsFactory: "0xB64952EdeF7E0D8d7b513a49c1B5532f1c49e150",
      factoryRegistry: "0x93915fF0ddEd1bfD587ef996Ee91504ab97E95Cf",
      forwarder: "0x5fA3D34F6c1537A0393098F0e124064B66cE8E24",
      multicall3: "0xca11bde05977b3631167028862be2a173976ca11",
    },
    tokens: {
      btc: "0x7b7C000000000000000000000000000000000000",
      mezo: "0x7B7c000000000000000000000000000000000001",
      musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
    },
    implementations: {
      boostVoter: "0xd3929dd059d0570b1fd2192574cbb6192b9bd759",
      veMezo: "0x9665873019a05bee102903c9df602da06555ae0a",
      veBtc: "0xe74c9ab64ec834cb6cd55bb9d41a19d97263fe81",
      poolsVoter: "0x3a0bef4ae17389db5e25068cab65209326bd9813",
      thirdPartyVoter: "0xdb0caeaac033cb2d2a1b51a5c70d37a1da2f70bd",
    },
    governance: "0x6e80164ea60673D64d5d6228beb684a1274Bb017",
  },
}

export function getDeployment(network: NetworkName): MezoDeployment {
  const deployment = DEPLOYMENTS[network]
  if (deployment === undefined) throw new Error(`No Mezo deployment configured for ${String(network)}`)
  return deployment
}

/** EIP-1967 implementation storage slot: bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1). */
export const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const

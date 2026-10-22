// GENERATED from the Blockscout-verified ABI. Do not edit by hand.
// FactoryRegistry 0x04B94f55780682478c8D8329368AAAfD320F4D32 (mainnet), contracts/factories/FactoryRegistry.sol, solc v0.8.24+commit.e11b9ed9.
// Only the entries Boost Relay uses are included (plus all custom errors, for revert decoding).

export const factoryRegistryAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "gaugeFactory",
        type: "address"
      }
    ],
    name: "isGaugeFactoryApproved",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "gaugeFactory",
        type: "address"
      }
    ],
    name: "gaugeFactoryToVotingRewardsFactory",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "FallbackFactory",
    type: "error"
  },
  {
    inputs: [],
    name: "InvalidGaugeFactoryPair",
    type: "error"
  },
  {
    inputs: [],
    name: "InvalidPoolFactoryPair",
    type: "error"
  },
  {
    inputs: [],
    name: "PathAlreadyApproved",
    type: "error"
  },
  {
    inputs: [],
    name: "PathNotApproved",
    type: "error"
  },
  {
    inputs: [],
    name: "SameAddress",
    type: "error"
  },
  {
    inputs: [],
    name: "ZeroAddress",
    type: "error"
  }
] as const

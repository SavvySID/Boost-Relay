// GENERATED from the Blockscout-verified ABI. Do not edit by hand.
// BoostVoter implementation 0xa696dc56522e41811d06bbda83c1a6d976637624 (mainnet), contracts/BoostVoter.sol, solc v0.8.24+commit.e11b9ed9. Testnet implementation 0xd3929dd059d0570b1fd2192574cbb6192b9bd759 has byte-identical sources.
// Only the entries Boost Relay uses are included (plus all custom errors, for revert decoding).

export const boostVoterAbi = [
  {
    inputs: [],
    name: "ve",
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
    name: "boostableVe",
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
    name: "maxVotingNum",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "length",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    name: "gauges",
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
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    name: "gaugeToBribe",
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
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    name: "isGauge",
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
        name: "",
        type: "address"
      }
    ],
    name: "isAlive",
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
        name: "",
        type: "address"
      }
    ],
    name: "weights",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      },
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    name: "votes",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      },
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    name: "gaugeVote",
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
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    name: "usedWeights",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    name: "lastVoted",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "totalWeight",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "boostableTokenId",
        type: "uint256"
      }
    ],
    name: "getBoost",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    name: "boostableTokenIdToGauge",
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
    inputs: [
      {
        internalType: "address",
        name: "",
        type: "address"
      }
    ],
    name: "isWhitelistedToken",
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
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    name: "isWhitelistedNFT",
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
        internalType: "uint256",
        name: "_timestamp",
        type: "uint256"
      }
    ],
    name: "epochStart",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_timestamp",
        type: "uint256"
      }
    ],
    name: "epochNext",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_timestamp",
        type: "uint256"
      }
    ],
    name: "epochVoteStart",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_timestamp",
        type: "uint256"
      }
    ],
    name: "epochVoteEnd",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [],
    name: "factoryRegistry",
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
    name: "forwarder",
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
    name: "governor",
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
    inputs: [
      {
        internalType: "uint256",
        name: "_tokenId",
        type: "uint256"
      },
      {
        internalType: "address[]",
        name: "_gaugeVote",
        type: "address[]"
      },
      {
        internalType: "uint256[]",
        name: "_weights",
        type: "uint256[]"
      }
    ],
    name: "vote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_tokenId",
        type: "uint256"
      }
    ],
    name: "reset",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_tokenId",
        type: "uint256"
      }
    ],
    name: "poke",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256",
        name: "boostableTokenId",
        type: "uint256"
      }
    ],
    name: "pokeBoost",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "uint256[]",
        name: "boostableTokenIds",
        type: "uint256[]"
      }
    ],
    name: "pokeBoosts",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_gauge",
        type: "address"
      },
      {
        internalType: "address[]",
        name: "_tokens",
        type: "address[]"
      },
      {
        internalType: "uint256[]",
        name: "_amounts",
        type: "uint256[]"
      }
    ],
    name: "addBribes",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address[]",
        name: "_bribes",
        type: "address[]"
      },
      {
        internalType: "address[][]",
        name: "_tokens",
        type: "address[][]"
      },
      {
        internalType: "uint256",
        name: "_tokenId",
        type: "uint256"
      }
    ],
    name: "claimBribes",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [],
    name: "AlreadyVotedOrDeposited",
    type: "error"
  },
  {
    inputs: [],
    name: "DistributeWindow",
    type: "error"
  },
  {
    inputs: [],
    name: "GaugeAlreadyKilled",
    type: "error"
  },
  {
    inputs: [],
    name: "GaugeAlreadyRevived",
    type: "error"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_gauge",
        type: "address"
      }
    ],
    name: "GaugeDoesNotExist",
    type: "error"
  },
  {
    inputs: [],
    name: "GaugeExists",
    type: "error"
  },
  {
    inputs: [],
    name: "GaugeExistsForLock",
    type: "error"
  },
  {
    inputs: [],
    name: "GaugeFactoryNotApproved",
    type: "error"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_gauge",
        type: "address"
      }
    ],
    name: "GaugeNotAlive",
    type: "error"
  },
  {
    inputs: [],
    name: "InactiveManagedNFT",
    type: "error"
  },
  {
    inputs: [],
    name: "LockDoesNotExist",
    type: "error"
  },
  {
    inputs: [],
    name: "LockExpired",
    type: "error"
  },
  {
    inputs: [],
    name: "MaximumVotingNumberTooLow",
    type: "error"
  },
  {
    inputs: [],
    name: "NonZeroVotes",
    type: "error"
  },
  {
    inputs: [],
    name: "NotApprovedOrOwner",
    type: "error"
  },
  {
    inputs: [],
    name: "NotBoostableVe",
    type: "error"
  },
  {
    inputs: [],
    name: "NotGovernor",
    type: "error"
  },
  {
    inputs: [],
    name: "NotSplitter",
    type: "error"
  },
  {
    inputs: [],
    name: "NotWhitelistedNFT",
    type: "error"
  },
  {
    inputs: [],
    name: "NotWhitelistedToken",
    type: "error"
  },
  {
    inputs: [],
    name: "SameValue",
    type: "error"
  },
  {
    inputs: [],
    name: "SpecialVotingWindow",
    type: "error"
  },
  {
    inputs: [],
    name: "TooManyGauges",
    type: "error"
  },
  {
    inputs: [],
    name: "UnequalLengths",
    type: "error"
  },
  {
    inputs: [
      {
        internalType: "enum IVotingEscrow.EscrowType",
        name: "escrowType",
        type: "uint8"
      }
    ],
    name: "UnsupportedEscrowType",
    type: "error"
  },
  {
    inputs: [],
    name: "ZeroAddress",
    type: "error"
  },
  {
    inputs: [],
    name: "ZeroBalance",
    type: "error"
  },
  {
    inputs: [],
    name: "ZeroLength",
    type: "error"
  }
] as const

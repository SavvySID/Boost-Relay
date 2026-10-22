// GENERATED from the Blockscout-verified ABI. Do not edit by hand.
// VeMEZO implementation 0x38fb7e0a3a7f1dd8610fa84c446e924e58d30d9c (mainnet), contracts/VeMEZO.sol, solc v0.8.33+commit.64118f21. Selected entries are identical in VeBTC 0x41d0d67648bec455052e17264ce1fc2314b75ae3, so one ABI serves both escrows.
// Only the entries Boost Relay uses are included (plus all custom errors, for revert decoding).

export const votingEscrowAbi = [
  {
    inputs: [],
    name: "name",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string"
      }
    ],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string"
      }
    ],
    stateMutability: "pure",
    type: "function"
  },
  {
    inputs: [],
    name: "token",
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
    name: "voter",
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
    name: "booster",
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
    name: "tokenId",
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
        name: "_tokenId",
        type: "uint256"
      }
    ],
    name: "ownerOf",
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
        name: "_owner",
        type: "address"
      }
    ],
    name: "balanceOf",
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
        internalType: "address",
        name: "_owner",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "_index",
        type: "uint256"
      }
    ],
    name: "ownerToNFTokenIdList",
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
        name: "_tokenId",
        type: "uint256"
      }
    ],
    name: "getApproved",
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
        name: "_owner",
        type: "address"
      },
      {
        internalType: "address",
        name: "_operator",
        type: "address"
      }
    ],
    name: "isApprovedForAll",
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
        name: "_spender",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "_tokenId",
        type: "uint256"
      }
    ],
    name: "isApprovedOrOwner",
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
        name: "_tokenId",
        type: "uint256"
      }
    ],
    name: "locked",
    outputs: [
      {
        components: [
          {
            internalType: "int128",
            name: "amount",
            type: "int128"
          },
          {
            internalType: "uint256",
            name: "end",
            type: "uint256"
          },
          {
            internalType: "bool",
            name: "isPermanent",
            type: "bool"
          },
          {
            internalType: "uint256",
            name: "boost",
            type: "uint256"
          }
        ],
        internalType: "struct IVotingEscrow.LockedBalance",
        name: "",
        type: "tuple"
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
      }
    ],
    name: "escrowType",
    outputs: [
      {
        internalType: "enum IVotingEscrow.EscrowType",
        name: "",
        type: "uint8"
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
      }
    ],
    name: "votingPowerOfNFT",
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
        name: "_tokenId",
        type: "uint256"
      }
    ],
    name: "unboostedVotingPowerOfNFT",
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
    name: "totalVotingPower",
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
    name: "unboostedTotalVotingPower",
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
        name: "_tokenId",
        type: "uint256"
      }
    ],
    name: "voted",
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
        name: "_tokenId",
        type: "uint256"
      }
    ],
    name: "votedVoters",
    outputs: [
      {
        internalType: "address[]",
        name: "",
        type: "address[]"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_voter",
        type: "address"
      }
    ],
    name: "isSecondaryVoter",
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
        name: "_tokenId",
        type: "uint256"
      }
    ],
    name: "deactivated",
    outputs: [
      {
        internalType: "bool",
        name: "inactive",
        type: "bool"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "allowedManager",
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
    name: "team",
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
    name: "AlreadyVoted",
    type: "error"
  },
  {
    inputs: [],
    name: "AmountTooBig",
    type: "error"
  },
  {
    inputs: [],
    name: "ERC721ReceiverRejectedTokens",
    type: "error"
  },
  {
    inputs: [],
    name: "ERC721TransferToNonERC721ReceiverImplementer",
    type: "error"
  },
  {
    inputs: [],
    name: "GrantFullyVested",
    type: "error"
  },
  {
    inputs: [],
    name: "GrantWithoutVestedAmount",
    type: "error"
  },
  {
    inputs: [],
    name: "IncorrectGrantVestingCliff",
    type: "error"
  },
  {
    inputs: [],
    name: "IncorrectGrantVestingRange",
    type: "error"
  },
  {
    inputs: [],
    name: "InvalidManagedNFTId",
    type: "error"
  },
  {
    inputs: [],
    name: "InvalidNonce",
    type: "error"
  },
  {
    inputs: [],
    name: "InvalidSignature",
    type: "error"
  },
  {
    inputs: [],
    name: "InvalidSignatureS",
    type: "error"
  },
  {
    inputs: [],
    name: "LockDurationNotInFuture",
    type: "error"
  },
  {
    inputs: [],
    name: "LockDurationTooLong",
    type: "error"
  },
  {
    inputs: [],
    name: "LockExpired",
    type: "error"
  },
  {
    inputs: [],
    name: "LockNotExpired",
    type: "error"
  },
  {
    inputs: [],
    name: "NoLockFound",
    type: "error"
  },
  {
    inputs: [],
    name: "NonExistentToken",
    type: "error"
  },
  {
    inputs: [],
    name: "NotAllowedGrantManager",
    type: "error"
  },
  {
    inputs: [],
    name: "NotApprovedOrOwner",
    type: "error"
  },
  {
    inputs: [],
    name: "NotBooster",
    type: "error"
  },
  {
    inputs: [],
    name: "NotDistributor",
    type: "error"
  },
  {
    inputs: [],
    name: "NotEmergencyCouncilOrGovernor",
    type: "error"
  },
  {
    inputs: [],
    name: "NotGovernor",
    type: "error"
  },
  {
    inputs: [],
    name: "NotGovernorOrManager",
    type: "error"
  },
  {
    inputs: [],
    name: "NotGrantManager",
    type: "error"
  },
  {
    inputs: [],
    name: "NotGrantNFT",
    type: "error"
  },
  {
    inputs: [],
    name: "NotLockedNFT",
    type: "error"
  },
  {
    inputs: [],
    name: "NotManagedNFT",
    type: "error"
  },
  {
    inputs: [],
    name: "NotManagedOrNormalNFT",
    type: "error"
  },
  {
    inputs: [],
    name: "NotNormalNFT",
    type: "error"
  },
  {
    inputs: [],
    name: "NotOwner",
    type: "error"
  },
  {
    inputs: [],
    name: "NotPermanentLock",
    type: "error"
  },
  {
    inputs: [],
    name: "NotTeam",
    type: "error"
  },
  {
    inputs: [],
    name: "NotVoter",
    type: "error"
  },
  {
    inputs: [],
    name: "OwnershipChange",
    type: "error"
  },
  {
    inputs: [],
    name: "PermanentLock",
    type: "error"
  },
  {
    inputs: [],
    name: "SafeCastOverflow",
    type: "error"
  },
  {
    inputs: [],
    name: "SafeCastUnderflow",
    type: "error"
  },
  {
    inputs: [],
    name: "SameAddress",
    type: "error"
  },
  {
    inputs: [],
    name: "SameNFT",
    type: "error"
  },
  {
    inputs: [],
    name: "SameState",
    type: "error"
  },
  {
    inputs: [],
    name: "SignatureExpired",
    type: "error"
  },
  {
    inputs: [],
    name: "SplitNoOwner",
    type: "error"
  },
  {
    inputs: [],
    name: "SplitNotAllowed",
    type: "error"
  },
  {
    inputs: [],
    name: "SplitsDisabled",
    type: "error"
  },
  {
    inputs: [],
    name: "TooManyTokenIDs",
    type: "error"
  },
  {
    inputs: [],
    name: "UnvestedGrantNFT",
    type: "error"
  },
  {
    inputs: [],
    name: "ZeroAddress",
    type: "error"
  },
  {
    inputs: [],
    name: "ZeroAmount",
    type: "error"
  },
  {
    inputs: [],
    name: "ZeroBalance",
    type: "error"
  }
] as const

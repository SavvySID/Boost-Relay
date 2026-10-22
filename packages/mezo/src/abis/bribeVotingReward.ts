// Hand-written from verified source. Deployed BribeVotingReward contracts are not individually
// verified on Blockscout; they are created by the verified VotingRewardsFactory
// (mainnet 0x30019D85a86ABD3cDA1167F4C052690c32FBDEc2) via `new BribeVotingReward(...)`.
// Declarations below mirror contracts/rewards/Reward.sol, VotingReward.sol and
// BribeVotingReward.sol from that factory's verified source bundle.
// scripts/verify-addresses.ts checks that a live bribe's runtime bytecode contains every selector.

export const bribeVotingRewardAbi = [
  // Reward.sol:22 `address public immutable voter`
  { type: "function", name: "voter", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  // Reward.sol:24 `address public immutable ve`
  { type: "function", name: "ve", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  // Reward.sol:29 `uint256 public totalSupply` (sum of vote balances currently deposited)
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  // Reward.sol:31 `mapping(uint256 => uint256) public balanceOf` (vote balance per veMEZO tokenId)
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Reward.sol:33 `mapping(address => mapping(uint256 => uint256)) public tokenRewardsPerEpoch` (token, epochStart)
  {
    type: "function",
    name: "tokenRewardsPerEpoch",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Reward.sol:37 `address[] public rewards`
  {
    type: "function",
    name: "rewards",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  // Reward.sol:39 `mapping(address => bool) public isReward`
  {
    type: "function",
    name: "isReward",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  // Reward.sol:175
  { type: "function", name: "rewardsListLength", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  // Reward.sol:185 — completed epochs only; paid to ownerOf(tokenId) on claim (VotingReward.sol getReward)
  {
    type: "function",
    name: "earned",
    stateMutability: "view",
    inputs: [
      { name: "token", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  // IReward.sol errors
  { type: "error", name: "InvalidReward", inputs: [] },
  { type: "error", name: "NotAuthorized", inputs: [] },
  { type: "error", name: "NotGauge", inputs: [] },
  { type: "error", name: "NotEscrowToken", inputs: [] },
  { type: "error", name: "NotSingleToken", inputs: [] },
  { type: "error", name: "NotVotingEscrow", inputs: [] },
  { type: "error", name: "NotWhitelisted", inputs: [] },
  { type: "error", name: "ZeroAmount", inputs: [] },
] as const

import type { StrategyId } from "@boost-relay/optimizer"
import type { NetworkName } from "./market-dto"
import type { RecommendationDto } from "./optimizer-dto"

/** One condition that must hold before a vote can be signed. */
export interface VoteGate {
  readonly id:
    | "network-testnet"
    | "token-exists"
    | "owner-matches"
    | "power-positive"
    | "not-voted-this-epoch"
    | "in-vote-window"
    | "snapshot-complete"
    | "snapshot-fresh"
    | "allocation-known"
    | "recommendation-actionable"
    | "allocation-checks"
    | "weights-sum-to-power"
  readonly label: string
  readonly ok: boolean
  readonly detail: string
}

/**
 * A vote prepared from fresh chain state and simulated as the connected account. It describes a
 * call; it is never sent by the server. Only the user's wallet can sign and broadcast it.
 */
export interface PreparedVote {
  readonly network: "testnet"
  readonly chainId: number
  /** Connected account the vote was prepared and simulated for. */
  readonly account: string
  /** BoostVoter address from the verified deployment config. */
  readonly to: string
  readonly functionName: "vote"
  readonly signature: "vote(uint256,address[],uint256[])"
  readonly tokenId: string
  readonly gauges: readonly string[]
  /** veBTC id behind each gauge, for review. */
  readonly gaugeTokenIds: readonly (string | null)[]
  /** Relative weights exactly as passed to vote(); they sum to votingPower at the source block. */
  readonly weights: readonly string[]
  /** encodeFunctionData(boostVoterAbi, "vote", [tokenId, gauges, weights]). */
  readonly calldata: string
  readonly strategy: StrategyId
  readonly votingPower: string
  readonly sourceBlock: string
  readonly sourceTimestamp: string
  readonly epochStart: string
  readonly voteEnd: string
  readonly preparedAt: string
  /** After this time the prepared vote must be prepared again. */
  readonly expiresAt: string
  readonly simulation: { readonly ok: true; readonly blockNumber: string; readonly simulatedAt: string }
  readonly gates: readonly VoteGate[]
  readonly recommendation: RecommendationDto
  readonly existingVotes: readonly { readonly gauge: string; readonly tokenId: string | null; readonly votes: string }[]
}

export type PrepareResponse =
  | { readonly ok: true; readonly prepared: PreparedVote }
  | {
      readonly ok: false
      readonly error: { readonly code: string; readonly message: string }
      /** Present when preparation got far enough to evaluate the gates. */
      readonly gates?: readonly VoteGate[]
    }

export interface SimulateRequest {
  readonly network: NetworkName
  readonly account: string
  readonly to: string
  readonly data: string
}

export type SimulateResponse =
  | { readonly ok: true; readonly blockNumber: string; readonly simulatedAt: string }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

/** The mined transaction behind a hash, so the browser can check it is the reviewed vote. */
export interface ReceiptTransaction {
  readonly from: string
  readonly to: string | null
  readonly input: string
}

export type ReceiptResponse =
  | {
      readonly ok: true
      readonly status: "pending" | "success" | "reverted"
      readonly blockNumber: string | null
      readonly gasUsed: string | null
      /** null while the transaction is not yet visible to the RPC. */
      readonly transaction: ReceiptTransaction | null
    }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

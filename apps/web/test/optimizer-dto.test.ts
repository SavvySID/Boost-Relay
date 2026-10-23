import { boostVoterAbi } from "@boost-relay/mezo"
import { recommend } from "@boost-relay/optimizer"
import { decodeFunctionData, encodeFunctionData } from "viem"
import { describe, expect, it } from "vitest"
import { stringifyBigints } from "@/lib/optimizer-dto"
import { BASE, input, snapshot, token } from "../../../packages/optimizer/test/fixtures"

describe("optimizer DTO and proposed vote call", () => {
  const rec = recommend(input(snapshot(BASE), token(100)))

  it("stringifies every bigint losslessly and stays JSON-safe", () => {
    const dto = stringifyBigints(rec)
    const round = JSON.parse(JSON.stringify(dto)) as typeof dto
    expect(round).toEqual(dto)
    expect(dto.summary?.votingPower).toBe((100n * 10n ** 18n).toString())
    expect(dto.lines.map((l) => BigInt(l.predictedVotes))).toEqual(rec.lines.map((l) => l.predictedVotes))
  })

  it("encodes vote() with the verified ABI and decodes back to the same gauges and weights", () => {
    const call = rec.voteCall
    if (call === null) throw new Error("expected a vote call")
    const data = encodeFunctionData({ abi: boostVoterAbi, functionName: "vote", args: [call.tokenId, [...call.gauges], [...call.weights]] })
    expect(data.startsWith("0x7ac09bf7")).toBe(true) // vote(uint256,address[],uint256[])
    const decoded = decodeFunctionData({ abi: boostVoterAbi, data })
    expect(decoded.functionName).toBe("vote")
    expect(decoded.args).toEqual([call.tokenId, call.gauges.map((g) => g.toLowerCase()).map((g) => expect.stringMatching(new RegExp(`^${g}$`, "i"))), call.weights])
  })
})

import { describe, expect, it } from "vitest"
import {
  PRECISION,
  analyzeBoost,
  classifyPosition,
  getEpochInfo,
  summarizeMarket,
  type BoostPosition,
  type MarketSnapshot,
} from "@boost-relay/mezo"
import { toMarketDto } from "@/lib/server/to-dto"
import { compact, integer, basisPoints, boostDelta } from "@/lib/market-formatting"
import { filterCounts, matchesSearch, viewPositions } from "@/lib/market-view"

const P = PRECISION
const tokens = (n: bigint): bigint => n * P
const T = 1_792_705_788n
const Tm = tokens(1000n)
const Tb = tokens(100n)
const MEZO = "0x7B7c000000000000000000000000000000000001" as const
const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as `0x${string}`

function position(id: bigint, o: { weight: bigint; power: bigint; alive?: boolean; end?: bigint; bribe?: `0x${string}` | null }): BoostPosition {
  const alive = o.alive ?? true
  const lock = { amount: tokens(1n), end: o.end ?? T + 10_000n, isPermanent: false, storedBoostRaw: 0n }
  return {
    tokenId: id,
    gauge: addr(0x1000 + Number(id)),
    bribe: o.bribe === undefined ? addr(0x2000 + Number(id)) : o.bribe,
    owner: addr(0x3000 + Number(id)),
    gaugeAlive: alive,
    lock,
    unboostedVotingPower: o.power,
    gaugeWeight: o.weight,
    status: classifyPosition({ gaugeAlive: alive, lockAmount: lock.amount, lockEnd: lock.end, isPermanent: false, unboostedVotingPower: o.power, timestamp: T }),
    analysis: analyzeBoost({ gaugeWeight: o.weight, totalVeMezoVotingPower: Tm, totalUnboostedVeBtcVotingPower: Tb, positionUnboostedVotingPower: o.power }, 0n),
    onchainBoost: null,
  }
}

function snapshot(positions: BoostPosition[], extra: Partial<MarketSnapshot["incentives"]> = {}): MarketSnapshot {
  const epoch = getEpochInfo(T)
  return {
    meta: {
      network: "testnet",
      chainId: 31611,
      blockNumber: 16_307_502n,
      blockTimestamp: T,
      fetchedAt: "2026-10-23T00:00:00.000Z",
      ageSeconds: 3,
      completeness: "complete",
      mappingSource: "scan",
      failures: [],
    },
    global: {
      totalVeMezoVotingPower: Tm,
      totalUnboostedVeBtcVotingPower: Tb,
      boostVoterTotalWeight: tokens(400n),
      maxVotingNum: 30n,
      gaugeCount: BigInt(positions.length),
      veBtcMaxTokenId: 9n,
      veMezoMaxTokenId: 3n,
      epoch,
    },
    positions,
    summary: summarizeMarket(positions),
    incentives: { included: true, completeness: "complete", byGauge: [], failures: [], ...extra },
  }
}

describe("toMarketDto", () => {
  const positions = [
    position(1n, { weight: tokens(25n), power: tokens(10n) }), // 2x
    position(2n, { weight: tokens(130n), power: tokens(10n) }), // capped, 30 over
    position(3n, { weight: 0n, power: tokens(10n) }), // no votes
    position(4n, { weight: tokens(7n), power: 0n, end: T - 1n }), // expired
    position(5n, { weight: tokens(9n), power: tokens(10n), alive: false }), // closed gauge
    position(6n, { weight: tokens(1n), power: tokens(10n), bribe: null }), // no incentive contract
  ]
  const p1 = positions[0] as BoostPosition
  const p2 = positions[1] as BoostPosition
  const snap = snapshot(positions, {
    byGauge: [
      { gauge: p1.gauge, bribe: p1.bribe as `0x${string}`, epochStart: getEpochInfo(T).epochStart, tokens: [{ token: MEZO, symbol: "MEZO", decimals: 18, postedForEpoch: tokens(80_000n) }] },
      { gauge: p2.gauge, bribe: p2.bribe as `0x${string}`, epochStart: getEpochInfo(T).epochStart, tokens: [] },
    ],
    failures: [{ key: `incentive:${addr(0x1003)}:length`, kind: "rpc", message: "timeout" }],
  })
  const dto = toMarketDto(snap)

  it("is JSON-safe and lossless (every bigint becomes a decimal string)", () => {
    const json = JSON.stringify(dto)
    expect(JSON.parse(json)).toEqual(dto)
    expect(dto.global.totalVeMezoVotingPower).toBe(Tm.toString())
    expect(dto.meta.blockNumber).toBe("16307502")
    expect(dto.positions[0]?.liveBoost).toBe((2n * P).toString())
    expect(dto.meta.explorerUrl).toBe("https://explorer.test.mezo.org")
  })

  it("distinguishes posted, confirmed-none, unavailable and not-read incentives", () => {
    const status = Object.fromEntries(dto.positions.map((p) => [p.tokenId, p.incentives.status]))
    expect(status).toEqual({ "1": "posted", "2": "none-posted", "3": "unavailable", "4": "unavailable", "5": "not-read", "6": "unavailable" })
    expect(dto.positions[0]?.incentives.tokens[0]).toEqual({ token: MEZO, symbol: "MEZO", decimals: 18, postedForEpoch: tokens(80_000n).toString() })
  })

  it("derives status counts, buckets and additional weight from the same snapshot", () => {
    expect(dto.derived.statusCounts).toEqual({ active: 4, "gauge-killed": 1, "no-lock": 0, expired: 1, "no-power": 0 })
    expect(dto.derived.liveMatchesActive).toBe(true)
    const buckets = Object.fromEntries(dto.derived.boostBuckets.map((b) => [b.label, b.count]))
    expect(buckets["1x"]).toBe(1) // no votes
    expect(buckets["2–3x"]).toBe(1) // exactly 2x
    expect(buckets["5x cap"]).toBe(1)
    // Below-cap live positions: #1 needs 75 more, #3 needs 100, #6 needs 99.
    expect(dto.derived.additionalWeightToMaxBelowCap).toBe(tokens(274n).toString())
    expect(dto.derived.weightOnKilledGauges).toBe(tokens(9n).toString())
    // 400 total - (live 156 + zero-power 7 + killed 9) = 228 unattributed
    expect(dto.derived.weightUnattributed).toBe(tokens(228n).toString())
    expect(dto.summary.excessWeightOnLive).toBe(tokens(30n).toString())
  })
})

describe("market view (client-side filtering never refetches)", () => {
  const dto = toMarketDto(
    snapshot([
      position(1n, { weight: tokens(25n), power: tokens(10n) }),
      position(2n, { weight: tokens(130n), power: tokens(10n) }),
      position(3n, { weight: 0n, power: tokens(10n) }),
      position(4n, { weight: tokens(7n), power: 0n, end: T - 1n }),
      position(12n, { weight: tokens(50n), power: tokens(10n) }),
    ]),
  )

  it("counts each filter from statuses", () => {
    expect(filterCounts(dto.positions)).toEqual({ all: 5, "below-cap": 3, "no-votes": 1, "at-cap": 1, inactive: 1 })
  })

  it("searches token ids by prefix and addresses case-insensitively", () => {
    const ids = (q: string) => dto.positions.filter((p) => matchesSearch(p, q)).map((p) => p.tokenId)
    expect(ids("1")).toEqual(["1", "12"])
    expect(ids("#12")).toEqual(["12"])
    expect(ids(addr(0x1002).toUpperCase().replace("0X", "0x"))).toEqual(["2"])
    expect(ids("zzz")).toEqual([])
  })

  it("sorts by bigint values with not-applicable rows last in both directions", () => {
    const order = (key: "votes" | "to-max", dir: "asc" | "desc") =>
      viewPositions(dto.positions, { filter: "all", query: "", sortKey: key, sortDirection: dir }).map((p) => p.tokenId)
    expect(order("votes", "desc")).toEqual(["2", "12", "1", "4", "3"])
    expect(order("to-max", "asc")).toEqual(["2", "12", "1", "3", "4"]) // 2 at cap needs 0; 4 expired is n/a
    expect(order("to-max", "desc").at(-1)).toBe("4")
  })
})

describe("bigint-safe formatting", () => {
  it("formats compact amounts without floating point", () => {
    expect(compact(17_506_532_415_000_000_000_000_000n)).toBe("17.50M")
    expect(compact(999_999_999_999_999_999_999_999_999_999n)).toBe("999.99B") // 999,999,999,999.99 tokens, truncated
    expect(compact(5_000_000_000_000_000n)).toBe("<0.01")
    expect(compact("0")).toBe("0")
    expect(integer("12694524")).toBe("12,694,524")
    expect(basisPoints(tokens(1n), tokens(3n))).toBe(3333)
    expect(boostDelta("-100000000000000000")).toBe("-0.10x")
  })
})

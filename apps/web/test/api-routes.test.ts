import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { boostVoterAbi } from "@boost-relay/mezo"
import { encodeFunctionData, HttpRequestError, type Address, type Hex } from "viem"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Any RPC a test reaches by mistake fails fast against a closed local port instead of a real network.
vi.hoisted(() => {
  process.env["MEZO_TESTNET_RPC_URL"] = "http://127.0.0.1:9"
  process.env["MEZO_MAINNET_RPC_URL"] = "http://127.0.0.1:9"
})

const { GET: marketGET } = await import("@/app/api/market/route")
const { GET: optimizeGET } = await import("@/app/api/optimize/route")
const prepareRoute = await import("@/app/api/vote/prepare/route")
const simulateRoute = await import("@/app/api/vote/simulate/route")
const receiptRoute = await import("@/app/api/vote/receipt/route")
const { resetRateLimits, MAX_JSON_BYTES, RATE_LIMITS, parseTokenId, parseAddress } = await import("@/lib/server/request-guards")
const { describeRevert, readReceipt, voteArgsProblem } = await import("@/lib/server/vote-service")
const { describeError } = await import("@/lib/server/market-service")
const { DEPLOYMENTS } = await import("@boost-relay/mezo")

const ACCOUNT = "0x00000000000000000000000000000000000a11ce"
const BOOST_VOTER = DEPLOYMENTS.testnet.contracts.boostVoter
const G1 = "0x1111111111111111111111111111111111111111" as Address
const G2 = "0x2222222222222222222222222222222222222222" as Address
const HASH = `0x${"cd".repeat(32)}`

const get = (path: string, headers: Record<string, string> = {}) => new Request(`http://localhost${path}`, { headers })
const post = (body: string, headers: Record<string, string> = { "content-type": "application/json" }) =>
  new Request("http://localhost/api/vote/simulate", { method: "POST", body, headers })
const voteData = (gauges: Address[], weights: bigint[], tokenId = 4242n) => encodeFunctionData({ abi: boostVoterAbi, functionName: "vote", args: [tokenId, gauges, weights] })
const simulateBody = (over: Record<string, unknown> = {}) => JSON.stringify({ network: "testnet", account: ACCOUNT, to: BOOST_VOTER, data: voteData([G1, G2], [1n, 2n]), ...over })

async function json(res: Response): Promise<{ status: number; body: { ok: boolean; error?: { code: string; message: string } } }> {
  return { status: res.status, body: (await res.json()) as { ok: boolean; error?: { code: string; message: string } } }
}

beforeEach(() => resetRateLimits())

describe("input parsing", () => {
  it("accepts only positive whole-number token ids", () => {
    expect(parseTokenId("4242")).toBe(4242n)
    expect(parseTokenId("#4242")).toBe(4242n)
    for (const bad of [null, "", "0", "-1", "01", "1.5", "1e3", "0x10", "4242abc", "1".repeat(31), " ", "4242; drop"]) expect(parseTokenId(bad)).toBeNull()
  })

  it("accepts only 20-byte hex addresses", () => {
    expect(parseAddress(ACCOUNT)).toBe(ACCOUNT)
    for (const bad of [null, 42, "", "0x", "0x123", `${ACCOUNT}00`, "0xZZ00000000000000000000000000000000000000", `${ACCOUNT} `]) expect(parseAddress(bad)).toBeNull()
  })
})

describe("GET /api/vote/prepare", () => {
  const base = `/api/vote/prepare?network=testnet&tokenId=4242&strategy=max-boosted-power&account=${ACCOUNT}`

  it("rejects missing or malformed fields with 400 before reading the chain", async () => {
    for (const [query, code] of [
      [base.replace("network=testnet", "network=sepolia"), "invalid-network"],
      [base.replace("network=testnet&", ""), "invalid-network"],
      [base.replace("tokenId=4242", "tokenId=0"), "invalid-token"],
      [base.replace("tokenId=4242", "tokenId=-5"), "invalid-token"],
      [base.replace("tokenId=4242", "tokenId=0x10"), "invalid-token"],
      [base.replace("strategy=max-boosted-power", "strategy=all-in"), "invalid-strategy"],
      [base.replace(ACCOUNT, "0x1234"), "invalid-account"],
      [base.replace(`&account=${ACCOUNT}`, ""), "invalid-account"],
    ] as const) {
      const r = await json(await prepareRoute.GET(get(query)))
      expect(r.status, query).toBe(400)
      expect(r.body.error?.code).toBe(code)
    }
  })

  it("keeps mainnet read-only", async () => {
    const r = await json(await prepareRoute.GET(get(base.replace("network=testnet", "network=mainnet"))))
    expect(r.status).toBe(403)
    expect(r.body.error?.code).toBe("mainnet-disabled")
  })

  it("ignores client claims about ownership or eligibility", async () => {
    // There is no owner/eligibility input: extra parameters change nothing (mainnet is still refused).
    const r = await json(await prepareRoute.GET(get(`${base.replace("network=testnet", "network=mainnet")}&owner=${ACCOUNT}&canVote=true&eligible=1`)))
    expect(r.status).toBe(403)
  })

  it("refuses cross-site browser requests", async () => {
    const r = await json(await prepareRoute.GET(get(base, { "sec-fetch-site": "cross-site" })))
    expect(r.status).toBe(403)
    expect(r.body.error?.code).toBe("cross-site")
  })

  it("rate-limits a single client", async () => {
    const limit = RATE_LIMITS.prepare.limit
    const bad = base.replace("network=testnet", "network=x") // fails validation, so no RPC is spent
    for (let i = 0; i < limit; i++) expect((await prepareRoute.GET(get(bad, { "x-forwarded-for": "203.0.113.7" }))).status).toBe(400)
    const limited = await prepareRoute.GET(get(bad, { "x-forwarded-for": "203.0.113.7" }))
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0)
    expect((await prepareRoute.GET(get(bad, { "x-forwarded-for": "198.51.100.9" }))).status).toBe(400)
  })

  it("is GET only and never cached", async () => {
    expect(Object.keys(prepareRoute).filter((k) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(k))).toEqual(["GET"])
    const res = await prepareRoute.GET(get(base.replace("tokenId=4242", "tokenId=0")))
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})

describe("POST /api/vote/simulate", () => {
  it("is POST only", () => {
    expect(Object.keys(simulateRoute).filter((k) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(k))).toEqual(["POST"])
  })

  it("requires a bounded JSON object", async () => {
    expect((await simulateRoute.POST(post(simulateBody(), { "content-type": "text/plain" }))).status).toBe(415)
    expect((await simulateRoute.POST(post("{not json"))).status).toBe(400)
    expect((await simulateRoute.POST(post("[1,2,3]"))).status).toBe(400)
    expect((await simulateRoute.POST(post(JSON.stringify({ pad: "x".repeat(MAX_JSON_BYTES) })))).status).toBe(413)
    expect((await simulateRoute.POST(post("{}", { "content-type": "application/json", "content-length": String(MAX_JSON_BYTES * 4) }))).status).toBe(413)
  })

  it("rejects bad networks, accounts, targets and calldata before reading the chain", async () => {
    const cases: [string, number, string][] = [
      [simulateBody({ network: "mainnet" }), 403, "mainnet-disabled"],
      [simulateBody({ network: 1 }), 400, "invalid-network"],
      [simulateBody({ account: "0xabc" }), 400, "bad-request"],
      [simulateBody({ to: G1 }), 400, "wrong-contract"],
      [simulateBody({ data: "0x7ac09bf" }), 400, "bad-calldata"],
      [simulateBody({ data: "0xzz" }), 400, "bad-calldata"],
      [simulateBody({ data: `0x${"ab".repeat(5000)}` }), 400, "bad-calldata"],
      [simulateBody({ data: encodeFunctionData({ abi: boostVoterAbi, functionName: "reset", args: [4242n] }) }), 400, "wrong-function"],
      [simulateBody({ data: voteData([G1, G1], [1n, 2n]) }), 400, "bad-arguments"],
      [simulateBody({ data: voteData([G1, G2], [1n, 0n]) }), 400, "bad-arguments"],
      [simulateBody({ data: voteData([], []) }), 400, "bad-arguments"],
      // Client-supplied eligibility is not an input; it cannot rescue a wrong contract.
      [simulateBody({ to: G2, owner: ACCOUNT, canVoteThisEpoch: true }), 400, "wrong-contract"],
    ]
    for (const [body, status, code] of cases) {
      const r = await json(await simulateRoute.POST(post(body)))
      expect(r.status, body.slice(0, 80)).toBe(status)
      expect(r.body.error?.code).toBe(code)
    }
  })

  it("refuses cross-site browser requests", async () => {
    expect((await simulateRoute.POST(post(simulateBody(), { "content-type": "application/json", "sec-fetch-site": "cross-site" }))).status).toBe(403)
  })
})

describe("GET /api/vote/receipt", () => {
  it("validates the network and hash", async () => {
    expect((await receiptRoute.GET(get(`/api/vote/receipt?network=testnet&hash=0x1234`))).status).toBe(400)
    expect((await receiptRoute.GET(get(`/api/vote/receipt?hash=${HASH}`))).status).toBe(400)
    expect((await receiptRoute.GET(get(`/api/vote/receipt?network=mainnet&hash=${HASH}`))).status).toBe(403)
  })

  it("returns the mined transaction next to the status, and pending when it is not found", async () => {
    const client = {
      getTransactionReceipt: vi.fn(async () => ({ status: "success" as const, blockNumber: 9n, gasUsed: 21_000n })),
      getTransaction: vi.fn(async () => ({ from: ACCOUNT as Address, to: BOOST_VOTER as Address, input: "0x7ac09bf7" as Hex })),
    }
    expect(await readReceipt("testnet", HASH, client)).toEqual({
      ok: true,
      status: "success",
      blockNumber: "9",
      gasUsed: "21000",
      transaction: { from: ACCOUNT, to: BOOST_VOTER, input: "0x7ac09bf7" },
    })
    const { TransactionReceiptNotFoundError } = await import("viem")
    client.getTransactionReceipt.mockRejectedValueOnce(new TransactionReceiptNotFoundError({ hash: HASH as Hex }))
    expect(await readReceipt("testnet", HASH, client)).toMatchObject({ ok: true, status: "pending", transaction: null })
    client.getTransactionReceipt.mockRejectedValueOnce(new HttpRequestError({ url: "https://user:secret@rpc.example/key123" }))
    const failed = await readReceipt("testnet", HASH, client)
    expect(failed).toMatchObject({ ok: false, error: { code: "receipt-unavailable" } })
    expect(JSON.stringify(failed)).not.toMatch(/secret|key123|rpc\.example/)
  })
})

describe("market and optimizer routes", () => {
  it("validate the network and token id", async () => {
    expect((await marketGET(get("/api/market?network=goerli"))).status).toBe(400)
    expect((await marketGET(get("/api/market"))).status).toBe(400)
    for (const t of ["0", "abc", "-1", "1".repeat(31), "0x1"]) expect((await optimizeGET(get(`/api/optimize?network=testnet&tokenId=${t}`))).status, t).toBe(400)
    expect((await optimizeGET(get("/api/optimize?network=x&tokenId=4242"))).status).toBe(400)
  })
})

describe("error messages never leak internals", () => {
  it("replace RPC and transport errors with fixed text", () => {
    const leaky = new HttpRequestError({ url: "https://user:secret@rpc.example/key123", details: "ECONNREFUSED 10.0.0.5:8545" })
    for (const d of [describeRevert(leaky), describeRevert(new Error("boom at /srv/app/x.ts:1")), describeError(leaky, "testnet"), describeError(new Error("timeout at https://secret.example"), "mainnet")]) {
      expect(JSON.stringify(d)).not.toMatch(/secret|key123|rpc\.example|10\.0\.0\.5|\/srv\/|https?:/)
    }
  })

  it("check vote() arguments structurally", () => {
    expect(voteArgsProblem([G1, G2], [1n, 2n])).toBeNull()
    expect(voteArgsProblem([G1], [1n, 2n])).toMatch(/differ/)
    expect(voteArgsProblem([G1, G1.toUpperCase().replace("0X", "0x")], [1n, 2n])).toMatch(/twice/)
    expect(voteArgsProblem(Array.from({ length: 65 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}`), Array.from({ length: 65 }, () => 1n))).toMatch(/Too many/)
  })
})

describe("the server cannot sign or send", () => {
  const root = join(__dirname, "..", "..", "..")
  const files: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(name)) files.push(p)
    }
  }
  for (const d of ["packages/mezo/src", "packages/optimizer/src", "apps/web/lib/server", "apps/web/app/api", "scripts"]) walk(join(root, d))

  it("has no wallet client, key handling or state-changing RPC anywhere on the server", () => {
    const pattern = /createWalletClient|privateKeyToAccount|mnemonicToAccount|hdKeyToAccount|signTransaction|sendRawTransaction|eth_sendTransaction|writeContract|eth_sign|personal_sign|signTypedData|PRIVATE_KEY/
    const offenders = files.filter((f) => pattern.test(readFileSync(f, "utf8")))
    expect(files.length).toBeGreaterThan(15)
    expect(offenders).toEqual([])
  })
})

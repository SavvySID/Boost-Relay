import { describe, expect, it } from "vitest"
import { PRECISION, assertNetworkName, formatBoost, formatFixed, formatRatioPercent, formatTokenAmount, ratioToPpm, resolveRpcUrl } from "../src/index.js"

describe("formatting (bigint only, truncating)", () => {
  it("formats boosts and token amounts", () => {
    expect(formatBoost(2_500_000_000_000_000_000n)).toBe("2.50x")
    expect(formatBoost(PRECISION, 0)).toBe("1x")
    expect(formatTokenAmount(98_779_105_151_164_649_775_328_513n, 18, 0)).toBe("98,779,105")
    expect(formatTokenAmount(1_234_567_890_000_000_000n, 18, 2)).toBe("1.23")
    expect(formatFixed(-1_500_000n, 6, 1)).toBe("-1.5")
  })

  it("formats ratios without floating point", () => {
    const r = { numerator: 17_506_532n, denominator: 59_533_214n }
    expect(formatRatioPercent(r, 3)).toBe("29.406%")
    expect(ratioToPpm(r)).toBe(294_063n)
    expect(formatRatioPercent({ numerator: 1n, denominator: 0n })).toBe("n/a")
  })
})

describe("network configuration", () => {
  it("never guesses a network", () => {
    expect(assertNetworkName("testnet")).toBe("testnet")
    expect(() => assertNetworkName("sepolia")).toThrow(/Unknown Mezo network/)
    expect(() => assertNetworkName(undefined)).toThrow()
  })

  it("resolves RPCs per network: override, then env var, then official default", () => {
    expect(resolveRpcUrl("testnet")).toBe("https://rpc.test.mezo.org")
    expect(resolveRpcUrl("mainnet")).toBe("https://mainnet.mezo.public.validationcloud.io")
    expect(resolveRpcUrl("mainnet", { env: { MEZO_MAINNET_RPC_URL: "https://jsonrpc-mezo.boar.network" } })).toBe(
      "https://jsonrpc-mezo.boar.network",
    )
    // A testnet override never leaks into mainnet.
    expect(resolveRpcUrl("mainnet", { env: { MEZO_TESTNET_RPC_URL: "https://example.org" } })).toBe(
      "https://mainnet.mezo.public.validationcloud.io",
    )
    expect(resolveRpcUrl("testnet", { override: "https://x.example" })).toBe("https://x.example")
    expect(() => resolveRpcUrl("testnet", { override: "ftp://nope" })).toThrow()
  })
})

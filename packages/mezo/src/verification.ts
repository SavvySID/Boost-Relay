import {
  createPublicClient,
  erc20Abi,
  getAddress,
  http,
  isAddress,
  multicall3Abi,
  toFunctionSelector,
  type Abi,
  type Address,
  type PublicClient,
} from "viem"
import { boostVoterAbi, bribeVotingRewardAbi, factoryRegistryAbi, votingEscrowAbi } from "./abis/index.js"
import { EIP1967_IMPLEMENTATION_SLOT, getDeployment } from "./config/addresses.js"
import { CHAINS, resolveRpcUrl, type NetworkName } from "./config/chains.js"

export type CheckStatus = "pass" | "fail" | "warn"

export interface VerificationCheck {
  readonly name: string
  readonly status: CheckStatus
  readonly expected?: string
  readonly observed?: string
}

export interface DeploymentVerification {
  readonly network: NetworkName
  readonly rpcUrl: string
  readonly expectedChainId: number
  readonly observedChainId: number | null
  readonly blockNumber: bigint | null
  readonly checks: readonly VerificationCheck[]
  /** True when no check failed (warnings allowed). */
  readonly ok: boolean
}

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()
const firstLine = (s: string): string => s.split("\n")[0] ?? s

/** Read-only checks of every configured address and the relationships between contracts. */
export async function verifyDeployment(
  network: NetworkName,
  options: { readonly rpcUrl?: string; readonly env?: Record<string, string | undefined> } = {},
): Promise<DeploymentVerification> {
  const deployment = getDeployment(network)
  const rpcUrl = resolveRpcUrl(network, {
    ...(options.rpcUrl !== undefined ? { override: options.rpcUrl } : {}),
    ...(options.env !== undefined ? { env: options.env } : {}),
  })
  const client = createPublicClient({ chain: CHAINS[network], transport: http(rpcUrl, { timeout: 60_000, retryCount: 2 }) }) as PublicClient
  const checks: VerificationCheck[] = []
  const add = (c: VerificationCheck): void => {
    checks.push(c)
  }

  // 1. Chain id. Everything else is skipped on mismatch.
  let observedChainId: number | null = null
  try {
    observedChainId = await client.getChainId()
  } catch (error) {
    add({ name: "eth_chainId", status: "fail", expected: String(deployment.chainId), observed: String(error) })
  }
  if (observedChainId !== null) {
    add({
      name: "eth_chainId",
      status: observedChainId === deployment.chainId ? "pass" : "fail",
      expected: String(deployment.chainId),
      observed: String(observedChainId),
    })
  }
  if (observedChainId !== deployment.chainId) {
    return { network, rpcUrl, expectedChainId: deployment.chainId, observedChainId, blockNumber: null, checks, ok: false }
  }
  const blockNumber = await client.getBlockNumber()

  // 2. Format (strict EIP-55 for mixed case) and deployed code for every configured address.
  const all: [string, Address][] = [
    ...Object.entries(deployment.contracts).map(([k, v]) => [`contracts.${k}`, v] as [string, Address]),
    ...Object.entries(deployment.tokens).map(([k, v]) => [`tokens.${k}`, v] as [string, Address]),
    ...Object.entries(deployment.implementations).map(([k, v]) => [`implementations.${k}`, v] as [string, Address]),
  ]
  for (const [name, address] of all) {
    const formatOk = /^0x[0-9a-fA-F]{40}$/.test(address) && isAddress(address, { strict: true })
    add({ name: `${name} format (20 bytes, checksum)`, status: formatOk ? "pass" : "fail", observed: address })
    const code = await client.getCode({ address, blockNumber })
    const size = code === undefined ? 0 : (code.length - 2) / 2
    add({ name: `${name} has code`, status: size > 0 ? "pass" : "fail", observed: `${size} bytes` })
  }

  // 3. Role cross-references read from the contracts themselves.
  const c = deployment.contracts
  const t = deployment.tokens
  const read = async (address: Address, abi: Abi, functionName: string, args: readonly unknown[] = []): Promise<unknown> =>
    client.readContract({ address, abi, functionName, args, blockNumber } as Parameters<typeof client.readContract>[0])
  const expectEqual = async (name: string, expected: string, get: () => Promise<unknown>): Promise<void> => {
    try {
      const observed = String(await get())
      add({ name, status: same(observed, expected) ? "pass" : "fail", expected, observed })
    } catch (error) {
      add({ name, status: "fail", expected, observed: firstLine(error instanceof Error ? error.message : String(error)) })
    }
  }
  await expectEqual("BoostVoter.ve() == veMezo", c.veMezo, () => read(c.boostVoter, boostVoterAbi, "ve"))
  await expectEqual("BoostVoter.boostableVe() == veBtc", c.veBtc, () => read(c.boostVoter, boostVoterAbi, "boostableVe"))
  await expectEqual("veMezo.voter() == BoostVoter", c.boostVoter, () => read(c.veMezo, votingEscrowAbi, "voter"))
  await expectEqual("veBtc.booster() == BoostVoter", c.boostVoter, () => read(c.veBtc, votingEscrowAbi, "booster"))
  await expectEqual("veBtc.voter() == poolsVoter (not the boost path)", c.poolsVoter, () => read(c.veBtc, votingEscrowAbi, "voter"))
  await expectEqual("veMezo.isSecondaryVoter(thirdPartyVoter)", "true", () =>
    read(c.veMezo, votingEscrowAbi, "isSecondaryVoter", [c.thirdPartyVoter]),
  )
  await expectEqual("veMezo.name() == veMEZO", "veMEZO", () => read(c.veMezo, votingEscrowAbi, "name"))
  await expectEqual("veBtc.name() == veBTC", "veBTC", () => read(c.veBtc, votingEscrowAbi, "name"))
  await expectEqual("veMezo.token() == MEZO", t.mezo, () => read(c.veMezo, votingEscrowAbi, "token"))
  await expectEqual("veBtc.token() == BTC", t.btc, () => read(c.veBtc, votingEscrowAbi, "token"))
  await expectEqual("BoostVoter.factoryRegistry()", c.factoryRegistry, () => read(c.boostVoter, boostVoterAbi, "factoryRegistry"))
  await expectEqual("BoostVoter.forwarder()", c.forwarder, () => read(c.boostVoter, boostVoterAbi, "forwarder"))
  await expectEqual("BoostVoter.governor()", deployment.governance, () => read(c.boostVoter, boostVoterAbi, "governor"))
  await expectEqual("FactoryRegistry.isGaugeFactoryApproved(boostGaugeFactory)", "true", () =>
    read(c.factoryRegistry, factoryRegistryAbi, "isGaugeFactoryApproved", [c.boostGaugeFactory]),
  )
  await expectEqual("FactoryRegistry.gaugeFactoryToVotingRewardsFactory(boostGaugeFactory)", c.votingRewardsFactory, () =>
    read(c.factoryRegistry, factoryRegistryAbi, "gaugeFactoryToVotingRewardsFactory", [c.boostGaugeFactory]),
  )
  for (const [label, address, symbol] of [
    ["BTC", t.btc, "BTC"],
    ["MEZO", t.mezo, "MEZO"],
    ["MUSD", t.musd, "MUSD"],
  ] as const) {
    await expectEqual(`${label}.symbol()`, symbol, () => read(address, erc20Abi, "symbol"))
    await expectEqual(`${label}.decimals()`, "18", () => read(address, erc20Abi, "decimals"))
    await expectEqual(`BoostVoter.isWhitelistedToken(${label})`, "true", () => read(c.boostVoter, boostVoterAbi, "isWhitelistedToken", [address]))
  }
  await expectEqual("BoostVoter.maxVotingNum() == 30", "30", () => read(c.boostVoter, boostVoterAbi, "maxVotingNum"))

  // 4. Proxy implementations: a mismatch means Mezo upgraded since 2026-10-22; re-verify the ABI.
  for (const [name, expected] of Object.entries(deployment.implementations) as [keyof typeof deployment.implementations, Address][]) {
    const proxy = c[name]
    const slot = await client.getStorageAt({ address: proxy, slot: EIP1967_IMPLEMENTATION_SLOT, blockNumber })
    const observed = slot === undefined ? "none" : getAddress(`0x${slot.slice(-40)}`)
    add({ name: `${name} EIP-1967 implementation`, status: same(observed, expected) ? "pass" : "warn", expected, observed })
  }

  // 5. Multicall3 behaves like aggregate3 (one harmless view call).
  try {
    const [res] = await client.readContract({
      address: c.multicall3,
      abi: multicall3Abi,
      functionName: "aggregate3",
      args: [[{ target: c.boostVoter, allowFailure: true, callData: toFunctionSelector("length()") }]],
      blockNumber,
    })
    add({ name: "Multicall3.aggregate3 round trip", status: res?.success === true ? "pass" : "fail" })
  } catch (error) {
    add({ name: "Multicall3.aggregate3 round trip", status: "fail", observed: firstLine(String(error)) })
  }

  // 6. A live bribe contract: links back to BoostVoter/veMezo and contains every hand-written selector.
  try {
    const length = (await read(c.boostVoter, boostVoterAbi, "length")) as bigint
    if (length === 0n) {
      add({ name: "sample bribe", status: "warn", observed: "no gauges exist" })
    } else {
      const gauge = (await read(c.boostVoter, boostVoterAbi, "gauges", [length - 1n])) as Address
      const bribe = (await read(c.boostVoter, boostVoterAbi, "gaugeToBribe", [gauge])) as Address
      await expectEqual(`sample bribe ${bribe}.voter() == BoostVoter`, c.boostVoter, () => read(bribe, bribeVotingRewardAbi, "voter"))
      await expectEqual(`sample bribe ${bribe}.ve() == veMezo`, c.veMezo, () => read(bribe, bribeVotingRewardAbi, "ve"))
      const code = ((await client.getCode({ address: bribe, blockNumber })) ?? "0x").toLowerCase()
      const missing = bribeVotingRewardAbi
        .filter((e) => e.type === "function")
        .map((e) => toFunctionSelector(`${e.name}(${e.inputs.map((i) => i.type).join(",")})`))
        .filter((sel) => !code.includes(`63${sel.slice(2)}`))
      add({
        name: "sample bribe bytecode contains every bribeVotingRewardAbi selector",
        status: missing.length === 0 ? "pass" : "fail",
        observed: missing.length === 0 ? "all present" : `missing ${missing.join(",")}`,
      })
    }
  } catch (error) {
    add({ name: "sample bribe", status: "fail", observed: firstLine(String(error)) })
  }

  return {
    network,
    rpcUrl,
    expectedChainId: deployment.chainId,
    observedChainId,
    blockNumber,
    checks,
    ok: checks.every((x) => x.status !== "fail"),
  }
}

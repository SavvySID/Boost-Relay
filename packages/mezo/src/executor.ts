import {
  decodeErrorResult,
  decodeFunctionResult,
  encodeFunctionData,
  multicall3Abi,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem"

/** One read-only contract call, identified by a caller-chosen unique key. */
export interface ContractCall {
  readonly key: string
  readonly address: Address
  readonly abi: Abi
  readonly functionName: string
  readonly args?: readonly unknown[]
}

export type CallFailureKind = "reverted" | "decode" | "rpc"

export type CallResult =
  | { readonly key: string; readonly ok: true; readonly value: unknown }
  | { readonly key: string; readonly ok: false; readonly kind: CallFailureKind; readonly error: string }

export interface ExecuteOptions {
  /** Every call is evaluated at this block. */
  readonly blockNumber: bigint
  /** Maximum calls per aggregate3 request. */
  readonly chunkSize: number
}

export interface CallExecutor {
  /** Results are returned in the same order as `calls`. Never throws for per-call failures. */
  execute(calls: readonly ContractCall[], options: ExecuteOptions): Promise<CallResult[]>
}

export interface Aggregate3Call {
  readonly target: Address
  readonly allowFailure: boolean
  readonly callData: Hex
}

export interface Aggregate3Result {
  readonly success: boolean
  readonly returnData: Hex
}

/** Minimal transport: one Multicall3.aggregate3 eth_call at a block. Throws on RPC failure. */
export interface Aggregate3Transport {
  aggregate3(calls: readonly Aggregate3Call[], blockNumber: bigint): Promise<readonly Aggregate3Result[]>
}

/** aggregate3 over a viem PublicClient (read-only eth_call; nothing is signed or sent). */
export function viemAggregate3Transport(client: PublicClient, multicall3: Address): Aggregate3Transport {
  return {
    async aggregate3(calls, blockNumber) {
      return client.readContract({
        address: multicall3,
        abi: multicall3Abi,
        functionName: "aggregate3",
        args: [calls.map((c) => ({ target: c.target, allowFailure: c.allowFailure, callData: c.callData }))],
        blockNumber,
      })
    },
  }
}

export interface MulticallExecutorOptions {
  /** Chunks processed in parallel. */
  readonly concurrency?: number
  /** Retries for a single call whose chunk keeps failing at the transport level. */
  readonly singleCallRetries?: number
  readonly retryDelayMs?: number
  /** Injectable for tests. */
  readonly sleep?: (ms: number) => Promise<void>
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const short = (error as { shortMessage?: unknown }).shortMessage
    return typeof short === "string" ? short : error.message
  }
  return String(error)
}

function decodeRevert(abi: Abi, data: Hex): string {
  if (data === "0x") return "reverted without data"
  try {
    const decoded = decodeErrorResult({ abi, data })
    return decoded.args && decoded.args.length > 0
      ? `${decoded.errorName}(${decoded.args.map(String).join(", ")})`
      : decoded.errorName
  } catch {
    return `reverted with data ${data.slice(0, 10)}`
  }
}

/**
 * Splits calls into chunks of `chunkSize`, runs each as one aggregate3 (allowFailure = true) at the
 * pinned block, and decodes every result. If a whole chunk fails at the transport level (timeout,
 * "out of gas" for heavy views, rate limiting) it is split in halves and retried, down to single
 * calls, which get `singleCallRetries` attempts before being reported as an "rpc" failure.
 */
export function createMulticallExecutor(
  transport: Aggregate3Transport,
  options: MulticallExecutorOptions = {},
): CallExecutor {
  const concurrency = Math.max(1, options.concurrency ?? 3)
  const singleCallRetries = Math.max(0, options.singleCallRetries ?? 2)
  const retryDelayMs = options.retryDelayMs ?? 750
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  function encode(call: ContractCall): Aggregate3Call {
    return {
      target: call.address,
      allowFailure: true,
      callData: encodeFunctionData({
        abi: call.abi,
        functionName: call.functionName,
        args: call.args ?? [],
      } as Parameters<typeof encodeFunctionData>[0]),
    }
  }

  function decode(call: ContractCall, raw: Aggregate3Result): CallResult {
    if (!raw.success) return { key: call.key, ok: false, kind: "reverted", error: decodeRevert(call.abi, raw.returnData) }
    if (raw.returnData === "0x") {
      return { key: call.key, ok: false, kind: "decode", error: "empty return data (no contract code at target?)" }
    }
    try {
      const value = decodeFunctionResult({
        abi: call.abi,
        functionName: call.functionName,
        data: raw.returnData,
      } as Parameters<typeof decodeFunctionResult>[0])
      return { key: call.key, ok: true, value }
    } catch (error) {
      return { key: call.key, ok: false, kind: "decode", error: errorMessage(error) }
    }
  }

  async function runChunk(chunk: readonly ContractCall[], encoded: readonly Aggregate3Call[], blockNumber: bigint): Promise<CallResult[]> {
    const attempts = chunk.length === 1 ? singleCallRetries + 1 : 1
    let lastError: unknown
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const raw = await transport.aggregate3(encoded, blockNumber)
        if (raw.length !== chunk.length) throw new Error(`aggregate3 returned ${raw.length} results for ${chunk.length} calls`)
        return chunk.map((call, i) => decode(call, raw[i] as Aggregate3Result))
      } catch (error) {
        lastError = error
        if (attempt + 1 < attempts) await sleep(retryDelayMs * (attempt + 1))
      }
    }
    if (chunk.length > 1) {
      const mid = Math.ceil(chunk.length / 2)
      const left = await runChunk(chunk.slice(0, mid), encoded.slice(0, mid), blockNumber)
      const right = await runChunk(chunk.slice(mid), encoded.slice(mid), blockNumber)
      return [...left, ...right]
    }
    const only = chunk[0] as ContractCall
    return [{ key: only.key, ok: false, kind: "rpc", error: errorMessage(lastError) }]
  }

  return {
    async execute(calls, { blockNumber, chunkSize }) {
      if (!Number.isInteger(chunkSize) || chunkSize < 1) throw new RangeError(`chunkSize must be a positive integer, got ${chunkSize}`)
      const keys = new Set<string>()
      for (const call of calls) {
        if (keys.has(call.key)) throw new Error(`duplicate call key ${call.key}`)
        keys.add(call.key)
      }
      const encoded = calls.map(encode)
      const chunks: { start: number; end: number }[] = []
      for (let start = 0; start < calls.length; start += chunkSize) chunks.push({ start, end: Math.min(start + chunkSize, calls.length) })
      const results: CallResult[][] = new Array(chunks.length)
      let next = 0
      async function worker(): Promise<void> {
        while (next < chunks.length) {
          const index = next++
          const { start, end } = chunks[index] as { start: number; end: number }
          results[index] = await runChunk(calls.slice(start, end), encoded.slice(start, end), blockNumber)
        }
      }
      await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, worker))
      return results.flat()
    },
  }
}

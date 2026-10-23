"use client"

/**
 * Votes this browser tab has sent, so a second vote for the same NFT and epoch cannot be prepared
 * while the first one's outcome is still unknown (for example after a receipt timeout). Kept in
 * memory and mirrored to sessionStorage when available; it is a guard against accidental resends,
 * not a source of truth: the chain's lastVoted check still decides eligibility on the server.
 */
export type SentStatus = "unresolved" | "confirmed" | "reverted" | "mismatch"

export interface SentVote {
  readonly tokenId: string
  readonly epochStart: string
  readonly hash: string
  readonly account: string
  readonly to: string
  readonly calldata: string
  readonly status: SentStatus
  readonly sentAt: number
}

const STORAGE_KEY = "boost-relay.sent-votes.v1"
const memory = new Map<string, SentVote>()
let loaded = false

const keyOf = (tokenId: string, epochStart: string) => `${tokenId}:${epochStart}`

function load(): void {
  if (loaded) return
  loaded = true
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const list = JSON.parse(raw) as unknown
    if (!Array.isArray(list)) return
    for (const v of list) {
      if (v && typeof v === "object" && typeof v.tokenId === "string" && typeof v.epochStart === "string" && typeof v.hash === "string") {
        memory.set(keyOf(v.tokenId, v.epochStart), v as SentVote)
      }
    }
  } catch {
    // Storage blocked or unreadable: the in-memory record still guards this page.
  }
}

function persist(): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...memory.values()]))
  } catch {
    // Ignore: private mode or blocked storage.
  }
}

export function recordSentVote(vote: SentVote): void {
  load()
  memory.set(keyOf(vote.tokenId, vote.epochStart), vote)
  persist()
}

export function updateSentVote(tokenId: string, epochStart: string, status: SentStatus): void {
  load()
  const current = memory.get(keyOf(tokenId, epochStart))
  if (current === undefined) return
  memory.set(keyOf(tokenId, epochStart), { ...current, status })
  persist()
}

/** The vote sent for this NFT in this epoch whose outcome is not yet known, if any. */
export function unresolvedSentVote(tokenId: string, epochStart: string): SentVote | null {
  load()
  const v = memory.get(keyOf(tokenId, epochStart))
  return v !== undefined && v.status === "unresolved" ? v : null
}

/** Test hook. */
export function clearSentVotes(): void {
  memory.clear()
  loaded = true
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore.
  }
}

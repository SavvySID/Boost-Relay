import type { PositionDto } from "./market-dto"

/**
 * Client-side views over one snapshot. Filtering, searching and sorting never trigger a new read.
 *
 * - "below-cap": active positions under 5x (includes those with no votes)
 * - "no-votes": active positions with zero gauge weight
 * - "at-cap": active positions at exactly 5x
 * - "inactive": anything not active (expired lock, no power, no lock, killed gauge)
 * - "with-incentives": active positions whose gauge has a non-zero incentive posted this epoch
 */
export type PositionFilter = "all" | "below-cap" | "no-votes" | "at-cap" | "with-incentives" | "inactive"
export type SortKey = "votes" | "boost" | "to-max" | "expiry"
export type SortDirection = "asc" | "desc"

export const FILTERS: readonly { readonly id: PositionFilter; readonly label: string }[] = [
  { id: "all", label: "All" },
  { id: "below-cap", label: "Below 5x" },
  { id: "no-votes", label: "No votes" },
  { id: "at-cap", label: "At 5x" },
  { id: "with-incentives", label: "With incentives" },
  { id: "inactive", label: "Expired or inactive" },
]

export const SORTS: readonly { readonly id: SortKey; readonly label: string }[] = [
  { id: "votes", label: "Votes" },
  { id: "boost", label: "Live boost" },
  { id: "to-max", label: "Votes needed for 5x" },
  { id: "expiry", label: "Lock expiry" },
]

export function matchesFilter(p: PositionDto, filter: PositionFilter): boolean {
  const active = p.status === "active"
  switch (filter) {
    case "all":
      return true
    case "below-cap":
      return active && !p.atCap
    case "no-votes":
      return active && p.gaugeWeight === "0"
    case "at-cap":
      return active && p.atCap
    case "with-incentives":
      return active && p.incentives.status === "posted" && p.incentives.tokens.some((t) => t.postedForEpoch !== "0")
    case "inactive":
      return !active
  }
}

/** One-click views for "where would another vote actually help?". */
export const PRESETS: readonly { readonly id: string; readonly label: string; readonly filter: PositionFilter; readonly sortKey: SortKey; readonly sortDirection: SortDirection }[] = [
  { id: "closest", label: "Closest to 5x", filter: "below-cap", sortKey: "to-max", sortDirection: "asc" },
  { id: "lowest", label: "Lowest boost", filter: "below-cap", sortKey: "boost", sortDirection: "asc" },
  { id: "most-needed", label: "Needs the most votes", filter: "below-cap", sortKey: "to-max", sortDirection: "desc" },
  { id: "incentives", label: "Posted incentives", filter: "with-incentives", sortKey: "to-max", sortDirection: "asc" },
]

export function filterCounts(positions: readonly PositionDto[]): Record<PositionFilter, number> {
  const counts: Record<PositionFilter, number> = { all: 0, "below-cap": 0, "no-votes": 0, "at-cap": 0, "with-incentives": 0, inactive: 0 }
  for (const p of positions) for (const f of FILTERS) if (matchesFilter(p, f.id)) counts[f.id]++
  return counts
}

/** Token id (exact or prefix) or any part of the gauge, owner or bribe address, case-insensitive. */
export function matchesSearch(p: PositionDto, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^#/, "")
  if (q === "") return true
  if (/^\d+$/.test(q)) return p.tokenId.startsWith(q)
  return [p.gauge, p.owner, p.bribe].some((a) => a !== null && a.toLowerCase().includes(q))
}

/** Sort value as bigint; null sorts last in either direction ("not applicable"). */
function sortValue(p: PositionDto, key: SortKey): bigint | null {
  switch (key) {
    case "votes":
      return BigInt(p.gaugeWeight)
    case "boost":
      return BigInt(p.liveBoost)
    case "to-max": {
      if (p.status !== "active") return null
      const five = p.targets["5x"]
      return five.reachable ? BigInt(five.additionalWeight) : null
    }
    case "expiry":
      return p.lock.isPermanent ? null : BigInt(p.lock.end)
  }
}

export function sortPositions(positions: readonly PositionDto[], key: SortKey, direction: SortDirection): PositionDto[] {
  const sign = direction === "asc" ? 1 : -1
  return [...positions].sort((a, b) => {
    const va = sortValue(a, key)
    const vb = sortValue(b, key)
    if (va === null || vb === null) {
      if (va === vb) return compareIds(a, b)
      return va === null ? 1 : -1
    }
    if (va !== vb) return va < vb ? -sign : sign
    return compareIds(a, b)
  })
}

function compareIds(a: PositionDto, b: PositionDto): number {
  const x = BigInt(a.tokenId)
  const y = BigInt(b.tokenId)
  return x < y ? -1 : x > y ? 1 : 0
}

export function viewPositions(
  positions: readonly PositionDto[],
  options: { readonly filter: PositionFilter; readonly query: string; readonly sortKey: SortKey; readonly sortDirection: SortDirection },
): PositionDto[] {
  return sortPositions(
    positions.filter((p) => matchesFilter(p, options.filter) && matchesSearch(p, options.query)),
    options.sortKey,
    options.sortDirection,
  )
}

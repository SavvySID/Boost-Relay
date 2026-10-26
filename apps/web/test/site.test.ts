import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { FAQ } from "@/lib/faq"
import { NAV, isActive } from "@/lib/site"

const root = join(__dirname, "..")

function sources(...dirs: string[]): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|tsx)$/.test(name)) out.push(p)
    }
  }
  for (const d of dirs) walk(join(root, d))
  return out
}

describe("site navigation", () => {
  it("lists Home, Boost Market, Vote Optimizer, Vault Relay and FAQ, all internal", () => {
    expect(NAV.map((n) => [n.label, n.href])).toEqual([
      ["Home", "/"],
      ["Boost Market", "/market"],
      ["Vote Optimizer", "/optimizer"],
      ["Vault Relay", "/vault"],
      ["FAQ", "/#faq"],
    ])
    for (const n of NAV) expect(n.href.startsWith("/")).toBe(true)
  })

  it("points every route at a real page", () => {
    for (const n of NAV) {
      const path = n.href.split("#")[0] ?? "/"
      const file = path === "/" ? "app/page.tsx" : `app${path}/page.tsx`
      expect(existsSync(join(root, file)), file).toBe(true)
    }
  })

  it("marks exactly the current route active", () => {
    expect(NAV.filter((n) => isActive(n.href, "/")).map((n) => n.label)).toEqual(["Home"])
    expect(NAV.filter((n) => isActive(n.href, "/market")).map((n) => n.label)).toEqual(["Boost Market"])
    expect(NAV.filter((n) => isActive(n.href, "/optimizer")).map((n) => n.label)).toEqual(["Vote Optimizer"])
    expect(NAV.filter((n) => isActive(n.href, "/vault")).map((n) => n.label)).toEqual(["Vault Relay"])
    expect(NAV.filter((n) => isActive(n.href, "/vaults")).map((n) => n.label)).toEqual([])
  })

  it("no longer links out to the Mezo app", () => {
    const offenders = sources("app", "components", "lib").filter((f) => /Open the Mezo app|https:\/\/(testnet\.)?mezo\.org/.test(readFileSync(f, "utf8")))
    expect(offenders).toEqual([])
  })
})

describe("FAQ content", () => {
  it("has thirteen distinct questions", () => {
    expect(FAQ).toHaveLength(13)
    expect(new Set(FAQ.map((f) => f.id)).size).toBe(13)
    expect(new Set(FAQ.map((f) => f.question)).size).toBe(13)
  })

  it("is explicit about what is not live or not guaranteed", () => {
    const answer = (id: string) => FAQ.find((f) => f.id === id)?.answer ?? ""
    expect(answer("vault")).toMatch(/not live/)
    expect(answer("vault")).toMatch(/no deposits/)
    expect(answer("networks")).toMatch(/Mezo Testnet only/)
    expect(answer("auto-vote")).toMatch(/^No\./)
    expect(answer("official")).toMatch(/not affiliated with, endorsed by or operated by Mezo/)
    expect(answer("incentives")).toMatch(/^No\./)
    expect(answer("advice")).toMatch(/^No\./)
    expect(answer("applied")).toMatch(/does not call that update/)
    expect(answer("above-cap")).toMatch(/^Not necessarily/)
    expect(answer("business")).toMatch(/not live/)
    expect(answer("business")).toMatch(/no fee and no token/)
  })
})

describe("marketing pages", () => {
  const marketing = [...sources("components/home", "components/site"), join(root, "app/page.tsx"), join(root, "app/vault/page.tsx")]

  it("contain no wallet or transaction code", () => {
    // The site header renders the existing wallet button on app pages only; nothing else may.
    for (const f of marketing.filter((f) => !f.endsWith("site-header.tsx"))) {
      const text = readFileSync(f, "utf8")
      expect(text, f).not.toMatch(/wallet\/|vote-flow|eth_|sendTransaction|writeContract|\/api\/vote/)
    }
  })

  it("never hard-code market statistics from earlier snapshots", () => {
    for (const f of marketing) expect(readFileSync(f, "utf8"), f).not.toMatch(/29\.4|17\.5\s?M|59\.5\s?M|\b105 at\b|\b165 active\b/)
  })

  it("give Vault Relay no inputs, forms or deposit actions", () => {
    const vault = readFileSync(join(root, "app/vault/page.tsx"), "utf8")
    expect(vault).not.toMatch(/<input|<form|<button|onClick|"use client"/)
    expect(vault).toMatch(/Vault Relay is not live\./)
  })
})

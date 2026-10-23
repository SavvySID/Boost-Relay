"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import type { NetworkName } from "@/lib/market-dto"
import { amount, boost, integer, relativeAge, short, utcDateTime } from "@/lib/market-formatting"
import type { OptimizerDto } from "@/lib/optimizer-dto"
import { chip, ui } from "@/lib/ui"
import { ACKNOWLEDGEMENTS } from "@/lib/vote-copy"
import type { PreparedVote, VoteGate } from "@/lib/vote-dto"
import { TESTNET_CHAIN_ID } from "@/lib/wallet/actions"
import { httpVoteApi, invalidationReason, prepareVote, preflight, submitVote, type FlowState, type VoteApi } from "@/lib/wallet/vote-flow"
import { chainLabel } from "../wallet/wallet-button"
import { useWallet } from "../wallet/wallet-provider"
import type { Strategy } from "./strategy-selector"

function Row({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3 border-b border-line py-2.5 text-sm last:border-b-0 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <dt className="text-fg-2">{label}</dt>
      <dd className="num min-w-0 break-words font-medium text-fg">{children}</dd>
    </div>
  )
}

function Notice({ tone, title, children }: { readonly tone: "info" | "warn" | "danger" | "success"; readonly title: string; readonly children?: ReactNode }) {
  const bg = { info: "bg-info-bg text-info-fg", warn: "bg-warn-bg text-warn-fg", danger: "bg-danger-bg text-danger-fg", success: "bg-success-bg text-success-fg" }[tone]
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-[var(--radius-md)] px-4 py-3 text-sm ${bg}`}>
      <p className="font-medium">{title}</p>
      {children ? <div className="mt-1 leading-relaxed">{children}</div> : null}
    </div>
  )
}

function Gates({ gates }: { readonly gates: readonly VoteGate[] }) {
  return (
    <ul className="grid gap-1.5 text-sm">
      {gates.map((g) => (
        <li key={g.id} className="flex items-start gap-2">
          <span className={chip(g.ok ? "success" : "danger")}>{g.ok ? "Pass" : "Fail"}</span>
          <span className="text-fg">
            {g.label} <span className="text-fg-3">{g.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function TxLink({ explorerUrl, hash }: { readonly explorerUrl: string; readonly hash: string }) {
  return (
    <a href={`${explorerUrl}/tx/${hash}`} target="_blank" rel="noreferrer" className={`num break-all ${ui.link}`}>
      {hash}
    </a>
  )
}

/**
 * Two-stage, owner-signed voting on Mezo Testnet. Stage A prepares and simulates on the server
 * (read-only). Stage B asks the wallet to sign only after the user clicks "Sign & Submit Vote".
 */
export function VotePanel(props: {
  readonly data: OptimizerDto
  readonly strategy: Strategy
  readonly network: NetworkName
  readonly onRefresh: (network: NetworkName, tokenId: string) => Promise<void>
}) {
  const { data, strategy, network } = props
  const w = useWallet()
  const [flow, setFlow] = useState<FlowState>({ kind: "idle" })
  const [acknowledged, setAcknowledged] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const busy = useRef(false)
  const onRefresh = props.onRefresh
  const api: VoteApi = httpVoteApi(onRefresh)
  const walletSnapshot = { account: w.account, chainId: w.chainId }

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5_000)
    return () => window.clearInterval(id)
  }, [])

  // A prepared vote is tied to one account, chain, token and strategy. Any change invalidates it.
  const preparedKey = `${data.token.tokenId}|${strategy}|${network}`
  const lastKey = useRef(preparedKey)
  useEffect(() => {
    if (lastKey.current !== preparedKey) {
      lastKey.current = preparedKey
      setFlow({ kind: "idle" })
      setAcknowledged(false)
    }
  }, [preparedKey])
  useEffect(() => {
    setFlow((f) => {
      if (f.kind !== "ready" && f.kind !== "simulation-failed" && f.kind !== "rejected") return f
      const reason = invalidationReason(f.prepared, { account: w.account, chainId: w.chainId }, Date.now())
      return reason === null ? f : { kind: "invalidated", reason }
    })
  }, [w.account, w.chainId, now])

  const prepare = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setAcknowledged(false)
    setFlow({ kind: "preparing" })
    try {
      setFlow(await prepareVote({ api }, { network, tokenId: data.token.tokenId, strategy, wallet: { account: w.account, chainId: w.chainId } }))
    } finally {
      busy.current = false
    }
    // api is rebuilt per render from the stable onRefresh, so these inputs fully determine the call.
  }, [network, data.token.tokenId, strategy, w.account, w.chainId, onRefresh])

  const signAndSubmit = useCallback(
    async (prepared: PreparedVote) => {
      if (busy.current || !acknowledged || w.wallet === null) return
      busy.current = true
      try {
        const final = await submitVote(
          { provider: w.wallet.provider, api, now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)), onState: setFlow },
          prepared,
        )
        setFlow(final)
      } finally {
        busy.current = false
        setAcknowledged(false)
      }
    },
    [acknowledged, w.wallet, onRefresh],
  )

  const rec = data.recommendations[strategy]
  const blocked = preflight(network, walletSnapshot)
  const ownerMismatch = w.account !== null && data.token.owner.toLowerCase() !== w.account.toLowerCase()
  const notes: string[] = []
  if (ownerMismatch) notes.push(`The connected account does not own veMEZO #${data.token.tokenId} (owner ${short(data.token.owner)}). Only the owner can vote in this version.`)
  if (!data.token.canVoteThisEpoch) notes.push("This NFT cannot vote right now (already voted this epoch or outside the voting window). The recommendation is for analysis only.")
  if (rec.status !== "actionable") notes.push("The selected strategy has no actionable recommendation for this NFT.")
  const canPrepare = blocked === null && notes.length === 0

  const inStageA = ["idle", "invalidated", "ineligible", "prepare-failed", "preparing", "mainnet-disabled", "disconnected", "wrong-network"].includes(flow.kind)

  return (
    <section aria-labelledby="vote-title" className={`${ui.card} ${ui.cardBody} grid grid-cols-[minmax(0,1fr)] gap-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="vote-title" className="text-lg font-medium tracking-tight text-fg">
            Vote with your wallet
          </h3>
          <p className="mt-0.5 text-xs text-fg-3">Your wallet signs directly with BoostVoter. Boost Relay never holds your NFT, MEZO, BTC or MUSD.</p>
        </div>
        <span className={chip("info")}>Testnet beta</span>
      </div>

      {network !== "testnet" ? (
        <Notice tone="info" title="Voting is disabled on Mezo Mainnet during the testnet beta">
          The market and recommendations stay available. Switch the site to Mezo Testnet to try owner-signed voting.
        </Notice>
      ) : blocked?.kind === "disconnected" ? (
        <div className="grid gap-3">
          <Notice tone="info" title="Connect a wallet to vote">
            Connect the wallet that owns veMEZO #{data.token.tokenId}. Connecting only shares your public address; it does not sign anything.
          </Notice>
          {w.wallets.length === 0 ? (
            <p className="text-sm text-fg-2">No browser wallet was found. Install MetaMask, Rabby or another EVM wallet extension, then reload.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {w.wallets.map((d) => (
                <button key={d.info.uuid} type="button" onClick={() => void w.connect(d.info.uuid)} disabled={w.status === "connecting"} className={ui.btnPrimary}>
                  {w.status === "connecting" ? "Check your wallet…" : `Connect ${d.info.name}`}
                </button>
              ))}
            </div>
          )}
          {w.error ? <p className="text-sm text-danger-fg">{w.error}</p> : null}
        </div>
      ) : blocked?.kind === "wrong-network" ? (
        <div className="grid gap-3">
          <Notice tone="warn" title={`Your wallet is on ${chainLabel(blocked.chainId)}`}>
            The site shows Mezo Testnet, but the wallet decides where a transaction goes. Voting needs the wallet on Mezo Testnet (chain {TESTNET_CHAIN_ID}).
          </Notice>
          <div>
            <button type="button" onClick={() => void w.switchToTestnet()} className={ui.btnPrimary}>
              Switch wallet to Mezo Testnet
            </button>
          </div>
          {w.error ? <p className="text-sm text-danger-fg">{w.error}</p> : null}
        </div>
      ) : null}

      {network === "testnet" && blocked === null && inStageA ? (
        <div className="grid gap-4">
          <dl>
            <Row label="Network">Mezo Testnet (chain {w.chainId})</Row>
            <Row label="Connected wallet">{w.account}</Row>
            <Row label="veMEZO">
              #{data.token.tokenId}, {amount(data.token.votingPower, 18, 4)} veMEZO voting power
            </Row>
            <Row label="Voting window">
              {utcDateTime(data.epoch.voteStart)} to {utcDateTime(data.epoch.voteEnd)}
            </Row>
            <Row label="Vote status">{data.token.canVoteThisEpoch ? "Can vote this epoch" : "Cannot vote this epoch"}</Row>
            <Row label="Strategy">{data.strategies[strategy].label}</Row>
            <Row label="Proposed gauges">
              {rec.lines.length} {rec.lines.length === 1 ? "gauge" : "gauges"}
              {rec.summary ? `, ${rec.summary.positionsReaching5x} reaching 5x` : ""}
            </Row>
            <Row label="Votes replaced">
              {data.token.allocation.entries.length === 0 ? "None (no existing boost votes)" : `${data.token.allocation.entries.length} existing votes, ${rec.summary?.positionsLosingBoost ?? 0} positions lose boost`}
            </Row>
            <Row label="Data">
              Block {integer(data.sourceBlock)}, block time {relativeAge(data.blockTimestamp, now)}
            </Row>
          </dl>
          {notes.length > 0 ? (
            <Notice tone="warn" title="Voting is not available for this NFT and account">
              <ul className="list-disc space-y-1 pl-5">
                {notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </Notice>
          ) : null}
          {flow.kind === "invalidated" ? <Notice tone="warn" title="The prepared vote is no longer valid">{flow.reason}</Notice> : null}
          {flow.kind === "prepare-failed" ? <Notice tone="danger" title="Preparation failed">{flow.message} Nothing was sent.</Notice> : null}
          {flow.kind === "ineligible" ? (
            <Notice tone="danger" title="This vote cannot be prepared">
              <p>{flow.message}</p>
              <div className="mt-3">
                <Gates gates={flow.gates} />
              </div>
            </Notice>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void prepare()} disabled={!canPrepare || flow.kind === "preparing"} className={ui.btnPrimary}>
              {flow.kind === "preparing" ? "Preparing and simulating…" : "Prepare & simulate vote"}
            </button>
            <p className="text-xs text-fg-3">Reads fresh chain data, recomputes the plan and simulates it as your account. Nothing is signed or sent.</p>
          </div>
        </div>
      ) : null}

      {flow.kind === "ready" || flow.kind === "checking" || flow.kind === "awaiting-signature" || flow.kind === "simulation-failed" || flow.kind === "rejected" ? (
        <ReviewStage
          prepared={flow.prepared}
          flow={flow}
          explorerUrl={data.explorerUrl}
          now={now}
          acknowledged={acknowledged}
          onAcknowledge={setAcknowledged}
          onSubmit={() => void signAndSubmit(flow.prepared)}
          onCancel={() => setFlow({ kind: "idle" })}
          onPrepareAgain={() => void prepare()}
        />
      ) : null}

      {flow.kind === "submit-failed" ? (
        <div className="grid gap-3">
          <Notice tone="danger" title="The transaction was not sent">{flow.message}</Notice>
          <button type="button" onClick={() => setFlow({ kind: "idle" })} className={`${ui.btnSecondary} justify-self-start`}>
            Start over
          </button>
        </div>
      ) : null}

      {flow.kind === "pending" ? (
        <Notice tone="info" title="Transaction sent. Waiting for it to be included…">
          <p>Not confirmed yet. Transaction:</p>
          <TxLink explorerUrl={data.explorerUrl} hash={flow.hash} />
        </Notice>
      ) : null}
      {flow.kind === "reverted" ? (
        <Notice tone="danger" title="The transaction reverted">
          <p>It was included{flow.blockNumber ? ` in block ${integer(flow.blockNumber)}` : ""} but failed, so no vote was recorded.</p>
          <TxLink explorerUrl={data.explorerUrl} hash={flow.hash} />
        </Notice>
      ) : null}
      {flow.kind === "receipt-unknown" ? (
        <Notice tone="warn" title="Receipt not available yet">
          <p>{flow.message}</p>
          <TxLink explorerUrl={data.explorerUrl} hash={flow.hash} />
        </Notice>
      ) : null}
      {flow.kind === "confirmed" || flow.kind === "refresh-failed" ? (
        <div className="grid gap-3">
          <Notice tone="success" title={`Vote confirmed${flow.blockNumber ? ` in block ${integer(flow.blockNumber)}` : ""}`}>
            <TxLink explorerUrl={data.explorerUrl} hash={flow.hash} />
            <p className="mt-2">
              The token card and recommendation above now read the new allocation from the chain. Live boost reflects the vote; the boost applied to each veBTC stays
              as it was until someone calls the permissionless pokeBoost. No incentive amount or reward is implied.
            </p>
          </Notice>
          {flow.kind === "refresh-failed" ? <Notice tone="warn" title="The data refresh after the vote failed">{flow.message} Use Recalculate to read the chain again.</Notice> : null}
        </div>
      ) : null}
    </section>
  )
}

function ReviewStage(props: {
  readonly prepared: PreparedVote
  readonly flow: FlowState
  readonly explorerUrl: string
  readonly now: number
  readonly acknowledged: boolean
  readonly onAcknowledge: (v: boolean) => void
  readonly onSubmit: () => void
  readonly onCancel: () => void
  readonly onPrepareAgain: () => void
}) {
  const p = props.prepared
  const lines = p.recommendation.lines
  const secondsLeft = Math.max(0, Math.floor((Date.parse(p.expiresAt) - props.now) / 1000))
  const busy = props.flow.kind === "checking" || props.flow.kind === "awaiting-signature"
  const [showData, setShowData] = useState(false)
  return (
    <div className="grid gap-4" aria-labelledby="review-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 id="review-title" className="text-base font-medium text-fg">
          Review the exact transaction
        </h4>
        <span className={chip(secondsLeft > 0 ? "success" : "warn")}>{secondsLeft > 0 ? `Simulation passed, valid for ${secondsLeft}s` : "Expired, prepare again"}</span>
      </div>
      <dl>
        <Row label="Network">Mezo Testnet (chain {p.chainId})</Row>
        <Row label="From (your wallet)">{p.account}</Row>
        <Row label="Contract (BoostVoter)">{p.to}</Row>
        <Row label="Method">
          <span className="font-mono text-[13px]">{p.signature}</span>
        </Row>
        <Row label="Token ID">#{p.tokenId}</Row>
        <Row label="Simulated">
          As your account at block {integer(p.simulation.blockNumber)}; data from block {integer(p.sourceBlock)}
        </Row>
      </dl>

      <div>
        <p className="text-sm font-medium text-fg">Gauges and weights ({p.gauges.length})</p>
        <ul className="mt-2 grid gap-2">
          {p.gauges.map((g, i) => {
            const line = lines.find((l) => l.gauge.toLowerCase() === g.toLowerCase())
            return (
              <li key={g} className="grid gap-1 rounded-[var(--radius-md)] border border-line px-3.5 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <span className="min-w-0">
                  <span className="font-medium text-fg">{p.gaugeTokenIds[i] ? `veBTC #${p.gaugeTokenIds[i]}` : "Gauge"}</span>{" "}
                  <span className="num break-all text-xs text-fg-3">{g}</span>
                </span>
                <span className="num text-fg-2 sm:text-right">
                  weight <span className="font-medium text-fg">{p.weights[i]}</span>
                  <span className="block text-xs text-fg-3">
                    = {amount(p.weights[i] ?? "0", 18, 4)} veMEZO
                    {line ? `; projected live boost ${boost(line.currentBoost)} to ${boost(line.projectedBoost)}` : ""}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-fg-3">
          Weights are relative. BoostVoter gives each gauge floor(weight x your voting power / sum of weights); these sum to your power at the source block, so
          each gauge gets its weight in veMEZO. Projected values are live boost; the boost applied on veBTC updates after a pokeBoost.
        </p>
      </div>

      {p.existingVotes.length > 0 ? (
        <div className="text-sm">
          <p className="font-medium text-fg">Existing votes that will be replaced</p>
          <ul className="num mt-1 grid gap-1 text-fg-2">
            {p.existingVotes.map((e) => (
              <li key={e.gauge}>
                {e.tokenId ? `veBTC #${e.tokenId}` : short(e.gauge)}: {amount(e.votes, 18, 4)} veMEZO
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-fg-2">This NFT has no existing boost votes, so nothing is replaced.</p>
      )}

      <div>
        <button type="button" onClick={() => setShowData((v) => !v)} aria-expanded={showData} className={ui.btnQuiet}>
          {showData ? "Hide" : "Show"} calldata
        </button>
        {showData ? <p className="mt-2 max-h-32 overflow-y-auto break-all rounded-[var(--radius-sm)] bg-subtle p-2 font-mono text-xs text-fg-2">{p.calldata}</p> : null}
      </div>

      {props.flow.kind === "simulation-failed" ? (
        <Notice tone="danger" title="The final simulation failed, so nothing was sent">
          {props.flow.message}
        </Notice>
      ) : null}
      {props.flow.kind === "rejected" ? <Notice tone="warn" title="You rejected the transaction in your wallet">Nothing was sent. You can sign again or start over.</Notice> : null}
      {props.flow.kind === "checking" ? <Notice tone="info" title="Re-checking your wallet and simulating once more…" /> : null}
      {props.flow.kind === "awaiting-signature" ? <Notice tone="info" title="Confirm the transaction in your wallet">The wallet shows the final gas cost. Nothing is sent until you approve it there.</Notice> : null}

      <fieldset className="rounded-[var(--radius-md)] bg-warm px-4 py-3">
        <legend className="sr-only">Confirm you understand this vote</legend>
        <ul className="grid gap-1.5 text-sm leading-relaxed text-fg-body">
          {ACKNOWLEDGEMENTS.map((a) => (
            <li key={a} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-fg" />
              {a}
            </li>
          ))}
        </ul>
        <label className="mt-3 flex items-start gap-2.5 text-sm font-medium text-fg">
          <input type="checkbox" checked={props.acknowledged} onChange={(e) => props.onAcknowledge(e.target.checked)} disabled={busy || secondsLeft === 0} className="mt-0.5 size-4 accent-black" />
          I have reviewed this vote and understand the points above.
        </label>
        <p className="mt-2 text-xs text-fg-3">A passing simulation is not a guarantee: chain state can change before the transaction is included.</p>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        {props.flow.kind === "simulation-failed" || secondsLeft === 0 ? (
          <button type="button" onClick={props.onPrepareAgain} className={ui.btnPrimary}>
            Prepare again
          </button>
        ) : (
          <button type="button" onClick={props.onSubmit} disabled={!props.acknowledged || busy || secondsLeft === 0} className={ui.btnPrimary}>
            {props.flow.kind === "awaiting-signature" ? "Waiting for your wallet…" : props.flow.kind === "checking" ? "Checking…" : "Sign & Submit Vote"}
          </button>
        )}
        <button type="button" onClick={props.onCancel} disabled={busy} className={ui.btnSecondary}>
          Cancel
        </button>
      </div>
    </div>
  )
}

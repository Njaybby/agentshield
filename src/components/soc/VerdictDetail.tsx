"use client";

import { useEffect, useMemo, useState } from "react";
import type { Check, TraceStep, Verdict } from "@/lib/types";
import { StatusTag, decisionBg, decisionBorder, decisionText } from "@/components/DecisionBadge";
import { ExtLink, JsonBlock, Label, Panel } from "./Panel";
import { ReviewControls } from "./ReviewControls";
import { addressUrl, clock, formatEth, ms, networkLabel, short } from "@/lib/format";

const SEV_RANK: Record<Check["severity"], number> = { critical: 0, high: 1, medium: 2, info: 3 };
const SEV_CLASS: Record<Check["severity"], string> = {
  critical: "text-block",
  high: "text-[#f87171]",
  medium: "text-quarantine",
  info: "text-mute",
};

const seenTraces = new Set<string>();

export function VerdictDrawer({
  verdict,
  onClose,
  onUpdate,
}: {
  verdict: Verdict | null;
  onClose: () => void;
  onUpdate: (v: Verdict) => void;
}) {
  useEffect(() => {
    if (!verdict) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [verdict, onClose]);

  if (!verdict) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Verdict detail">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="drawer-in relative h-full w-full max-w-[980px] overflow-y-auto border-l border-line-strong bg-canvas">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-canvas/95 px-4 py-2 backdrop-blur">
          <span className="terminal-header truncate">FDR-V · VERDICT DETAIL · {verdict.id}</span>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 whitespace-nowrap border border-line-strong px-2.5 py-1 font-mono text-[11px] tracking-wider text-mute hover:text-ink"
          >
            ESC ✕
          </button>
        </div>
        <div className="p-3 md:p-4">
          <VerdictDetail key={verdict.id} verdict={verdict} onUpdate={onUpdate} />
        </div>
      </div>
    </div>
  );
}

export function VerdictDetail({ verdict: v, onUpdate }: { verdict: Verdict; onUpdate: (v: Verdict) => void }) {
  const failing = v.gate1.checks.filter((c) => !c.passed).length;
  return (
    <div className="space-y-3">
      {/* Decision hero */}
      <section className={`relative overflow-hidden border ${decisionBorder[v.decision]} bg-panel`}>
        <div className={`absolute inset-y-0 left-0 w-1 ${decisionBg[v.decision]}`} aria-hidden />
        <div className="terminal-header flex flex-wrap gap-x-3 gap-y-1 border-b border-line px-5 py-1.5">
          <span className="text-ink">FDR-01</span>
          <span>VERDICT</span>
          <span>CH {v.chain.chain_id}</span>
          <span>{clock(v.ts)}</span>
          <span>{v.agent_id}</span>
          {v.scenario_id && <span>{v.scenario_id}</span>}
        </div>
        <div className="grid gap-4 px-5 py-5 md:grid-cols-[auto_1fr] md:items-start md:gap-8">
          <div>
            <div className={`font-mono text-4xl font-semibold tracking-[0.08em] md:text-5xl ${decisionText[v.decision]} ${v.decision === "BLOCK" ? "pulse-block" : ""}`}>
              {v.decision}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusTag status={v.status} />
              <span className="border border-line-strong px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] text-mute">
                {v.mode === "agent" ? "AGENT · STRANDS" : "FAST · DETERMINISTIC"}
              </span>
            </div>
          </div>
          <div>
            <p className="text-[15px] leading-relaxed text-ink">{v.operator_summary}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[11px] sm:grid-cols-4">
              <Stat k="latency" val={ms(v.latency_ms)} />
              <Stat k="gate1 fails" val={`${failing}/${v.gate1.checks.length}`} warn={failing > 0} />
              <Stat k="hijack" val={`${Math.round(v.gate2.hijack_likelihood * 100)}%`} warn={v.gate2.hijack_likelihood >= 0.5} />
              <Stat k="engine" val={v.engine} />
            </dl>
          </div>
        </div>
        {(v.status === "pending_review" || v.review) && (
          <div className="border-t border-line px-5 py-4">
            <Label className={v.status === "pending_review" ? "text-quarantine" : ""}>
              {v.status === "pending_review" ? "operator sign-off required" : "operator review"}
            </Label>
            <ReviewControls verdict={v} onReviewed={onUpdate} />
          </div>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-[1.25fr_1fr]">
        <Gate1Table verdict={v} />
        <Gate2Panel verdict={v} />
      </div>

      <TraceTimeline verdict={v} />

      <div className="grid gap-3 lg:grid-cols-[1.25fr_1fr]">
        <ChainEvidence verdict={v} />
        <CtiHits verdict={v} />
      </div>

      <EventDoc verdict={v} />
    </div>
  );
}

function Stat({ k, val, warn }: { k: string; val: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="uppercase tracking-[0.1em] text-mute">{k}</dt>
      <dd className={`truncate ${warn ? "text-block" : "text-ink"}`}>{val}</dd>
    </div>
  );
}

function Gate1Table({ verdict: v }: { verdict: Verdict }) {
  const checks = useMemo(
    () =>
      [...v.gate1.checks].sort(
        (a, b) => Number(a.passed) - Number(b.passed) || SEV_RANK[a.severity] - SEV_RANK[b.severity],
      ),
    [v.gate1.checks],
  );
  return (
    <Panel
      code="FDR-02"
      label="GATE 1 · DETERMINISTIC"
      meta={[`${checks.length} CHECKS`, v.gate1.forced_block ? "FORCED BLOCK" : v.gate1.novel_quarantine ? "NOVEL → QUARANTINE" : "NO FORCE"]}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="terminal-header">
            <tr className="border-b border-line">
              <th className="px-3 py-1.5 font-normal">result</th>
              <th className="px-3 py-1.5 font-normal">sev</th>
              <th className="px-3 py-1.5 font-normal">check</th>
              <th className="px-3 py-1.5 font-normal">detail</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c, i) => (
              <tr key={`${c.id}-${i}`} className={`border-b border-line last:border-b-0 ${!c.passed ? "bg-block/[0.04]" : ""}`}>
                <td className={`px-3 py-2 font-mono ${c.passed ? "text-allow/80" : "text-block"}`}>{c.passed ? "PASS" : "FAIL"}</td>
                <td className={`px-3 py-2 font-mono uppercase ${c.passed ? "text-mute/60" : SEV_CLASS[c.severity]}`}>{c.severity}</td>
                <td className="px-3 py-2">
                  <div className={c.passed ? "text-mute" : "text-ink"}>{c.name}</div>
                  <div className="font-mono text-[10px] text-mute/70">
                    {c.source} · {c.id}
                  </div>
                </td>
                <td className={`px-3 py-2 ${c.passed ? "text-mute/80" : "text-ink/90"}`}>{c.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function Gate2Panel({ verdict: v }: { verdict: Verdict }) {
  const g = v.gate2;
  const pct = Math.round(g.hijack_likelihood * 100);
  const color = pct >= 70 ? "bg-block" : pct >= 35 ? "bg-quarantine" : "bg-allow";
  const text = pct >= 70 ? "text-block" : pct >= 35 ? "text-quarantine" : "text-allow";
  return (
    <Panel
      code="FDR-03"
      label="GATE 2 · ADVERSARIAL REVIEW"
      meta={[g.mode.toUpperCase()]}
      right={
        <span className={`border px-1.5 py-0.5 font-mono text-[10px] tracking-wider ${g.passed ? "border-allow/50 text-allow" : "border-block/60 text-block"}`}>
          {g.passed ? "PASSED" : "FAILED"}
        </span>
      }
      bodyClassName="space-y-4 p-4"
    >
      <div>
        <div className="flex items-end justify-between">
          <span className="terminal-header">hijack likelihood</span>
          <span className={`font-mono text-2xl ${text}`}>{pct}%</span>
        </div>
        <div className="relative mt-2 h-2.5 border border-line bg-canvas">
          <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
          {[35, 70].map((t) => (
            <div key={t} className="absolute inset-y-[-3px] w-px bg-line-strong" style={{ left: `${t}%` }} aria-hidden />
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[9px] text-mute/70">
          <span>0</span>
          <span>REVIEW 35</span>
          <span>BLOCK 70</span>
          <span>100</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
        <span className="terminal-header">class</span>
        <span className={`border px-1.5 py-0.5 ${g.attack_class === "none" ? "border-line-strong text-mute" : "border-block/60 text-block"}`}>
          {g.attack_class}
        </span>
        <span className="terminal-header ml-2">model</span>
        <span className="truncate text-ink">{g.model}</span>
      </div>
      {g.reasons.length > 0 && (
        <div>
          <Label>reasons</Label>
          <ul className="space-y-1.5 text-sm text-ink/90">
            {g.reasons.map((r, i) => (
              <li key={i} className="border-l border-line-strong pl-3">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {g.evidence.length > 0 && (
        <div>
          <Label>evidence · quoted from provenance</Label>
          <div className="space-y-1.5">
            {g.evidence.map((e, i) => (
              <blockquote key={i} className="border-l-2 border-block/70 bg-block/[0.05] px-3 py-1.5 font-mono text-[11px] break-words text-[#fca5a5]">
                {e}
              </blockquote>
            ))}
          </div>
        </div>
      )}
      <p className="font-mono text-[10px] text-mute/80">Reviewer sees only proposed_tx + provenance, never the trading agent&apos;s chat.</p>
    </Panel>
  );
}

const KIND_GLYPH: Record<TraceStep["kind"], string> = { system: "◇", gate: "▣", tool: "⚙", model: "◈" };
const KIND_CLASS: Record<TraceStep["kind"], string> = {
  system: "text-mute border-line-strong",
  gate: "text-ink border-ink/60",
  tool: "text-[#c9c9c9] border-line-strong",
  model: "text-quarantine border-quarantine/60",
};

function TraceTimeline({ verdict: v }: { verdict: Verdict }) {
  const steps = v.trace;
  const firstOpen = !seenTraces.has(v.id);
  const [revealed, setRevealed] = useState(firstOpen ? 0 : steps.length);
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const total = Math.max(1, steps.reduce((a, s) => a + s.duration_ms, 0));
  const t0 = steps.length ? new Date(steps[0].started_at).getTime() : 0;

  useEffect(() => {
    seenTraces.add(v.id);
    if (revealed >= steps.length) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setRevealed(steps.length);
      return;
    }
    const id = window.setInterval(() => {
      setRevealed((n) => {
        if (n + 1 >= steps.length) window.clearInterval(id);
        return Math.min(steps.length, n + 1);
      });
    }, 150);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.id]);

  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <Panel
      code="FDR-04"
      label="TRACE"
      meta={[`CH ${v.chain.chain_id}`, clock(v.ts), `SEQ ${String(steps.length).padStart(4, "0")}`, ms(total)]}
      right={
        revealed < steps.length ? (
          <span className="font-mono text-[10px] tracking-wider text-quarantine">
            REPLAYING<span className="blink">_</span>
          </span>
        ) : (
          <button
            type="button"
            className="font-mono text-[10px] tracking-wider text-mute hover:text-ink"
            onClick={() => setOpen(open.size ? new Set() : new Set(steps.map((s) => s.i)))}
          >
            {open.size ? "COLLAPSE ALL" : "EXPAND ALL"}
          </button>
        )
      }
    >
      {steps.length === 0 ? (
        <p className="p-4 text-sm text-mute">No trace steps recorded for this verdict.</p>
      ) : (
        <ol className="relative">
          {steps.slice(0, revealed).map((s) => {
            const offset = ((new Date(s.started_at).getTime() - t0) / total) * 100;
            const width = Math.max(0.6, (s.duration_ms / total) * 100);
            const isOpen = open.has(s.i);
            return (
              <li key={s.i} className="trace-in border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggle(s.i)}
                  aria-expanded={isOpen}
                  className="grid w-full grid-cols-[28px_1fr_auto] items-center gap-x-3 px-3 py-2 text-left hover:bg-elevated/60 sm:grid-cols-[28px_minmax(160px,1fr)_minmax(120px,1.2fr)_76px]"
                >
                  <span className={`flex h-6 w-6 items-center justify-center border font-mono text-xs ${KIND_CLASS[s.kind]}`} title={s.kind}>
                    {KIND_GLYPH[s.kind]}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-xs text-ink">
                      <span className="text-mute/60">{String(s.i).padStart(2, "0")} </span>
                      {s.name}
                    </span>
                    <span className="terminal-header !text-[9px]">
                      {s.kind} · {clock(s.started_at)} {s.status === "error" && <span className="text-block">· ERROR</span>}
                    </span>
                  </span>
                  <span className="relative hidden h-1.5 bg-line/60 sm:block" aria-hidden>
                    <span
                      className={`absolute inset-y-0 ${s.status === "error" ? "bg-block" : s.kind === "model" ? "bg-quarantine/80" : "bg-ink/70"}`}
                      style={{ left: `${Math.min(offset, 99.4)}%`, width: `${width}%` }}
                    />
                  </span>
                  <span className="text-right font-mono text-[11px] text-mute">
                    {ms(s.duration_ms)} <span className="text-mute/60">{isOpen ? "▾" : "▸"}</span>
                  </span>
                </button>
                {isOpen && (
                  <div className="grid gap-2 px-3 pb-3 md:grid-cols-2">
                    <div>
                      <Label className="!mb-1">input</Label>
                      <JsonBlock value={s.input ?? null} className="max-h-64" />
                    </div>
                    <div>
                      <Label className="!mb-1">output</Label>
                      <JsonBlock value={s.output ?? null} className="max-h-64" />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function ChainEvidence({ verdict: v }: { verdict: Verdict }) {
  const c = v.chain;
  const tx = v.proposed_tx;
  const toUrl = addressUrl(tx.chain_id, tx.to);
  const gp = c.goplus;
  return (
    <Panel code="FDR-05" label="CHAIN EVIDENCE" meta={[networkLabel(c.chain_id), c.network]} bodyClassName="space-y-4 p-4">
      <div className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
        <KV k="to">
          <ExtLink href={toUrl} className="break-all text-ink">
            {tx.to}
          </ExtLink>
        </KV>
        <KV k="value">{formatEth(tx.value_wei)}</KV>
        <KV k="method">{tx.method ?? "-"}</KV>
        <KV k="amount">{tx.amount_human ?? "-"}</KV>
        {tx.token_address && (
          <KV k={`token${tx.token_symbol ? " · " + tx.token_symbol : ""}`}>
            <ExtLink href={addressUrl(tx.chain_id, tx.token_address)} className="text-ink">
              {short(tx.token_address)}
            </ExtLink>
          </KV>
        )}
        {tx.spender && (
          <KV k="spender">
            <ExtLink href={addressUrl(tx.chain_id, tx.spender)} className="text-block">
              {short(tx.spender)}
            </ExtLink>
          </KV>
        )}
        <KV k="to is contract">{c.to_is_contract === null ? "unknown" : c.to_is_contract ? "yes" : "no (EOA)"}</KV>
        <KV k="code size">{c.code_size === null ? "-" : `${c.code_size.toLocaleString()} bytes`}</KV>
      </div>

      {c.decoded_call && (
        <div>
          <Label>decoded call</Label>
          <div className="border border-line bg-canvas p-3 font-mono text-[11px]">
            <div className="text-ink">
              <span className="text-mute">{c.decoded_call.selector}</span> {c.decoded_call.signature}
            </div>
            {Object.entries(c.decoded_call.args).map(([k, val]) => (
              <div key={k} className="mt-1 break-all text-mute">
                {k} = <span className="text-[#c9c9c9]">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>simulation</Label>
          {c.simulation ? (
            <div className={`font-mono text-xs ${c.simulation.ok ? "text-allow" : "text-block"}`}>
              {c.simulation.ok ? "OK · no revert" : `REVERT · ${c.simulation.revert_reason ?? "unknown"}`}
            </div>
          ) : (
            <div className="font-mono text-xs text-mute">not run</div>
          )}
        </div>
        <div>
          <Label>goplus</Label>
          {gp ? (
            <div className="space-y-1.5 font-mono text-[11px]">
              {gp.token && (
                <div className={gp.token.is_honeypot ? "text-block" : "text-mute"}>
                  token · honeypot={String(gp.token.is_honeypot)} · buy {gp.token.buy_tax} · sell {gp.token.sell_tax}
                </div>
              )}
              {gp.address && <div className={gp.address.malicious ? "text-block" : "text-mute"}>address · malicious={String(gp.address.malicious)}</div>}
              <div className="flex flex-wrap gap-1">
                {[...(gp.token?.flags ?? []), ...(gp.address?.flags ?? [])].map((f) => (
                  <span key={f} className="border border-block/50 px-1 text-[10px] text-block">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="font-mono text-xs text-mute">no data</div>
          )}
        </div>
      </div>

      <div>
        <Label>on-chain ioc · reputation registry</Label>
        {c.onchain_ioc ? (
          <div className="border border-block/50 bg-block/[0.04] p-3 font-mono text-[11px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-block">IOC #{c.onchain_ioc.ioc_id}</span>
              <span className="uppercase text-ink">{c.onchain_ioc.category}</span>
              <span className="uppercase text-block">{c.onchain_ioc.severity}</span>
              <span className="text-mute">{c.onchain_ioc.confidence}% confidence</span>
            </div>
            <div className="mt-1.5 break-all text-mute">
              target{" "}
              <ExtLink href={addressUrl(tx.chain_id, c.onchain_ioc.target)} className="text-ink">
                {short(c.onchain_ioc.target)}
              </ExtLink>{" "}
              · publisher{" "}
              <ExtLink href={addressUrl(84532, c.onchain_ioc.publisher)} className="text-ink">
                {short(c.onchain_ioc.publisher)}
              </ExtLink>
            </div>
            <div className="mt-1 break-all text-mute/80">{c.onchain_ioc.uri}</div>
          </div>
        ) : (
          <div className="font-mono text-xs text-mute">no registry match</div>
        )}
      </div>

      {c.errors.length > 0 && (
        <div className="font-mono text-[11px] text-quarantine">
          {c.errors.map((e, i) => (
            <div key={i}>WARN · {e}</div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function KV({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="terminal-header !text-[10px]">{k}</div>
      <div className="mt-0.5 truncate font-mono text-ink/90">{children}</div>
    </div>
  );
}

function CtiHits({ verdict: v }: { verdict: Verdict }) {
  return (
    <Panel code="FDR-06" label="CTI HITS" meta={[`${v.cti_hits.length} MATCH${v.cti_hits.length === 1 ? "" : "ES"}`]}>
      {v.cti_hits.length === 0 ? (
        <p className="p-4 font-mono text-xs text-mute">No threat-intel indicators matched this transaction.</p>
      ) : (
        <ul>
          {v.cti_hits.map((h, i) => (
            <li key={`${h.ioc_id}-${i}`} className="border-b border-line px-4 py-2.5 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="text-ink">{h.ioc_id}</span>
                <span className={`uppercase ${h.severity === "critical" ? "text-block" : h.severity === "high" ? "text-[#f87171]" : "text-quarantine"}`}>
                  {h.severity}
                </span>
                <span className="border border-line-strong px-1 text-[10px] uppercase text-mute">{h.source}</span>
              </div>
              <div className="mt-1 text-sm text-ink/90">{h.title}</div>
              <div className="mt-0.5 break-all font-mono text-[10px] text-mute">
                {h.category}
                {h.address && (
                  <>
                    {" · "}
                    <ExtLink href={addressUrl(v.proposed_tx.chain_id, h.address)}>{short(h.address)}</ExtLink>
                  </>
                )}
                {h.pattern && <> · /{h.pattern}/</>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function EventDoc({ verdict: v }: { verdict: Verdict }) {
  const [open, setOpen] = useState(false);
  return (
    <Panel
      code="FDR-07"
      label="CLICKHOUSE ROW"
      meta={["agentshield.verdicts", `${Object.keys(v.event_doc).length} COLS`]}
      right={
        <button type="button" onClick={() => setOpen(!open)} className="font-mono text-[10px] tracking-wider text-mute hover:text-ink">
          {open ? "HIDE ▾" : "SHOW ▸"}
        </button>
      }
    >
      {open && <JsonBlock value={v.event_doc} className="m-3 max-h-96" />}
    </Panel>
  );
}


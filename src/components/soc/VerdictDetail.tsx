"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check as CheckIcon, Copy, X } from "@phosphor-icons/react";
import type { Check, Scenario, Verdict } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { DecisionBadge, StatusTag } from "@/components/DecisionBadge";
import { Tag } from "@/components/ui/States";
import { addressUrl, formatEth, ms, networkLabel, relTime, short } from "@/lib/format";
import { ExtLink, JsonBlock } from "./Panel";
import { ReviewControls } from "./ReviewControls";
import { VerdictTrace } from "./VerdictTrace";

const SEV_RANK: Record<Check["severity"], number> = { critical: 0, high: 1, medium: 2, info: 3 };
const SEV_TAG: Record<Check["severity"], string> = {
  critical: "border-block/35 bg-block/10 text-block",
  high: "border-block/25 text-block",
  medium: "border-quarantine/35 bg-quarantine/10 text-quarantine",
  info: "border-line-strong text-faint",
};

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function VerdictDrawer({
  verdict,
  onClose,
  onUpdate,
}: {
  verdict: Verdict | null;
  onClose: () => void;
  onUpdate: (v: Verdict) => void;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const open = Boolean(verdict);

  useEffect(() => {
    if (!open) return;
    const restore = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restore?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {verdict && (
        <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label="Verdict detail">
          <motion.button
            type="button"
            aria-label="Close verdict"
            tabIndex={-1}
            className="absolute inset-0 cursor-default bg-canvas/60 backdrop-blur-[1px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            ref={panelRef}
            className="relative flex h-full w-[min(760px,100vw)] flex-col border-l border-line-strong bg-panel shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]"
            initial={reduce ? { opacity: 0 } : { x: 32, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { x: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { x: 32, opacity: 0 }}
            transition={{ duration: reduce ? 0.12 : 0.32, ease: [0.2, 0, 0, 1] }}
          >
            <VerdictDetail key={verdict.id} verdict={verdict} onUpdate={onUpdate} onClose={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function VerdictDetail({
  verdict: v,
  onUpdate,
  onClose,
}: {
  verdict: Verdict;
  onUpdate: (v: Verdict) => void;
  onClose?: () => void;
}) {
  return (
    <>
      <header className="shrink-0 border-b border-line px-5 pb-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <DecisionBadge decision={v.decision} size="lg" />
            <StatusTag status={v.status} />
            <Tag>{v.mode === "agent" ? "Agent" : "Fast"}</Tag>
            <span className="font-mono text-xs tabular-nums text-mute">{ms(v.latency_ms)}</span>
            <span className="text-xs text-faint">{relTime(v.ts)}</span>
          </div>
          {onClose && (
            <button
              type="button"
              data-autofocus
              onClick={onClose}
              aria-label="Close verdict detail"
              className="-mr-1 shrink-0 rounded-md p-1.5 text-mute transition-colors hover:bg-elevated hover:text-ink"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
          <CopyId id={v.id} />
          <span>
            agent <span className="font-mono text-mute">{v.agent_id}</span>
          </span>
          {v.scenario_id && <span className="font-mono">{v.scenario_id}</span>}
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-ink">{v.operator_summary}</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="divide-y divide-line">
          <Section title="Trace">
            <VerdictTrace steps={v.trace} />
          </Section>
          <Section title="Why">
            <Checks checks={v.gate1.checks} forced={v.gate1.forced_block} novel={v.gate1.novel_quarantine} />
          </Section>
          <Section title="Gate 2 reviewer">
            <Gate2 verdict={v} />
          </Section>
          <Section title="Chain evidence">
            <ChainEvidence verdict={v} />
          </Section>
          <Section title="Provenance">
            <Provenance verdict={v} />
          </Section>
          <Section title="Threat intel hits">
            <CtiHits verdict={v} />
          </Section>
          <Section title="Recorder row">
            <EventDoc verdict={v} />
          </Section>
        </div>
      </div>

      {(v.status === "pending_review" || v.review) && (
        <footer className="shrink-0 border-t border-line bg-panel px-5 py-4">
          {v.status === "pending_review" && <div className="mb-3 text-[13px] font-medium text-quarantine">Waiting for your decision</div>}
          <ReviewControls verdict={v} onReviewed={onUpdate} />
        </footer>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-5 py-4">
      <h3 className="mb-3 text-[13px] font-medium text-ink">{title}</h3>
      {children}
    </section>
  );
}

function CopyId({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setDone(true);
      window.setTimeout(() => setDone(false), 1400);
    } catch {
      // clipboard blocked
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono text-mute transition-colors hover:bg-elevated hover:text-ink"
      aria-label="Copy verdict id"
    >
      {short(id, 8)}
      {done ? <CheckIcon size={12} className="text-allow" aria-hidden /> : <Copy size={12} aria-hidden />}
    </button>
  );
}

function Checks({ checks, forced, novel }: { checks: Check[]; forced: boolean; novel: boolean }) {
  const [showPassed, setShowPassed] = useState(false);
  const failing = useMemo(
    () => checks.filter((c) => !c.passed).sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]),
    [checks],
  );
  const passed = checks.filter((c) => c.passed);
  return (
    <div>
      <p className="mb-3 text-[13px] text-mute">
        {forced
          ? "A critical check failed, so Gate 1 blocked this before any model could weigh in."
          : novel
            ? "No critical failure, but a check asked for a human before signing."
            : failing.length === 0
              ? "Every deterministic check passed."
              : "Some checks flagged this transaction."}
      </p>
      {failing.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line">
          {failing.map((c, i) => (
            <CheckRow key={`${c.id}-${i}`} c={c} />
          ))}
        </ul>
      )}
      {passed.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowPassed(!showPassed)}
            aria-expanded={showPassed}
            className="rounded px-1.5 py-1 text-xs text-faint transition-colors hover:bg-elevated hover:text-ink"
          >
            {showPassed ? "Hide passed checks" : `Show ${passed.length} passed checks`}
          </button>
          {showPassed && (
            <ul className="mt-2 divide-y divide-line rounded-md border border-line">
              {passed.map((c, i) => (
                <CheckRow key={`${c.id}-${i}`} c={c} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function CheckRow({ c }: { c: Check }) {
  return (
    <li className="grid gap-x-3 gap-y-1 px-3 py-2.5 sm:grid-cols-[88px_1fr]">
      <div className="flex items-start gap-2 sm:block">
        <span
          className={`inline-flex h-5 items-center rounded border px-1.5 text-[11px] ${c.passed ? "border-allow/25 text-allow" : SEV_TAG[c.severity]}`}
        >
          {c.passed ? "Passed" : c.severity.charAt(0).toUpperCase() + c.severity.slice(1)}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={`text-[13px] ${c.passed ? "text-mute" : "text-ink"}`}>{c.name}</span>
          <span className="font-mono text-[11px] text-faint">{c.id}</span>
        </div>
        <div className={`mt-0.5 break-words text-[13px] ${c.passed ? "text-faint" : "text-mute"}`}>{c.detail}</div>
      </div>
    </li>
  );
}

function Gate2({ verdict: v }: { verdict: Verdict }) {
  const g = v.gate2;
  const pct = Math.round(g.hijack_likelihood * 100);
  const tone = pct >= 70 ? "text-block" : pct >= 35 ? "text-quarantine" : "text-allow";
  const bar = pct >= 70 ? "bg-block" : pct >= 35 ? "bg-quarantine" : "bg-allow";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <div className="text-xs text-faint">Hijack likelihood</div>
          <div className={`mt-0.5 font-mono text-4xl tabular-nums tracking-tight ${tone}`}>{pct}%</div>
          <div className="mt-1.5 w-40" aria-hidden>
            <div className={`h-1 rounded-full ${bar}`} style={{ width: `${Math.max(2, pct)}%` }} />
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-faint">Attack class</dt>
          <dd>
            <span
              className={`inline-flex h-5 items-center rounded border px-1.5 font-mono text-[11px] ${g.attack_class === "none" ? "border-line-strong text-mute" : "border-block/35 bg-block/10 text-block"}`}
            >
              {g.attack_class}
            </span>
          </dd>
          <dt className="text-faint">Reviewer</dt>
          <dd className="min-w-0 truncate font-mono text-xs text-mute">
            {g.mode === "llm" ? g.model : g.mode === "heuristic" ? "heuristic (no model configured)" : "skipped"}
          </dd>
          <dt className="text-faint">Result</dt>
          <dd className={g.passed ? "text-allow" : "text-block"}>{g.passed ? "Consistent with intent" : "Flagged"}</dd>
        </dl>
      </div>
      {g.reasons.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-mute marker:text-faint">
          {g.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      {g.evidence.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-faint">Quoted from what the agent read</div>
          {g.evidence.map((e, i) => (
            <blockquote key={i} className="break-words border-l-2 border-line-strong pl-3 font-mono text-[12px] text-ink/90">
              {e}
            </blockquote>
          ))}
        </div>
      )}
      <p className="text-xs text-faint">The reviewer only sees the intent, the transaction and the fenced sources. It never sees the agent&apos;s conversation.</p>
    </div>
  );
}

function ChainEvidence({ verdict: v }: { verdict: Verdict }) {
  const c = v.chain;
  const tx = v.proposed_tx;
  const gp = c.goplus;
  const flags = [...(gp?.token?.flags ?? []), ...(gp?.address?.flags ?? [])];
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
        <KV k={`To, ${networkLabel(tx.chain_id)}`}>
          <ExtLink href={addressUrl(tx.chain_id, tx.to)} className="break-all text-ink">
            {short(tx.to, 10)}
          </ExtLink>
        </KV>
        <KV k="Value">{formatEth(tx.value_wei)}</KV>
        <KV k="Method">{tx.method ? `${tx.method}()` : "-"}</KV>
        <KV k="Amount">{tx.amount_human ?? "-"}</KV>
        {tx.token_address && (
          <KV k={`Token${tx.token_symbol ? `, ${tx.token_symbol}` : ""}`}>
            <ExtLink href={addressUrl(tx.chain_id, tx.token_address)} className="text-ink">
              {short(tx.token_address)}
            </ExtLink>
          </KV>
        )}
        {tx.spender && (
          <KV k="Spender">
            <ExtLink href={addressUrl(tx.chain_id, tx.spender)} className="text-ink">
              {short(tx.spender)}
            </ExtLink>
          </KV>
        )}
        <KV k="Target">
          {c.to_is_contract === null
            ? "Unknown"
            : c.to_is_contract
              ? `Contract, ${c.code_size === null ? "?" : c.code_size.toLocaleString()} bytes`
              : "Wallet address, no code"}
        </KV>
        <KV k="Simulation">
          {c.simulation ? (
            <span className={c.simulation.ok ? "text-allow" : "text-block"}>
              {c.simulation.ok ? "No revert" : `Reverts: ${c.simulation.revert_reason ?? "unknown reason"}`}
            </span>
          ) : (
            <span className="text-faint">Not run</span>
          )}
        </KV>
      </dl>

      {c.decoded_call && (
        <div>
          <div className="mb-1.5 text-xs text-faint">Decoded call</div>
          <div className="overflow-x-auto rounded-md border border-line bg-canvas">
            <div className="border-b border-line px-3 py-2 font-mono text-[12px] text-ink">
              <span className="text-faint">{c.decoded_call.selector}</span> {c.decoded_call.signature}
            </div>
            <table className="w-full text-left font-mono text-[12px]">
              <tbody>
                {Object.entries(c.decoded_call.args).map(([k, val]) => (
                  <tr key={k} className="border-b border-line last:border-b-0">
                    <td className="w-32 px-3 py-1.5 align-top text-faint">{k}</td>
                    <td className="break-all px-3 py-1.5 text-mute">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1.5 text-xs text-faint">GoPlus</div>
          {gp ? (
            <div className="space-y-1 text-[13px]">
              {gp.token && (
                <div className={gp.token.is_honeypot ? "text-block" : "text-mute"}>
                  Token {gp.token.is_honeypot ? "is a honeypot" : "not a honeypot"}, buy tax{" "}
                  <span className="font-mono">{gp.token.buy_tax}</span>, sell tax <span className="font-mono">{gp.token.sell_tax}</span>
                </div>
              )}
              {gp.address && (
                <div className={gp.address.malicious ? "text-block" : "text-mute"}>
                  Address {gp.address.malicious ? "flagged malicious" : "not flagged"}
                </div>
              )}
              {flags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {flags.map((f) => (
                    <span key={f} className="rounded border border-block/30 px-1.5 py-px font-mono text-[11px] text-block">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[13px] text-faint">No data</div>
          )}
        </div>
        <div>
          <div className="mb-1.5 text-xs text-faint">Reputation registry, Base Sepolia</div>
          {c.onchain_ioc ? (
            <div className="rounded-md border border-block/30 bg-block/[0.05] px-3 py-2.5 text-[13px]">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-block">IOC #{c.onchain_ioc.ioc_id}</span>
                <span className="text-ink">{c.onchain_ioc.category.toLowerCase()}</span>
                <span className="text-faint">
                  {c.onchain_ioc.severity}, <span className="font-mono">{c.onchain_ioc.confidence}%</span> confidence
                </span>
              </div>
              <div className="mt-1 text-mute">{c.onchain_ioc.uri}</div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-faint">
                <span>
                  target{" "}
                  <ExtLink href={addressUrl(tx.chain_id, c.onchain_ioc.target)} className="text-mute">
                    {short(c.onchain_ioc.target)}
                  </ExtLink>
                </span>
                <span>
                  publisher{" "}
                  <ExtLink href={addressUrl(84532, c.onchain_ioc.publisher)} className="text-mute">
                    {short(c.onchain_ioc.publisher)}
                  </ExtLink>
                </span>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-faint">No registry match</div>
          )}
        </div>
      </div>

      {c.errors.length > 0 && (
        <ul className="space-y-0.5 text-xs text-quarantine">
          {c.errors.map((e, i) => (
            <li key={i}>Lookup warning: {e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="mt-0.5 truncate font-mono text-[12.5px] text-mute">{children}</dd>
    </div>
  );
}

function suspiciousTerms(v: Verdict): string[] {
  const terms = new Set<string>();
  const add = (s: string | undefined | null) => {
    const t = (s ?? "").trim();
    if (t.length >= 4 && t.length <= 160) terms.add(t);
  };
  for (const c of v.gate1.checks) {
    if (c.passed) continue;
    for (const m of c.detail.matchAll(/["“']([^"”']{4,120})["”']/g)) add(m[1]);
    for (const m of c.detail.matchAll(/0x[a-fA-F0-9]{40}/g)) add(m[0]);
  }
  for (const h of v.cti_hits) add(h.address);
  for (const e of v.gate2.evidence) add(e.replace(/^["“]|["”]$/g, ""));
  return [...terms].sort((a, b) => b.length - a.length);
}

function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  const parts = useMemo(() => {
    if (terms.length === 0) return [{ s: text, hit: false }];
    const lower = text.toLowerCase();
    const ranges: [number, number][] = [];
    for (const t of terms) {
      const tl = t.toLowerCase();
      let from = 0;
      while (from < lower.length) {
        const at = lower.indexOf(tl, from);
        if (at < 0) break;
        if (!ranges.some(([a, b]) => at < b && at + tl.length > a)) ranges.push([at, at + tl.length]);
        from = at + tl.length;
      }
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const out: { s: string; hit: boolean }[] = [];
    let cur = 0;
    for (const [a, b] of ranges) {
      if (a > cur) out.push({ s: text.slice(cur, a), hit: false });
      out.push({ s: text.slice(a, b), hit: true });
      cur = b;
    }
    if (cur < text.length) out.push({ s: text.slice(cur), hit: false });
    return out;
  }, [text, terms]);
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-sm bg-block/15 px-0.5 text-block">
            {p.s}
          </mark>
        ) : (
          <span key={i}>{p.s}</span>
        ),
      )}
    </>
  );
}

type Source = { type?: string; content?: string; url?: string };
type Prov = { user_intent?: string; sources?: Source[] };

let scenarioCache: Promise<Record<string, Prov>> | null = null;

function scenarioProvenance(): Promise<Record<string, Prov>> {
  scenarioCache ??= rpc<{ attacks: Scenario[] }>("scenarios").then((res) => {
    if (hasError(res)) {
      scenarioCache = null;
      return {};
    }
    return Object.fromEntries(res.attacks.map((s) => [s.id, s.request.provenance]));
  });
  return scenarioCache;
}

// Verdicts don't store the raw sources, so fall back to the trace intent and, for Attack Lab runs, the scenario request.
function useProvenance(v: Verdict): Prov {
  const direct = (v as Verdict & { provenance?: Prov; request?: { provenance?: Prov } }).provenance ?? (v as { request?: { provenance?: Prov } }).request?.provenance;
  const traceIn = v.trace.find((s) => s.name === "receive_request" || s.name === "request.received")?.input as
    | { intent?: string; provenance?: Prov }
    | undefined;
  const [fromScenario, setFromScenario] = useState<Prov | null>(null);
  useEffect(() => {
    if (direct?.sources?.length || !v.scenario_id) return;
    let live = true;
    scenarioProvenance().then((map) => live && setFromScenario(map[v.scenario_id as string] ?? null));
    return () => {
      live = false;
    };
  }, [direct, v.scenario_id]);
  return {
    user_intent: direct?.user_intent ?? traceIn?.provenance?.user_intent ?? traceIn?.intent ?? fromScenario?.user_intent,
    sources: direct?.sources ?? traceIn?.provenance?.sources ?? fromScenario?.sources ?? [],
  };
}

function Provenance({ verdict: v }: { verdict: Verdict }) {
  const terms = useMemo(() => suspiciousTerms(v), [v]);
  const prov = useProvenance(v);
  const userIntent = prov.user_intent || null;
  const list = prov.sources ?? [];
  return (
    <div className="space-y-3">
      <div>
        <div className="text-xs text-faint">What the human asked for</div>
        <p className="mt-0.5 text-[14px] text-ink">{userIntent ? `“${userIntent}”` : <span className="text-faint">Not recorded</span>}</p>
      </div>
      {list.length === 0 ? (
        <p className="text-[13px] text-faint">No provenance sources were attached to this verdict.</p>
      ) : (
        list.map((s, i) => (
          <div key={i} className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-faint">
              <Tag>{s.type ?? "source"}</Tag>
              {s.url && <span className="truncate font-mono">{s.url}</span>}
            </div>
            <pre className="whitespace-pre-wrap break-words rounded-md border border-line bg-canvas p-3 font-mono text-[12px] leading-5 text-mute">
              <Highlighted text={s.content ?? ""} terms={terms} />
            </pre>
          </div>
        ))
      )}
      {terms.length > 0 && list.length > 0 && <p className="text-xs text-faint">Highlighted text matched a failing check, a threat intel address or the reviewer&apos;s evidence.</p>}
    </div>
  );
}

function CtiHits({ verdict: v }: { verdict: Verdict }) {
  if (v.cti_hits.length === 0) return <p className="text-[13px] text-faint">No threat intel indicators matched this transaction.</p>;
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full min-w-[520px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-xs text-faint">
            <th className="px-3 py-2 font-normal">Indicator</th>
            <th className="px-3 py-2 font-normal">Severity</th>
            <th className="px-3 py-2 font-normal">Source</th>
            <th className="px-3 py-2 font-normal">Match</th>
          </tr>
        </thead>
        <tbody>
          {v.cti_hits.map((h, i) => (
            <tr key={`${h.ioc_id}-${i}`} className="border-b border-line last:border-b-0 align-top">
              <td className="px-3 py-2">
                <div className="text-ink">{h.title}</div>
                <div className="font-mono text-[11px] text-faint">
                  {h.ioc_id}, {h.category}
                </div>
              </td>
              <td className={`px-3 py-2 ${h.severity === "critical" || h.severity === "high" ? "text-block" : "text-quarantine"}`}>{h.severity}</td>
              <td className="px-3 py-2 text-mute">{h.source}</td>
              <td className="px-3 py-2 font-mono text-[12px] text-mute">
                {h.address ? <ExtLink href={addressUrl(v.proposed_tx.chain_id, h.address)}>{short(h.address)}</ExtLink> : h.pattern ? `/${h.pattern}/` : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventDoc({ verdict: v }: { verdict: Verdict }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="rounded px-1.5 py-1 text-xs text-faint transition-colors hover:bg-elevated hover:text-ink"
      >
        {open ? "Hide" : "Show"} the ClickHouse row ({Object.keys(v.event_doc).length} columns)
      </button>
      {open && <JsonBlock value={v.event_doc} className="mt-2 max-h-96" />}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { AttackAllResult, AttackResult, Mode, Scenario, Verdict } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { DecisionBadge } from "@/components/DecisionBadge";
import { ErrorLine, OfflineState, Panel } from "./Panel";
import { Investigating } from "./Investigating";
import { ms, networkLabel, short } from "@/lib/format";

const FAMILY_TONE: Record<Scenario["family"], string> = {
  injection: "text-block border-block/50",
  honeypot: "text-block border-block/50",
  drainer: "text-block border-block/50",
  clean: "text-mute border-line-strong",
};

export function ModeToggle({ mode, onChange, disabled }: { mode: Mode; onChange: (m: Mode) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex border border-line-strong" role="radiogroup" aria-label="Engine mode">
      {(
        [
          ["fast", "Fast", "deterministic"],
          ["agent", "Agent", "Strands + Bedrock"],
        ] as const
      ).map(([id, label, sub]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          disabled={disabled}
          onClick={() => onChange(id)}
          className={`px-3 py-1.5 text-left disabled:opacity-50 ${mode === id ? "bg-ink text-black" : "text-mute hover:text-ink"}`}
        >
          <span className="block text-xs font-medium leading-tight">{label}</span>
          <span className={`block font-mono text-[9px] uppercase tracking-wider ${mode === id ? "text-black/60" : "text-mute/70"}`}>{sub}</span>
        </button>
      ))}
    </div>
  );
}

type Flight = { label: string; mode: Mode; startedAt: number };

export function AttackLab({ onOpen, onChange }: { onOpen: (v: Verdict) => void; onChange: () => void }) {
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("fast");
  const [flight, setFlight] = useState<Flight | null>(null);
  const [results, setResults] = useState<Record<string, AttackResult>>({});
  const [score, setScore] = useState<AttackAllResult["score"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    const res = await rpc<{ attacks: Scenario[] }>("scenarios");
    if (hasError(res)) setLoadErr(res.error);
    else setScenarios(res.attacks);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runOne = async (s: Scenario) => {
    setError(null);
    setFlight({ label: `${s.id} · ${s.name}`, mode, startedAt: Date.now() });
    const res = await rpc<AttackResult>("attack", { id: s.id, mode });
    setFlight(null);
    if (hasError(res)) return setError(res.offline ? `recorder offline: ${res.error}` : res.error);
    setResults((r) => ({ ...r, [s.id]: res }));
    onChange();
    onOpen(res.verdict);
  };

  const runAll = async () => {
    setError(null);
    setScore(null);
    setFlight({ label: `ALL SCENARIOS · ${scenarios?.length ?? 0}`, mode: "fast", startedAt: Date.now() });
    const res = await rpc<AttackAllResult>("attack", { all: true, mode: "fast" });
    setFlight(null);
    if (hasError(res)) return setError(res.offline ? `recorder offline: ${res.error}` : res.error);
    setResults(Object.fromEntries(res.results.map((r) => [r.scenario.id, r])));
    setScore(res.score);
    onChange();
  };

  const busy = flight !== null;

  return (
    <div className="space-y-3">
      <Panel
        code="FDR-10"
        label="ATTACK LAB"
        meta={[scenarios ? `${scenarios.length} SCENARIOS` : null, "BASE 8453", mode === "agent" ? "ENGINE AGENT" : "ENGINE FAST"]}
        bodyClassName="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      >
        <p className="max-w-2xl text-sm text-mute">
          Replay real attack patterns against the shield. Each run goes through Gate 1, Gate 2 and CTI, and lands in ClickHouse.{" "}
          <span className="text-ink">Agent</span> mode runs the full Strands investigation on Bedrock.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ModeToggle mode={mode} onChange={setMode} disabled={busy} />
          <button
            type="button"
            onClick={runAll}
            disabled={busy || !scenarios?.length}
            className="h-[42px] border border-line-strong px-4 font-mono text-xs tracking-[0.12em] text-ink hover:bg-elevated disabled:opacity-50"
            title="Run all scenarios in fast mode"
          >
            RUN ALL · FAST
          </button>
        </div>
      </Panel>

      {flight && <Investigating mode={flight.mode} label={flight.label} startedAt={flight.startedAt} />}
      {error && <ErrorLine error={error} />}

      {score && (
        <div className={`flex flex-wrap items-center gap-x-6 gap-y-1 border px-4 py-3 ${score.matched === score.total ? "border-allow/50" : "border-block/60"}`}>
          <span className={`font-mono text-2xl ${score.matched === score.total ? "text-allow" : "text-block"}`}>
            {score.matched}/{score.total}
          </span>
          <span className="terminal-header">scenarios matched expected decision · fast mode</span>
        </div>
      )}

      {loadErr && <OfflineState error={loadErr} onRetry={load} />}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!scenarios && !loadErr &&
          Array.from({ length: 6 }, (_, i) => <div key={i} className="h-56 animate-pulse border border-line bg-panel" />)}
        {scenarios?.map((s, idx) => {
          const r = results[s.id];
          const tx = s.request.proposed_tx;
          return (
            <article key={s.id} className="group flex min-w-0 flex-col border border-line bg-panel transition-colors hover:border-line-strong">
              <div className="terminal-header flex items-center justify-between gap-2 border-b border-line px-3 py-1.5">
                <span className="truncate">
                  <span className="text-ink">S-{String(idx + 1).padStart(2, "0")}</span> · {s.id}
                </span>
                <span className={`border px-1 text-[9px] ${FAMILY_TONE[s.family]}`}>{s.family}</span>
              </div>
              <div className="flex flex-1 flex-col px-4 py-3">
                <h3 className="text-[15px] font-medium text-ink">{s.name}</h3>
                <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-mute">{s.blurb}</p>
                <div className="mt-3 space-y-1 font-mono text-[11px] text-mute">
                  <div className="truncate">
                    <span className="text-mute/60">intent </span>
                    <span className="text-ink/80">&ldquo;{s.request.provenance.user_intent}&rdquo;</span>
                  </div>
                  <div className="truncate">
                    <span className="text-mute/60">tx </span>
                    {tx.method ?? "call"}() → {short(tx.to)} · {networkLabel(tx.chain_id)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-mute/60">expect</span> <DecisionBadge decision={s.expected} />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
                {r ? (
                  <button type="button" onClick={() => onOpen(r.verdict)} className="flex min-w-0 items-center gap-2 text-left hover:opacity-80">
                    <DecisionBadge decision={r.verdict.decision} pulse />
                    <span className={`font-mono text-[10px] tracking-wider ${r.matched_expected ? "text-allow" : "text-block"}`}>
                      {r.matched_expected ? "MATCH" : "MISS"}
                    </span>
                    <span className="truncate font-mono text-[10px] text-mute">
                      {ms(r.verdict.latency_ms)} · {r.verdict.mode} · detail ▸
                    </span>
                  </button>
                ) : (
                  <span className="font-mono text-[10px] tracking-wider text-mute/60">NOT RUN</span>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runOne(s)}
                  className="btn-crimson shrink-0 px-3 py-1.5 font-mono text-[11px] tracking-[0.12em] disabled:opacity-40"
                >
                  RUN ▸
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

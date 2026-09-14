"use client";

import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { CheckCircle, CircleNotch, Play, WarningCircle } from "@phosphor-icons/react";
import type { AttackAllResult, AttackResult, Decision, Mode, Scenario, Verdict } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { DecisionBadge } from "@/components/DecisionBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState, Skeleton, Tag } from "@/components/ui/States";
import { ms, networkLabel, short } from "@/lib/format";
import { ErrorLine, OfflineState, Panel } from "./Panel";
import { Investigating } from "./Investigating";
import { ModeToggle } from "./LabModeToggle";

export { ModeToggle } from "./LabModeToggle";

const FAMILY: Record<Scenario["family"], string> = {
  injection: "Prompt injection",
  honeypot: "Honeypot",
  drainer: "Drainer",
  clean: "Clean",
};

type Flight = { label: string; mode: Mode; startedAt: number };
type Score = { matched: number; total: number; mode: Mode };

// The backend exposes a fast-mode expectation when it differs from agent mode (A7).
function expectedFor(s: Scenario, mode: Mode): Decision {
  const fast = (s as Scenario & { expected_fast?: Decision }).expected_fast;
  return mode === "fast" && fast ? fast : s.expected;
}

function errorText(res: { error: string; offline?: boolean }) {
  return res.offline ? `Agent unreachable: ${res.error}` : res.error;
}

export function AttackLab({ onOpen, onChange }: { onOpen: (v: Verdict) => void; onChange: () => void }) {
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("fast");
  const [flight, setFlight] = useState<Flight | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [results, setResults] = useState<Record<string, AttackResult>>({});
  const [score, setScore] = useState<Score | null>(null);
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

  const busy = flight !== null || batch !== null;

  const runOne = async (s: Scenario, open = true): Promise<AttackResult | null> => {
    setError(null);
    setRunning(s.id);
    setFlight({ label: s.name, mode, startedAt: Date.now() });
    const res = await rpc<AttackResult>("attack", { id: s.id, mode });
    setFlight(null);
    setRunning(null);
    if (hasError(res)) {
      setError(errorText(res));
      return null;
    }
    setResults((r) => ({ ...r, [s.id]: res }));
    onChange();
    if (open) onOpen(res.verdict);
    return res;
  };

  const runAll = async () => {
    if (!scenarios?.length) return;
    setConfirming(false);
    setError(null);
    setScore(null);
    setBatch({ done: 0, total: scenarios.length });

    if (mode === "fast") {
      setFlight({ label: `All ${scenarios.length} scenarios`, mode: "fast", startedAt: Date.now() });
      const res = await rpc<AttackAllResult>("attack", { all: true, mode: "fast" });
      setFlight(null);
      setBatch(null);
      if (hasError(res)) return setError(errorText(res));
      setResults((r) => ({ ...r, ...Object.fromEntries(res.results.map((x) => [x.scenario.id, x])) }));
      setScore({ ...res.score, mode: "fast" });
      onChange();
      return;
    }

    // Agent mode has no batch endpoint and is rate limited, so run one at a time and stop on the first error.
    let matched = 0;
    let total = 0;
    for (const s of scenarios) {
      const r = await runOne(s, false);
      if (!r) break;
      total += 1;
      if (r.matched_expected) matched += 1;
      setBatch({ done: total, total: scenarios.length });
    }
    setBatch(null);
    if (total) setScore({ matched, total, mode: "agent" });
  };

  const startRunAll = () => (mode === "agent" ? setConfirming(true) : runAll());

  const allMatched = score ? score.matched === score.total : false;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13px] text-mute">
          Replay real attacks against Base mainnet contracts and check each verdict against what the shield should decide.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ModeToggle mode={mode} onChange={(m) => { setMode(m); setConfirming(false); }} disabled={busy} />
          <Button variant="primary" onClick={startRunAll} disabled={busy || !scenarios?.length} className="min-w-[96px]">
            {batch ? (
              <>
                <CircleNotch size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />
                {mode === "agent" ? `Running ${Math.min(batch.done + 1, batch.total)} of ${batch.total}` : "Running…"}
              </>
            ) : (
              "Run all"
            )}
          </Button>
        </div>
      </div>

      {confirming && scenarios && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-quarantine/30 bg-quarantine/[0.06] px-4 py-3">
          <p className="text-[13px] text-mute">
            Run all {scenarios.length} scenarios in agent mode? Each run takes 10 to 40 seconds, and the public demo allows 8
            agent runs per 10 minutes.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={runAll}>
              Run {scenarios.length} agent checks
            </Button>
          </div>
        </div>
      )}

      {flight && <Investigating mode={flight.mode} label={flight.label} startedAt={flight.startedAt} />}
      {error && <ErrorLine error={error} />}

      {score && (
        <div
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border px-4 py-3 ${
            allMatched ? "border-allow/30 bg-allow/[0.06]" : "border-quarantine/30 bg-quarantine/[0.06]"
          }`}
        >
          {allMatched ? (
            <CheckCircle size={18} weight="fill" className="text-allow" aria-hidden />
          ) : (
            <WarningCircle size={18} weight="fill" className="text-quarantine" aria-hidden />
          )}
          <span className="text-sm font-medium text-ink">
            <span className="font-mono tabular-nums">{score.matched}</span> of <span className="font-mono tabular-nums">{score.total}</span> matched
          </span>
          <span className="text-[13px] text-faint">expected decision, {score.mode} mode</span>
        </div>
      )}

      {loadErr && <OfflineState error={loadErr} onRetry={load} />}

      <Panel label="Scenarios" meta={[scenarios ? `${scenarios.length} on Base mainnet` : null]}>
        {!scenarios && !loadErr && (
          <ul className="divide-y divide-line" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_260px]">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-72 max-w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-56 max-w-full" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-8 w-full" />
              </li>
            ))}
          </ul>
        )}
        {scenarios?.length === 0 && <EmptyState title="No scenarios" body="The agent returned an empty scenario list." />}
        {scenarios && scenarios.length > 0 && (
          <ul className="divide-y divide-line">
            {scenarios.map((s) => (
              <ScenarioRow
                key={s.id}
                scenario={s}
                mode={mode}
                result={results[s.id]}
                running={running === s.id}
                disabled={busy}
                onRun={() => runOne(s)}
                onOpen={onOpen}
              />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function ScenarioRow({
  scenario: s,
  mode,
  result: r,
  running,
  disabled,
  onRun,
  onOpen,
}: {
  scenario: Scenario;
  mode: Mode;
  result?: AttackResult;
  running: boolean;
  disabled: boolean;
  onRun: () => void;
  onOpen: (v: Verdict) => void;
}) {
  const tx = s.request.proposed_tx;
  const open = r ? () => onOpen(r.verdict) : undefined;
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (open && e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      open();
    }
  };
  const resultExpected = r ? expectedFor(s, r.verdict.mode) : null;

  return (
    <li>
      <div
        role={open ? "button" : undefined}
        tabIndex={open ? 0 : undefined}
        aria-label={open ? `Open verdict for ${s.name}` : undefined}
        onClick={open}
        onKeyDown={onKey}
        className={`grid gap-3 px-4 py-3.5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_auto] lg:items-center ${
          open ? "cursor-pointer transition-colors duration-[120ms] hover:bg-elevated/60" : ""
        }`}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-ink">{s.name}</span>
            <Tag className="shrink-0">{FAMILY[s.family]}</Tag>
          </div>
          <p className="mt-0.5 truncate text-[13px] text-faint">{s.blurb}</p>
        </div>

        <div className="min-w-0 space-y-0.5 font-mono text-xs">
          <div className="truncate text-mute">&ldquo;{s.request.provenance.user_intent}&rdquo;</div>
          <div className="truncate text-faint">
            {tx.method ?? "call"}() to {short(tx.to)} on {networkLabel(tx.chain_id)}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:flex-nowrap lg:justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-faint">Expected</span>
            <DecisionBadge decision={expectedFor(s, mode)} />
          </div>
          <div className="flex min-w-[150px] items-center gap-1.5">
            {r ? (
              <>
                <DecisionBadge decision={r.verdict.decision} />
                <span className="font-mono text-xs tabular-nums text-faint">{ms(r.verdict.latency_ms)}</span>
                {r.matched_expected ? (
                  <span title="Matched the expected decision">
                    <CheckCircle size={15} weight="fill" className="text-allow" aria-hidden />
                    <span className="sr-only">Matched the expected decision</span>
                  </span>
                ) : (
                  <span title={`Expected ${resultExpected}, got ${r.verdict.decision} in ${r.verdict.mode} mode`}>
                    <WarningCircle size={15} weight="fill" className="text-quarantine" aria-hidden />
                    <span className="sr-only">
                      Expected {resultExpected}, got {r.verdict.decision}
                    </span>
                  </span>
                )}
              </>
            ) : (
              <span className="text-xs text-faint">{running ? "Running…" : "Not run"}</span>
            )}
          </div>
          <Button
            size="sm"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onRun();
            }}
            className="min-w-[96px]"
          >
            {running ? (
              <>
                <CircleNotch size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />
                Running…
              </>
            ) : (
              <>
                <Play size={13} aria-hidden />
                {r ? "Run again" : "Run"}
              </>
            )}
          </Button>
        </div>
      </div>
    </li>
  );
}

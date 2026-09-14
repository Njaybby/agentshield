"use client";

import { useCallback, useEffect, useState } from "react";
import { DecisionBadge } from "./DecisionBadge";
import type { Decision, ShieldVerdict } from "@/lib/shield/types";

interface AttackMeta {
  id: string;
  name: string;
  family: string;
  blurb: string;
  expected: Decision;
}

interface AttackResult {
  scenario: AttackMeta & { request?: unknown };
  verdict: ShieldVerdict;
  matched_expected: boolean;
}

export function AttackLab({ onComplete }: { onComplete?: () => void }) {
  const [attacks, setAttacks] = useState<AttackMeta[]>([]);
  const [selected, setSelected] = useState<string>("A1_MORSE_INJECTION");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AttackResult | null>(null);
  const [batch, setBatch] = useState<AttackResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/demo/attack")
      .then((r) => r.json())
      .then((d) => setAttacks(d.attacks ?? []))
      .catch(() => setError("Failed to load attack catalog"));
  }, []);

  const runOne = useCallback(async (id: string) => {
    setBusy(true);
    setError(null);
    setBatch(null);
    try {
      const res = await fetch("/api/demo/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "run failed");
      setResult(data);
      onComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "run failed");
    } finally {
      setBusy(false);
    }
  }, [onComplete]);

  const runAll = useCallback(async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/demo/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "batch failed");
      setBatch(data.results ?? []);
      onComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "batch failed");
    } finally {
      setBusy(false);
    }
  }, [onComplete]);

  const active = attacks.find((a) => a.id === selected);

  return (
    <div className="border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <div className="terminal-header">attack lab</div>
          <div className="text-sm font-medium">Live injection / honeypot drills</div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => runOne(selected)}
            className="btn-crimson rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {busy ? "Running…" : "Run scenario"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={runAll}
            className="rounded border border-line-strong px-3 py-1.5 text-xs text-ink hover:bg-elevated disabled:opacity-50"
          >
            Run all
          </button>
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[240px_1fr]">
        <div className="border-b border-line md:border-b-0 md:border-r">
          {attacks.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a.id)}
              className={`block w-full border-b border-line px-3 py-2.5 text-left text-sm last:border-b-0 ${
                selected === a.id ? "bg-elevated text-ink" : "text-mute hover:text-ink"
              }`}
            >
              <div className="font-medium text-ink">{a.name}</div>
              <div className="terminal-header mt-1">
                {a.family} · expect {a.expected}
              </div>
            </button>
          ))}
        </div>

        <div className="p-4">
          {active && (
            <p className="mb-4 text-sm leading-relaxed text-mute">{active.blurb}</p>
          )}
          {error && (
            <div className="mb-3 border border-block px-3 py-2 text-sm text-block">
              {error}
            </div>
          )}

          {result && (
            <VerdictDetail
              verdict={result.verdict}
              expected={result.scenario.expected}
              matched={result.matched_expected}
            />
          )}

          {batch && (
            <div className="space-y-2">
              <div className="terminal-header mb-2">
                batch · {batch.filter((b) => b.matched_expected).length}/
                {batch.length} matched expected
              </div>
              {batch.map((b) => (
                <div
                  key={b.scenario.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-line px-3 py-2 text-sm"
                >
                  <span>{b.scenario.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-mute">exp {b.scenario.expected}</span>
                    <DecisionBadge decision={b.verdict.decision} />
                    <span
                      className={
                        b.matched_expected ? "text-allow" : "text-block"
                      }
                    >
                      {b.matched_expected ? "OK" : "MISS"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!result && !batch && !error && (
            <p className="text-sm text-mute">
              Select a scenario and run it. Gate 1 + Gate 2 + CTI fire on every
              call; verdicts stream into the Flight Recorder.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function VerdictDetail({
  verdict,
  expected,
  matched,
}: {
  verdict: ShieldVerdict;
  expected: Decision;
  matched: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DecisionBadge decision={verdict.decision} pulse />
        <span className="text-sm text-mute">
          expected <span className="text-ink">{expected}</span>
          {" · "}
          <span className={matched ? "text-allow" : "text-block"}>
            {matched ? "matched" : "mismatch"}
          </span>
          {" · "}
          <span className="tabular">{verdict.latency_ms} ms</span>
        </span>
      </div>

      <div>
        <div className="terminal-header mb-2">explanations</div>
        <ul className="space-y-1 text-sm text-mute">
          {verdict.explanations.map((e) => (
            <li key={e} className="border-l border-line-strong pl-3">
              {e}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="terminal-header mb-2">gate 1 checks</div>
        <div className="max-h-48 overflow-auto border border-line">
          {verdict.gate1.checks.map((c, i) => (
            <div
              key={`${c.id}-${i}`}
              className="flex gap-3 border-b border-line px-3 py-1.5 text-xs last:border-b-0"
            >
              <span
                className={`w-14 shrink-0 tabular ${
                  c.passed ? "text-allow" : "text-block"
                }`}
              >
                {c.passed ? "PASS" : "FAIL"}
              </span>
              <span className="w-40 shrink-0 text-ink">{c.id}</span>
              <span className="text-mute">{c.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {verdict.cti_hits.length > 0 && (
        <div>
          <div className="terminal-header mb-2">cti hits</div>
          <div className="flex flex-wrap gap-2">
            {verdict.cti_hits.map((h) => (
              <span
                key={h.ioc_id}
                className="border border-line px-2 py-1 text-xs text-mute"
              >
                <span className="text-ink">{h.ioc_id}</span> · {h.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

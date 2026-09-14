"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";
import { DecisionBadge } from "@/components/DecisionBadge";
import { ms, networkLabel, short } from "@/lib/format";
import type { Scenario, Verdict } from "@/lib/types";
import { useRecentVerdicts, useScenarios } from "./useLive";

const ORDER = ["A1_MORSE_INJECTION", "A7_SOCIAL_ENGINEERING", "A3_UNLIMITED_APPROVE", "A4_INSTRUCTION_OVERRIDE", "A2_HONEYPOT_SWAP", "A5_CLEAN_SWAP"];

const PHRASES = /(ignore previous instructions|ignore previous|transfer all funds|type\(uint256\)\.max|amount=max|being retired|interim router)/gi;
const ADDRESS = /0x[0-9a-fA-F]{6,40}/g;
const MORSE = /(?:[.\-]{1,6}[ /]+){6,}[.\-]{1,6}/g;

function highlight(text: string) {
  const marks: [number, number][] = [];
  for (const re of [MORSE, PHRASES, ADDRESS]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) marks.push([m.index, m.index + m[0].length]);
  }
  marks.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let at = 0;
  for (const [s, e] of marks) {
    if (s < at) continue;
    if (s > at) out.push(text.slice(at, s));
    out.push(
      <mark key={s} className="rounded-sm bg-block/15 px-0.5 text-block">
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  }
  out.push(text.slice(at));
  return out;
}

export function AttackShowcase() {
  const { data: scenarios, failed } = useScenarios();
  const { data: verdicts } = useRecentVerdicts();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(ORDER[0]);

  const list = useMemo(
    () => (scenarios ?? []).filter((s) => ORDER.includes(s.id)).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)),
    [scenarios],
  );
  const latest = useMemo(() => {
    const m = new Map<string, Verdict>();
    for (const v of verdicts ?? []) if (v.scenario_id && !m.has(v.scenario_id)) m.set(v.scenario_id, v);
    return m;
  }, [verdicts]);

  const current = list.find((s) => s.id === active) ?? list[0];

  if (failed) {
    return <p className="text-[13px] text-faint">Scenarios are unavailable right now. Try the console.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <div role="tablist" aria-label="Attack scenarios" className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {list.length === 0 &&
          Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-14 w-56 shrink-0 lg:w-full" />)}
        {list.map((s) => {
          const on = s.id === current?.id;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(s.id)}
              className={`shrink-0 rounded-md border px-3 py-2.5 text-left transition-colors duration-150 lg:w-full ${
                on ? "border-line-strong bg-elevated" : "border-transparent hover:bg-panel"
              }`}
            >
              <div className={`text-sm ${on ? "text-ink" : "text-mute"}`}>{s.name}</div>
              <div className="mt-0.5 text-xs capitalize text-faint">{s.family === "clean" ? "Clean control" : s.family}</div>
            </button>
          );
        })}
      </div>

      <div className="min-w-0 rounded-[14px] border border-line bg-panel">
        <AnimatePresence mode="wait" initial={false}>
          {current && (
            <motion.div
              key={current.id}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            >
              <Case scenario={current} verdict={latest.get(current.id)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Case({ scenario, verdict }: { scenario: Scenario; verdict?: Verdict }) {
  const req = scenario.request;
  const tx = req.proposed_tx;
  const failing = verdict?.gate1.checks.filter((c) => !c.passed) ?? [];
  return (
    <div className="grid md:grid-cols-2">
      <div className="min-w-0 border-b border-line p-5 md:border-b-0 md:border-r">
        <div className="text-xs text-faint">The human asked</div>
        <p className="mt-1 text-[15px] text-ink">&ldquo;{req.provenance.user_intent}&rdquo;</p>
        <div className="mt-5 text-xs text-faint">What the agent read</div>
        <div className="mt-2 space-y-2">
          {req.provenance.sources.map((src, i) => (
            <pre key={i} className="whitespace-pre-wrap break-words rounded-md border border-line bg-canvas p-3 font-mono text-[12px] leading-5 text-mute">
              {highlight(src.content)}
            </pre>
          ))}
        </div>
        <div className="mt-5 text-xs text-faint">What it wanted to sign</div>
        <div className="mt-1 font-mono text-[13px] text-ink">
          {tx.method ?? "call"}() to {short(tx.to)} <span className="text-faint">on {networkLabel(tx.chain_id)}</span>
        </div>
      </div>
      <div className="flex min-w-0 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-faint">AgentShield decided</div>
          {verdict && <span className="font-mono text-xs tabular-nums text-faint">{ms(verdict.latency_ms)}</span>}
        </div>
        {verdict ? (
          <>
            <div className="mt-2">
              <DecisionBadge decision={verdict.decision} size="lg" />
            </div>
            <p className="mt-3 text-[15px] leading-relaxed text-ink [overflow-wrap:anywhere]">{verdict.operator_summary}</p>
            {failing.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {failing.slice(0, 4).map((c) => (
                  <li key={c.id} className="flex flex-col gap-0.5 text-[13px] sm:flex-row sm:gap-2">
                    <span className="shrink-0 font-mono text-xs text-faint sm:text-[13px]">{c.id}</span>
                    <span className="min-w-0 text-mute [overflow-wrap:anywhere]">{c.detail}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto pt-5 text-xs text-faint">
              Recorded {new Date(verdict.ts).toUTCString().slice(5, 22)} UTC, {verdict.mode} mode
            </div>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-faint">No recorded run yet. Expected result: {scenario.expected}.</p>
        )}
        <Link
          href="/soc?tab=lab"
          className="mt-4 inline-flex items-center gap-1 self-start text-[13px] text-mute transition-colors hover:text-ink"
        >
          Run it yourself <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

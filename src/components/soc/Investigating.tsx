"use client";

import { useEffect, useState } from "react";
import type { Mode } from "@/lib/types";

const STAGES_AGENT = [
  "strands.plan",
  "scan_provenance",
  "decode_calldata",
  "simulate_tx",
  "goplus.security",
  "registry.lookup",
  "gate1.evaluate",
  "gate2.adversarial_review",
  "strands.finalize",
];
const STAGES_FAST = ["scan_provenance", "decode_calldata", "simulate_tx", "goplus.security", "registry.lookup", "gate1.evaluate", "gate2.heuristic"];

/** Live in-flight recorder state. Stage list is the expected pipeline, not a claim of progress. */
export function Investigating({ mode, label, startedAt }: { mode: Mode; label: string; startedAt: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 87);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = Math.max(0, now - startedAt);
  const stages = mode === "agent" ? STAGES_AGENT : STAGES_FAST;
  const cursor = Math.floor(elapsed / 700) % stages.length;
  const secs = (elapsed / 1000).toFixed(1).padStart(4, "0");

  return (
    <div className="scanline relative overflow-hidden border border-quarantine/50 bg-[#0f0d08]" role="status" aria-live="polite">
      <div className="absolute inset-x-0 top-0 h-px overflow-hidden bg-quarantine/20">
        <div className="sweep h-px w-1/4 bg-quarantine" />
      </div>
      <div className="terminal-header flex flex-wrap items-center justify-between gap-2 border-b border-quarantine/20 px-4 py-1.5">
        <span className="text-quarantine">FDR-LIVE · INVESTIGATING · {mode === "agent" ? "STRANDS + BEDROCK" : "DETERMINISTIC"}</span>
        <span>REC ●</span>
      </div>
      <div className="grid gap-5 px-4 py-5 md:grid-cols-[auto_1fr] md:items-center">
        <div>
          <div className="font-mono text-5xl tabular-nums tracking-tight text-quarantine">{secs}s</div>
          <div className="mt-1 max-w-[260px] truncate font-mono text-[11px] text-mute">{label}</div>
          {mode === "agent" && (
            <div className="mt-1 font-mono text-[10px] text-mute/70">LLM investigations take 10-40s</div>
          )}
        </div>
        <ol className="grid grid-cols-1 gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-2 lg:grid-cols-3">
          {stages.map((s, i) => (
            <li key={s} className={`flex items-center gap-2 ${i === cursor ? "text-ink" : "text-mute/50"}`}>
              <span className={`h-1.5 w-1.5 ${i === cursor ? "bg-quarantine" : "bg-line-strong"}`} aria-hidden />
              {s}
              {i === cursor && <span className="blink text-quarantine">_</span>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

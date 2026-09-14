"use client";

import { useEffect, useState } from "react";
import { CircleNotch } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import type { Mode } from "@/lib/types";

const STEPS: Record<Mode, string[]> = {
  agent: [
    "Plan the investigation",
    "Scan provenance for injection",
    "Decode calldata",
    "Simulate on Base",
    "GoPlus token and address risk",
    "On-chain registry lookup",
    "Gate 1 policy firewall",
    "Gate 2 adversarial review",
    "Submit verdict",
  ],
  fast: [
    "Scan provenance for injection",
    "Decode calldata",
    "Simulate on Base",
    "GoPlus token and address risk",
    "On-chain registry lookup",
    "Gate 1 policy firewall",
    "Gate 2 heuristic",
  ],
};

// Rough pacing for the highlight only. The list is what a run usually does, not live progress.
const STEP_MS: Record<Mode, number> = { agent: 3200, fast: 160 };

export function Investigating({ mode, label, startedAt }: { mode: Mode; label: string; startedAt: number }) {
  const reduce = useReducedMotion();
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = Math.max(0, now - startedAt);
  const steps = STEPS[mode];
  const cursor = Math.min(steps.length - 1, Math.floor(elapsed / STEP_MS[mode]));

  return (
    <div role="status" aria-live="polite" className="rounded-[10px] border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <CircleNotch size={16} className={`shrink-0 text-mute ${reduce ? "" : "animate-spin"}`} aria-hidden />
          <span className="text-sm font-medium text-ink">Investigating</span>
          <span className="truncate text-[13px] text-faint">{label}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-sm tabular-nums text-ink">{(elapsed / 1000).toFixed(1)} s</span>
          <span className="text-xs text-faint">{mode === "agent" ? "usually 10 to 40 s" : "usually under 2 s"}</span>
        </div>
      </div>
      <div className="px-4 py-3">
        <div className="mb-2 text-xs text-faint">Typical steps</div>
        <ol className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s, i) => {
            const current = !reduce && i === cursor;
            return (
              <li key={s} className="flex min-w-0 items-center gap-2 text-[13px]">
                <span className="w-4 shrink-0 font-mono text-[11px] tabular-nums text-faint">{i + 1}</span>
                {current ? (
                  <motion.span
                    className="truncate text-ink"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {s}
                  </motion.span>
                ) : (
                  <span className="truncate text-mute">{s}</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

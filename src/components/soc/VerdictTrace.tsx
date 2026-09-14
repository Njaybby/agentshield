"use client";

import { useState } from "react";
import { Brain, CaretDown, CaretRight, Cpu, ShieldCheck, Wrench } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { TraceStep } from "@/lib/types";
import { ms } from "@/lib/format";
import { JsonBlock } from "./Panel";

const KIND_ICON: Record<TraceStep["kind"], Icon> = { system: Cpu, gate: ShieldCheck, tool: Wrench, model: Brain };
const KIND_BAR: Record<TraceStep["kind"], string> = {
  system: "bg-faint",
  gate: "bg-ink/80",
  tool: "bg-mute",
  model: "bg-ink",
};

export function VerdictTrace({ steps }: { steps: TraceStep[] }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set());

  if (steps.length === 0) return <p className="text-[13px] text-faint">No trace steps were recorded for this verdict.</p>;

  const starts = steps.map((s) => new Date(s.started_at).getTime());
  const t0 = Math.min(...starts);
  const end = Math.max(...steps.map((s, i) => starts[i] + s.duration_ms));
  const span = Math.max(1, end - t0, steps.reduce((a, s) => a + s.duration_ms, 0) * (Number.isFinite(t0) ? 0 : 1));

  const toggle = (i: number) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-faint">
        <span>
          {steps.length} steps, <span className="font-mono tabular-nums">{ms(end - t0)}</span> wall time
        </span>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 transition-colors hover:bg-elevated hover:text-ink"
          onClick={() => setOpen(open.size ? new Set() : new Set(steps.map((s) => s.i)))}
        >
          {open.size ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <ol className="divide-y divide-line rounded-md border border-line">
        {steps.map((s, idx) => {
          const IconCmp = KIND_ICON[s.kind] ?? Cpu;
          const offset = Math.min(99, Math.max(0, ((starts[idx] - t0) / span) * 100));
          const width = Math.max(0.8, Math.min(100 - offset, (s.duration_ms / span) * 100));
          const isOpen = open.has(s.i);
          const err = s.status === "error";
          return (
            <li key={`${s.i}-${idx}`}>
              <button
                type="button"
                onClick={() => toggle(s.i)}
                aria-expanded={isOpen}
                className="grid w-full grid-cols-[18px_1fr_auto] items-center gap-x-3 px-3 py-2 text-left transition-colors hover:bg-elevated/60 sm:grid-cols-[18px_minmax(150px,1fr)_minmax(140px,1.3fr)_72px]"
              >
                <IconCmp size={15} className={err ? "text-block" : "text-faint"} aria-label={s.kind} />
                <span className="min-w-0">
                  <span className={`block truncate font-mono text-[12.5px] ${err ? "text-block" : "text-ink"}`}>{s.name}</span>
                  <span className="text-[11px] text-faint">
                    {s.kind}
                    {err ? ", failed" : ""}
                  </span>
                </span>
                <span className="relative hidden h-2 sm:block" aria-hidden>
                  <span
                    className={`absolute inset-y-0 rounded-sm ${err ? "bg-block" : KIND_BAR[s.kind]}`}
                    style={{ left: `${offset}%`, width: `${width}%` }}
                  />
                </span>
                <span className="flex items-center justify-end gap-1 font-mono text-[11.5px] tabular-nums text-mute">
                  {ms(s.duration_ms)}
                  {isOpen ? <CaretDown size={12} aria-hidden /> : <CaretRight size={12} aria-hidden />}
                </span>
              </button>
              {isOpen && (
                <div className="grid gap-2 px-3 pb-3 md:grid-cols-2">
                  <div className="min-w-0">
                    <div className="mb-1 text-[11px] text-faint">Input</div>
                    <JsonBlock value={s.input ?? null} className="max-h-64" />
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 text-[11px] text-faint">Output</div>
                    <JsonBlock value={s.output ?? null} className="max-h-64" />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

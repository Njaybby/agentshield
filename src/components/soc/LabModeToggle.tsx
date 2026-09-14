"use client";

import type { Mode } from "@/lib/types";

const OPTIONS: { id: Mode; label: string; title: string }[] = [
  { id: "fast", label: "Fast", title: "Deterministic gates, under 2 s" },
  { id: "agent", label: "Agent", title: "Strands orchestrator + Gate 2 reviewer, 10 to 40 s" },
];

export function ModeToggle({
  mode,
  onChange,
  disabled,
  hint = true,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  disabled?: boolean;
  hint?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="inline-flex rounded-md border border-line-strong p-0.5" role="radiogroup" aria-label="Engine mode">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={mode === o.id}
            title={o.title}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={`h-7 rounded-[4px] px-3 text-[13px] transition-colors duration-[120ms] disabled:opacity-50 ${
              mode === o.id ? "bg-elevated text-ink" : "text-mute hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && mode === "agent" && <span className="text-xs text-faint">Strands orchestrator + Gate 2 reviewer, 10 to 40 s</span>}
    </div>
  );
}

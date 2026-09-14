"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import type { Health } from "@/lib/types";
import { addressUrl, short } from "@/lib/format";
import { ExtLink } from "./Panel";

type State = "ok" | "warn" | "bad" | "idle";

const dot: Record<State, string> = {
  ok: "bg-allow",
  warn: "bg-quarantine",
  bad: "bg-block",
  idle: "bg-line-strong",
};

export function runtimeLabel(h: Health | null) {
  if (!h) return "-";
  return h.runtime === "agentcore" ? "Bedrock AgentCore" : h.runtime === "vercel" ? "Vercel" : "Local";
}

function modelLabel(h: Health | null) {
  if (!h) return "-";
  return h.model_provider === "none" ? "No model, fast mode only" : h.model_provider;
}

export function HealthPill({ health, offline }: { health: Health | null; offline: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const state: State = offline
    ? "bad"
    : !health
      ? "idle"
      : health.chain_rpc && health.store === "clickhouse" && health.strands_ready
        ? "ok"
        : "warn";

  const label = offline ? "Agent unreachable" : health ? runtimeLabel(health) : "Connecting…";

  const rows: [string, React.ReactNode, State][] = [
    ["Runtime", runtimeLabel(health), health ? "ok" : "idle"],
    ["Model", modelLabel(health), health ? (health.model_provider === "none" ? "warn" : "ok") : "idle"],
    ["Strands agent", health ? (health.strands_ready ? "Ready" : "Not ready") : "-", health ? (health.strands_ready ? "ok" : "warn") : "idle"],
    ["Store", health ? (health.store === "clickhouse" ? "ClickHouse" : "In memory") : "-", health ? (health.store === "clickhouse" ? "ok" : "warn") : "idle"],
    ["Base RPC", health ? (health.chain_rpc ? "Connected" : "Down") : "-", health ? (health.chain_rpc ? "ok" : "bad") : "idle"],
    [
      "Registry",
      health?.registry_address ? (
        <ExtLink href={addressUrl(84532, health.registry_address)} className="text-ink">
          {short(health.registry_address, 4)}
        </ExtLink>
      ) : health ? (
        "Not configured"
      ) : (
        "-"
      ),
      health ? (health.registry_address ? "ok" : "warn") : "idle",
    ],
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex h-8 items-center gap-2 rounded-md border border-line-strong px-2.5 text-[13px] text-mute transition-colors duration-[120ms] hover:border-[#3f3f46] hover:text-ink"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dot[state]} ${state === "bad" ? "pulse-block" : ""}`} aria-hidden />
        <span className="max-w-[160px] truncate">{label}</span>
        <CaretDown size={12} className={`transition-transform duration-[200ms] ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="System health"
          className="stamp absolute right-0 top-10 z-30 w-72 origin-top-right rounded-[10px] border border-line-strong bg-panel p-1.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]"
        >
          <div className="px-2.5 pb-1.5 pt-1 text-xs text-faint">System health</div>
          <dl>
            {rows.map(([k, v, s]) => (
              <div key={k} className="flex items-center justify-between gap-3 rounded-md px-2.5 py-2 text-[13px]">
                <dt className="flex items-center gap-2 text-mute">
                  <span className={`h-1.5 w-1.5 rounded-full ${dot[s]}`} aria-hidden />
                  {k}
                </dt>
                <dd className="truncate text-right text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          {offline && <div className="mx-2.5 mb-1.5 mt-1 break-all rounded-md bg-block/[0.06] px-2 py-1.5 font-mono text-[11px] text-block">{offline}</div>}
        </div>
      )}
    </div>
  );
}

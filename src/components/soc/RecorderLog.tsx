"use client";

import { useCallback, useEffect, useState } from "react";
import type { Decision, Verdict } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { DecisionBadge, StatusTag } from "@/components/DecisionBadge";
import { OfflineState, Panel } from "./Panel";
import { clock, ms, short } from "@/lib/format";

export function RecorderLog({ rev, onOpen }: { rev: number; onOpen: (v: Verdict) => void }) {
  const [rows, setRows] = useState<Verdict[] | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [filter, setFilter] = useState<Decision | "ALL">("ALL");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const res = await rpc<{ verdicts: Verdict[] }>("telemetry", { view: "verdicts" });
    if (hasError(res)) return setOffline(res.error);
    setOffline(null);
    setRows(res.verdicts);
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(() => document.visibilityState === "visible" && load(), 5000);
    return () => window.clearInterval(id);
  }, [load, rev]);

  if (offline && !rows) return <OfflineState error={offline} onRetry={load} />;

  const needle = q.trim().toLowerCase();
  const shown = (rows ?? []).filter(
    (v) =>
      (filter === "ALL" || v.decision === filter) &&
      (!needle || [v.id, v.agent_id, v.scenario_id ?? "", v.proposed_tx.to, v.gate2.attack_class].some((s) => s.toLowerCase().includes(needle))),
  );

  return (
    <Panel
      code="FDR-50"
      label="RECORDER · VERDICT LOG"
      meta={[`${rows?.length ?? 0} ROWS`, "agentshield.verdicts"]}
      right={
        <div className="flex flex-wrap items-center gap-1">
          {(["ALL", "BLOCK", "QUARANTINE", "ALLOW"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setFilter(d)}
              className={`px-2 py-0.5 font-mono text-[10px] tracking-wider ${filter === d ? "bg-ink text-black" : "text-mute hover:text-ink"}`}
            >
              {d}
            </button>
          ))}
          <input className="field !ml-1 !w-40 !py-0.5 font-mono !text-[11px]" placeholder="filter id / agent / addr" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-xs">
          <thead className="terminal-header">
            <tr className="border-b border-line">
              <th className="px-3 py-2 font-normal">time utc</th>
              <th className="px-3 py-2 font-normal">decision</th>
              <th className="px-3 py-2 font-normal">status</th>
              <th className="px-3 py-2 font-normal">agent · scenario</th>
              <th className="px-3 py-2 font-normal">tx</th>
              <th className="px-3 py-2 font-normal">class</th>
              <th className="px-3 py-2 text-right font-normal">hijack</th>
              <th className="px-3 py-2 text-right font-normal">latency</th>
              <th className="px-3 py-2 font-normal">mode</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows === null &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i} className="border-b border-line">
                  <td colSpan={9} className="h-9 animate-pulse bg-panel" />
                </tr>
              ))}
            {rows !== null && shown.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center font-sans text-sm text-mute">
                  {rows.length === 0 ? "Recorder is empty. Run the Attack Lab to write the first verdicts." : "No rows match this filter."}
                </td>
              </tr>
            )}
            {shown.map((v) => (
              <tr key={v.id} onClick={() => onOpen(v)} className="cursor-pointer border-b border-line last:border-b-0 hover:bg-elevated">
                <td className="whitespace-nowrap px-3 py-2 text-mute">{clock(v.ts)}</td>
                <td className="px-3 py-2">
                  <DecisionBadge decision={v.decision} />
                </td>
                <td className="px-3 py-2">
                  <StatusTag status={v.status} />
                </td>
                <td className="max-w-[220px] truncate px-3 py-2 text-ink">
                  {v.agent_id} <span className="text-mute">· {v.scenario_id ?? "custom"}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-mute">
                  {v.proposed_tx.method ?? "call"}() → <span className="text-ink/80">{short(v.proposed_tx.to, 4)}</span>
                </td>
                <td className={`px-3 py-2 ${v.gate2.attack_class === "none" ? "text-mute/60" : "text-ink"}`}>{v.gate2.attack_class}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${v.gate2.hijack_likelihood >= 0.7 ? "text-block" : "text-ink"}`}>
                  {Math.round(v.gate2.hijack_likelihood * 100)}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-mute">{ms(v.latency_ms)}</td>
                <td className="px-3 py-2 uppercase text-mute">{v.mode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

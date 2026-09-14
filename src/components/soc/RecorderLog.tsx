"use client";

import type { Verdict } from "@/lib/types";
import { DecisionBadge, StatusTag } from "@/components/DecisionBadge";
import { clock, ms, relTime, short } from "@/lib/format";
import { Skeleton } from "@/components/ui/States";

/** Verdict log table used by the Overview live feed. */
export function VerdictTable({
  rows,
  onOpen,
  now,
  skeletonRows = 8,
}: {
  rows: Verdict[] | null;
  onOpen: (v: Verdict) => void;
  now: number;
  skeletonRows?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line text-xs text-faint">
            <th className="h-9 px-4 font-normal">Time</th>
            <th className="h-9 px-4 font-normal">Agent</th>
            <th className="h-9 px-4 font-normal">Action</th>
            <th className="h-9 px-4 font-normal">Decision</th>
            <th className="h-9 px-4 font-normal">Mode</th>
            <th className="h-9 px-4 text-right font-normal">Latency</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows === null &&
            Array.from({ length: skeletonRows }, (_, i) => (
              <tr key={i}>
                <td colSpan={6} className="h-11 px-4">
                  <Skeleton className="h-4 w-full" />
                </td>
              </tr>
            ))}
          {rows?.map((v) => (
            <tr
              key={v.id}
              tabIndex={0}
              onClick={() => onOpen(v)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(v))}
              className="h-11 cursor-pointer transition-colors duration-[120ms] hover:bg-elevated focus-visible:bg-elevated focus-visible:outline-none"
            >
              <td className="whitespace-nowrap px-4 font-mono text-xs tabular-nums text-faint" title={`${clock(v.ts)} UTC`}>
                {relTime(v.ts, now)}
              </td>
              <td className="max-w-[200px] px-4">
                <div className="truncate text-ink">{v.agent_id}</div>
              </td>
              <td className="whitespace-nowrap px-4 font-mono text-xs">
                <span className="text-ink">{v.proposed_tx.method ?? "call"}()</span>
                <span className="ml-1.5 text-faint">{short(v.proposed_tx.to, 4)}</span>
              </td>
              <td className="px-4">
                <div className="flex items-center gap-1.5">
                  <DecisionBadge decision={v.decision} />
                  {v.status !== "final" && <StatusTag status={v.status} />}
                </div>
              </td>
              <td className="px-4 text-mute">{v.mode === "agent" ? "Agent" : "Fast"}</td>
              <td className="whitespace-nowrap px-4 text-right font-mono text-xs tabular-nums text-mute">{ms(v.latency_ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

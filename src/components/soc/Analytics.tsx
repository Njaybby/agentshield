"use client";

import { useCallback, useEffect, useState } from "react";
import type { Analytics as AnalyticsData, Decision } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { OfflineState, Panel } from "./Panel";
import { clock, ms } from "@/lib/format";

const COLORS: Record<Decision, string> = { BLOCK: "#ef4444", QUARANTINE: "#f5a524", ALLOW: "#22c55e" };
const STACK: Decision[] = ["BLOCK", "QUARANTINE", "ALLOW"]; // bottom to top: attacks anchor the baseline

export function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const res = await rpc<AnalyticsData>("telemetry", { view: "analytics" });
    if (hasError(res)) {
      setOffline(res.error);
      return;
    }
    setOffline(null);
    setData(res);
    setFetchedAt(new Date());
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(() => document.visibilityState === "visible" && load(), 5000);
    return () => window.clearInterval(id);
  }, [load]);

  if (offline && !data) return <OfflineState error={offline} onRetry={load} />;
  if (!data) return <div className="h-96 animate-pulse border border-line bg-panel" />;

  const src = data.source === "clickhouse" ? "CLICKHOUSE" : "MEMORY FALLBACK";
  const maxClass = Math.max(1, ...data.attack_classes.map((c) => c.count));
  const maxCheck = Math.max(1, ...data.top_failing_checks.map((c) => c.count));

  return (
    <div className="space-y-3">
      {offline && <div className="font-mono text-[11px] text-block">STALE · last refresh failed: {offline}</div>}

      <Panel
        code="FDR-40"
        label="DECISIONS / MIN"
        meta={[`SRC ${src}`, `${data.timeline.length} BUCKETS`, `POLL 5S`, fetchedAt ? `SYNC ${clock(fetchedAt)}` : null]}
        bodyClassName="p-4"
      >
        <Timeline rows={data.timeline} />
      </Panel>

      <div className="grid gap-3 md:grid-cols-3">
        {(["p50", "p95", "p99"] as const).map((k) => (
          <div key={k} className="border border-line bg-panel px-4 py-3">
            <div className="terminal-header">latency {k}</div>
            <div className="mt-1 font-mono text-3xl tabular-nums tracking-tight text-ink">{ms(data.latency[k])}</div>
            <div className="mt-1 font-mono text-[10px] text-mute">{k === "p50" ? "fast path dominates" : "agent-mode LLM investigations"}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel code="FDR-41" label="ATTACK CLASSES" meta={[`${data.attack_classes.reduce((a, c) => a + c.count, 0)} EVENTS`]} bodyClassName="space-y-2.5 p-4">
          {data.attack_classes.length === 0 && <p className="text-sm text-mute">No attacks recorded yet.</p>}
          {data.attack_classes.map((c) => (
            <Bar key={c.attack_class} label={c.attack_class} value={c.count} max={maxClass} color={c.attack_class === "novel_counterparty" ? "#f5a524" : "#ef4444"} />
          ))}
        </Panel>
        <Panel code="FDR-42" label="TOP FAILING CHECKS" meta={["GATE 1"]} bodyClassName="space-y-2.5 p-4">
          {data.top_failing_checks.length === 0 && <p className="text-sm text-mute">No failing checks recorded yet.</p>}
          {data.top_failing_checks.map((c) => (
            <Bar key={c.check_id} label={c.check_id} value={c.count} max={maxCheck} color="#e8e8e8" />
          ))}
        </Panel>
      </div>

      <Panel code="FDR-43" label="AGENT ANOMALIES" meta={["Z-SCORE VS BASELINE", `FLAG ≥ 3.0`]}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left font-mono text-xs">
            <thead className="terminal-header">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-normal">agent</th>
                <th className="px-4 py-2 text-right font-normal">window</th>
                <th className="px-4 py-2 text-right font-normal">baseline μ</th>
                <th className="px-4 py-2 font-normal">z-score</th>
                <th className="px-4 py-2 font-normal">status</th>
              </tr>
            </thead>
            <tbody>
              {data.anomalies.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-mute">
                    Not enough history for a baseline yet.
                  </td>
                </tr>
              )}
              {[...data.anomalies]
                .sort((a, b) => b.zscore - a.zscore)
                .map((a) => {
                  const w = Math.min(100, (Math.abs(a.zscore) / 5) * 100);
                  return (
                    <tr key={a.agent_id} className={`border-b border-line last:border-b-0 ${a.flagged ? "bg-block/[0.05]" : ""}`}>
                      <td className="px-4 py-2.5 text-ink">{a.agent_id}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-ink">{a.window_count}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-mute">{a.baseline_mean.toFixed(1)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="relative h-1.5 w-24 bg-line/70">
                            <span className={`absolute inset-y-0 left-0 ${a.flagged ? "bg-block" : "bg-mute/60"}`} style={{ width: `${w}%` }} />
                            <span className="absolute inset-y-[-3px] w-px bg-line-strong" style={{ left: "60%" }} aria-hidden />
                          </span>
                          <span className={`tabular-nums ${a.flagged ? "text-block" : "text-ink"}`}>{a.zscore.toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {a.flagged ? (
                          <span className="border border-block/60 px-1.5 py-0.5 text-[10px] tracking-wider text-block">▲ ANOMALOUS</span>
                        ) : (
                          <span className="text-[10px] tracking-wider text-mute">NOMINAL</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,180px)_1fr_40px] items-center gap-3">
      <span className="truncate font-mono text-[11px] text-ink/90" title={label}>
        {label}
      </span>
      <span className="h-2 bg-line/50">
        <span className="block h-full rounded-r-[2px]" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
      <span className="text-right font-mono text-[11px] tabular-nums text-ink">{value}</span>
    </div>
  );
}

function Timeline({ rows }: { rows: AnalyticsData["timeline"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 960;
  const H = 220;
  const pad = { l: 28, r: 8, t: 8, b: 22 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const totals = rows.map((r) => r.ALLOW + r.BLOCK + r.QUARANTINE);
  const rawMax = Math.max(1, ...totals);
  const niceMax = Math.ceil(rawMax / 4) * 4;
  const slot = innerW / Math.max(1, rows.length);
  const barW = Math.max(2, slot * 0.72);
  const y = (v: number) => (v / niceMax) * innerH;
  const sums = STACK.map((d) => rows.reduce((a, r) => a + r[d], 0));
  const labelEvery = Math.max(1, Math.ceil(rows.length / 8));
  const hr = hover !== null ? rows[hover] : null;

  if (rows.length === 0) return <p className="py-10 text-center text-sm text-mute">No verdicts in the window yet.</p>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px]">
        {STACK.map((d, i) => (
          <span key={d} className="flex items-center gap-1.5 text-mute">
            <span className="h-2 w-2" style={{ background: COLORS[d] }} aria-hidden />
            {d} <span className="text-ink tabular-nums">{sums[i]}</span>
          </span>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Stacked decisions per minute" onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((f) => {
            const yy = pad.t + innerH - f * innerH;
            return (
              <g key={f}>
                <line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke="#222" strokeWidth={1} />
                <text x={pad.l - 6} y={yy + 3} textAnchor="end" fontSize={10} fill="#6b6b6b" fontFamily="var(--font-geist-mono)">
                  {Math.round(niceMax * f)}
                </text>
              </g>
            );
          })}
          {rows.map((r, i) => {
            const x = pad.l + i * slot + (slot - barW) / 2;
            let base = pad.t + innerH;
            return (
              <g key={r.bucket} opacity={hover === null || hover === i ? 1 : 0.45}>
                {STACK.map((d) => {
                  const h = y(r[d]);
                  if (h <= 0) return null;
                  const seg = Math.max(1, h - 2); // 2px surface gap between stacked segments
                  base -= h;
                  return <rect key={d} x={x} y={base + (h - seg)} width={barW} height={seg} fill={COLORS[d]} rx={1} />;
                })}
                {i % labelEvery === 0 && (
                  <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#6b6b6b" fontFamily="var(--font-geist-mono)">
                    {r.bucket.slice(11, 16)}
                  </text>
                )}
                <rect x={pad.l + i * slot} y={pad.t} width={slot} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
        {hr && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-[140px] border border-line-strong bg-canvas/95 px-3 py-2 font-mono text-[11px] shadow-lg"
            style={{
              left: `${((pad.l + hover * slot + slot / 2) / W) * 100}%`,
              transform: `translateX(${hover > rows.length / 2 ? "-105%" : "5%"})`,
            }}
          >
            <div className="mb-1 text-mute">{hr.bucket.slice(11, 16)} UTC</div>
            {[...STACK].reverse().map((d) => (
              <div key={d} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-mute">
                  <span className="h-1.5 w-1.5" style={{ background: COLORS[d] }} />
                  {d}
                </span>
                <span className="tabular-nums text-ink">{hr[d]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

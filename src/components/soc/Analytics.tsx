"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChartBar } from "@phosphor-icons/react";
import type { Analytics as AnalyticsData, Decision } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { clock, ms } from "@/lib/format";
import { EmptyState, Skeleton, Stat, Tag } from "@/components/ui/States";
import { OfflineState, Panel } from "./Panel";

const COLORS: Record<Decision, string> = { BLOCK: "#f0565c", QUARANTINE: "#f2b441", ALLOW: "#3ecf8e" };
const LABELS: Record<Decision, string> = { BLOCK: "Blocked", QUARANTINE: "Quarantined", ALLOW: "Allowed" };
const STACK: Decision[] = ["BLOCK", "QUARANTINE", "ALLOW"]; // bottom to top

function sentence(s: string) {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

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
  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-[300px] w-full rounded-[10px]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-[10px]" />
          <Skeleton className="h-56 w-full rounded-[10px]" />
        </div>
      </div>
    );

  const source = data.source === "clickhouse" ? "ClickHouse" : "In-memory store";
  const classes = data.attack_classes.filter((c) => c.attack_class !== "none");
  const maxClass = Math.max(1, ...classes.map((c) => c.count));
  const maxCheck = Math.max(1, ...data.top_failing_checks.map((c) => c.count));

  return (
    <div className="space-y-4">
      {offline && <div className="text-xs text-block">Showing the last good data. Refresh failed: {offline}</div>}

      <Panel label="Decisions per minute" meta={[source, fetchedAt ? `Updated ${clock(fetchedAt).slice(0, 8)} UTC` : null]} bodyClassName="p-4">
        <Timeline rows={data.timeline} />
      </Panel>

      <Panel label="Latency" meta={["Across every check in the window"]} bodyClassName="grid grid-cols-3 gap-6 px-4 py-4">
        <Stat label="p50" value={ms(data.latency.p50)} hint="Median check" />
        <Stat label="p95" value={ms(data.latency.p95)} hint="Mostly agent-mode runs" />
        <Stat label="p99" value={ms(data.latency.p99)} hint="Slowest investigations" />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel label="Attack classes" meta={[`${classes.reduce((a, c) => a + c.count, 0)} events`]} className="min-w-0" bodyClassName="p-4">
          {classes.length === 0 ? (
            <EmptyState title="No attacks recorded yet" />
          ) : (
            <ol className="space-y-3">
              {classes.map((c, i) => (
                <Ranked key={c.attack_class} rank={i + 1} label={sentence(c.attack_class)} value={c.count} max={maxClass} color={c.attack_class === "novel_counterparty" ? COLORS.QUARANTINE : COLORS.BLOCK} />
              ))}
            </ol>
          )}
        </Panel>
        <Panel label="Top failing checks" meta={["Gate 1"]} className="min-w-0" bodyClassName="p-4">
          {data.top_failing_checks.length === 0 ? (
            <EmptyState title="No failing checks yet" />
          ) : (
            <ol className="space-y-3">
              {data.top_failing_checks.map((c, i) => (
                <Ranked key={c.check_id} rank={i + 1} label={c.check_id} mono value={c.count} max={maxCheck} color="rgba(237,237,239,0.6)" />
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel label="Agent anomalies" meta={["Last 5 minutes against the previous hour", "flagged at z 3.0 or higher"]} className="min-w-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-xs text-faint">
                <th className="h-9 px-4 font-normal">Agent</th>
                <th className="h-9 px-4 text-right font-normal">Last 5 min</th>
                <th className="h-9 px-4 text-right font-normal">Baseline mean</th>
                <th className="h-9 px-4 font-normal">Z-score</th>
                <th className="h-9 px-4 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.anomalies.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon={<ChartBar size={22} />} title="Not enough history for a baseline yet" />
                  </td>
                </tr>
              )}
              {[...data.anomalies]
                .sort((a, b) => b.zscore - a.zscore)
                .map((a) => (
                  <tr key={a.agent_id} className="h-11">
                    <td className="px-4 text-ink">{a.agent_id}</td>
                    <td className="px-4 text-right font-mono text-xs tabular-nums text-ink">{a.window_count}</td>
                    <td className="px-4 text-right font-mono text-xs tabular-nums text-mute">{a.baseline_mean.toFixed(1)}</td>
                    <td className="px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="block h-[3px] w-20" aria-hidden>
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${Math.min(100, (Math.abs(a.zscore) / 5) * 100)}%`, background: a.flagged ? COLORS.BLOCK : "rgba(237,237,239,0.45)" }}
                          />
                        </span>
                        <span className={`font-mono text-xs tabular-nums ${a.flagged ? "text-block" : "text-ink"}`}>{a.zscore.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-4">{a.flagged ? <Tag className="border-block/35 bg-block/10 !text-block">Flagged</Tag> : <span className="text-xs text-faint">Normal</span>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function Ranked({ rank, label, value, max, color, mono }: { rank: number; label: string; value: number; max: number; color: string; mono?: boolean }) {
  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
      <span className="font-mono text-xs tabular-nums text-faint">{rank}</span>
      <span className={`truncate text-ink ${mono ? "font-mono text-xs" : "text-[13px]"}`} title={label}>
        {label}
      </span>
      <span className="font-mono text-xs tabular-nums text-ink">{value}</span>
      <span className="col-start-2 col-end-4 block h-[3px]" aria-hidden>
        <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (value / max) * 100)}%`, background: color }} />
      </span>
    </li>
  );
}

function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

function Timeline({ rows }: { rows: AnalyticsData["timeline"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(960);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [rows.length]);

  if (rows.length === 0) return <EmptyState icon={<ChartBar size={22} />} title="No verdicts in the window yet" body="Run the Attack Lab to populate this chart." />;

  // Draw in CSS pixels so axis text stays 11px at every width.
  const W = width;
  const H = width < 640 ? 180 : 240;
  const pad = { l: 32, r: 8, t: 10, b: 24 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const totals = rows.map((r) => r.ALLOW + r.BLOCK + r.QUARANTINE);
  const niceMax = Math.max(4, Math.ceil(Math.max(1, ...totals) / 4) * 4);
  const slot = innerW / rows.length;
  const barW = Math.max(3, Math.min(28, slot * 0.55));
  const y = (v: number) => (v / niceMax) * innerH;
  const sums = STACK.map((d) => rows.reduce((a, r) => a + r[d], 0));
  const labelEvery = Math.max(1, Math.ceil(rows.length / 8));
  const hr = hover !== null ? rows[hover] : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        {STACK.map((d, i) => (
          <span key={d} className="flex items-center gap-1.5 text-mute">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: COLORS[d], opacity: 0.85 }} aria-hidden />
            {LABELS[d]}
            <span className="font-mono tabular-nums text-ink">{sums[i]}</span>
          </span>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Stacked decisions per minute" onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((f) => {
            const yy = pad.t + innerH - f * innerH;
            return (
              <g key={f}>
                <line x1={pad.l} x2={W - pad.r} y1={yy} y2={yy} stroke="#1f1f23" strokeWidth={1} />
                <text x={pad.l - 8} y={yy + 4} textAnchor="end" fontSize={11} fill="#71717a" fontFamily="var(--font-geist-mono)">
                  {Math.round(niceMax * f)}
                </text>
              </g>
            );
          })}
          {rows.map((r, i) => {
            const x = pad.l + i * slot + (slot - barW) / 2;
            const segs = STACK.filter((d) => r[d] > 0);
            let base = pad.t + innerH;
            return (
              <g key={r.bucket} opacity={hover === null || hover === i ? 1 : 0.4} className="transition-opacity duration-[120ms]">
                {segs.map((d, si) => {
                  const h = y(r[d]);
                  const gap = si < segs.length - 1 ? 1.5 : 0;
                  base -= h;
                  const top = si === segs.length - 1;
                  const segH = Math.max(1, h - gap);
                  const segY = base + gap;
                  return top ? (
                    <path key={d} d={topRounded(x, segY, barW, segH, 2)} fill={COLORS[d]} fillOpacity={0.85} />
                  ) : (
                    <rect key={d} x={x} y={segY} width={barW} height={segH} fill={COLORS[d]} fillOpacity={0.85} />
                  );
                })}
                {i % labelEvery === 0 && (
                  <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="#71717a" fontFamily="var(--font-geist-mono)">
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
            className="pointer-events-none absolute top-0 z-10 min-w-[160px] rounded-md border border-line-strong bg-panel px-3 py-2 text-xs shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]"
            style={{
              left: `${((pad.l + hover * slot + slot / 2) / W) * 100}%`,
              transform: `translateX(${hover > rows.length / 2 ? "-108%" : "8%"})`,
            }}
          >
            <div className="mb-1.5 font-mono text-faint">{hr.bucket.slice(11, 16)} UTC</div>
            {[...STACK].reverse().map((d) => (
              <div key={d} className="flex items-center justify-between gap-4 py-0.5">
                <span className="flex items-center gap-1.5 text-mute">
                  <span className="h-1.5 w-1.5 rounded-[2px]" style={{ background: COLORS[d] }} />
                  {LABELS[d]}
                </span>
                <span className="font-mono tabular-nums text-ink">{hr[d]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

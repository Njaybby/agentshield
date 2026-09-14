"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle, Pulse } from "@phosphor-icons/react";
import type { Decision, Overview as OverviewData, Verdict } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { ms, relTime } from "@/lib/format";
import { DecisionBadge } from "@/components/DecisionBadge";
import { Button } from "@/components/ui/Button";
import { EmptyState, Skeleton, Stat } from "@/components/ui/States";
import { OfflineState, Panel } from "./Panel";
import { VerdictTable } from "./RecorderLog";

const FILTERS: [Decision | "ALL", string][] = [
  ["ALL", "All"],
  ["BLOCK", "Blocked"],
  ["QUARANTINE", "Quarantined"],
  ["ALLOW", "Allowed"],
];

const FEED_PAGE = 20;

export function Overview({
  overview,
  offline,
  rev,
  onOpen,
  onReview,
  onRunAttack,
}: {
  overview: OverviewData | null;
  offline: string | null;
  rev: number;
  onOpen: (v: Verdict) => void;
  onReview: () => void;
  onRunAttack: () => void;
}) {
  const [rows, setRows] = useState<Verdict[] | null>(null);
  const [pending, setPending] = useState<Verdict[] | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Decision | "ALL">("ALL");
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const [v, p] = await Promise.all([
      rpc<{ verdicts: Verdict[] }>("telemetry", { view: "verdicts" }),
      rpc<{ verdicts: Verdict[] }>("telemetry", { view: "pending" }),
    ]);
    if (hasError(v)) setFeedError(v.error);
    else {
      setFeedError(null);
      setRows(v.verdicts);
    }
    if (!hasError(p)) setPending(p.verdicts);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    load();
    const poll = window.setInterval(() => document.visibilityState === "visible" && load(), 5000);
    const tick = window.setInterval(() => setNow(Date.now()), 15000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [load, rev]);

  const s = overview?.stats;
  const hasData = s && s.total > 0;
  const filtered = rows?.filter((v) => filter === "ALL" || v.decision === filter) ?? null;
  const shown = filtered ? filtered.slice(0, expanded ? 200 : FEED_PAGE) : null;

  return (
    <div className="space-y-6">
      <section aria-label="Summary" className="grid grid-cols-2 gap-x-8 gap-y-6 border-b border-line pb-6 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
        <div className="col-span-2 flex items-center gap-4 sm:col-span-3 lg:col-span-1">
          <Ring pct={hasData ? s.auto_resolved_pct : null} />
          <Stat
            size="lg"
            label="Auto-resolved"
            value={s ? (hasData ? `${Math.round(s.auto_resolved_pct)}%` : "-") : <Skeleton className="mt-1 h-9 w-24" />}
            hint="Allowed or blocked without paging a human"
          />
        </div>
        <Stat label="Checks" value={s ? s.total.toLocaleString() : <Skeleton className="mt-1 h-8 w-16" />} />
        <Stat label="Blocked" tone={s && s.blocked > 0 ? "text-block" : "text-ink"} value={s ? s.blocked.toLocaleString() : <Skeleton className="mt-1 h-8 w-16" />} />
        <button
          type="button"
          onClick={onReview}
          className="group -m-2 flex flex-col self-start rounded-md p-2 text-left transition-colors duration-[120ms] hover:bg-elevated"
        >
          <Stat
            label={
              <span className="inline-flex items-center gap-1">
                Awaiting review
                <ArrowRight size={12} className="opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </span>
            }
            tone={s && s.pending_review > 0 ? "text-quarantine" : "text-ink"}
            value={s ? s.pending_review.toLocaleString() : <Skeleton className="mt-1 h-8 w-12" />}
          />
        </button>
        <Stat label="Avg latency" value={s ? (hasData ? ms(s.avg_latency_ms) : "-") : <Skeleton className="mt-1 h-8 w-20" />} />
      </section>

      {offline && !rows && <OfflineState error={offline} onRetry={load} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          label="Live decisions"
          meta={["Refreshes every 5 seconds"]}
          className="min-w-0 lg:col-span-2"
          right={
            <div role="radiogroup" aria-label="Filter by decision" className="flex rounded-md border border-line p-0.5">
              {FILTERS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={filter === id}
                  onClick={() => setFilter(id)}
                  className={`h-6 rounded px-2 text-xs transition-colors duration-[120ms] ${filter === id ? "bg-elevated text-ink" : "text-faint hover:text-ink"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          {feedError && rows && <div className="border-b border-line px-4 py-2 text-xs text-block">Last refresh failed: {feedError}</div>}
          {rows !== null && rows.length === 0 ? (
            <EmptyState
              icon={<Pulse size={24} />}
              title="No decisions yet"
              body="Run an attack scenario or send a transaction through the SDK to write the first verdict."
              action={
                <Button variant="primary" size="sm" onClick={onRunAttack}>
                  Run attack
                </Button>
              }
            />
          ) : filtered !== null && filtered.length === 0 ? (
            <EmptyState title="Nothing matches this filter" />
          ) : (
            <>
              <VerdictTable rows={shown} onOpen={onOpen} now={now} />
              {filtered && filtered.length > FEED_PAGE && (
                <div className="border-t border-line px-4 py-2">
                  <Button variant="ghost" size="sm" onClick={() => setExpanded((e) => !e)}>
                    {expanded ? "Show fewer" : `Show all ${Math.min(filtered.length, 200)}`}
                  </Button>
                </div>
              )}
            </>
          )}
        </Panel>

        <Panel
          label="Needs review"
          meta={pending && pending.length > 0 ? [`${pending.length} waiting`] : []}
          className="min-w-0"
          right={
            pending && pending.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={onReview}>
                Open queue
              </Button>
            ) : null
          }
        >
          {pending === null ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <EmptyState icon={<CheckCircle size={24} />} title="Nothing waiting" body="Quarantined transactions land here for an approve or deny." />
          ) : (
            <ul className="divide-y divide-line">
              {pending.slice(0, 6).map((v) => (
                <li key={v.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <DecisionBadge decision={v.decision} />
                      <span className="truncate text-[13px] text-ink">{v.agent_id}</span>
                    </div>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-faint">{relTime(v.ts, now)}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-mute">{v.operator_summary}</p>
                  <div className="mt-2">
                    <Button size="sm" onClick={() => onOpen(v)}>
                      Review
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Ring({ pct }: { pct: number | null }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const v = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0 -rotate-90" aria-hidden>
      <circle cx="18" cy="18" r={r} fill="none" stroke="#2e2e33" strokeWidth="2.5" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="#ededef"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v / 100)}
        className="transition-[stroke-dashoffset] duration-[320ms] ease-[cubic-bezier(.2,0,0,1)] motion-reduce:transition-none"
      />
    </svg>
  );
}

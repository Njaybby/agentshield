"use client";

import { useCallback, useEffect, useState } from "react";
import type { Verdict } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { DecisionBadge } from "@/components/DecisionBadge";
import { ExtLink, OfflineState, Panel } from "./Panel";
import { ReviewControls } from "./ReviewControls";
import { addressUrl, clock, formatEth, networkLabel, relTime } from "@/lib/format";

export function ReviewQueue({
  rev,
  onOpen,
  onReviewed,
}: {
  rev: number;
  onOpen: (v: Verdict) => void;
  onReviewed: (v: Verdict) => void;
}) {
  const [pending, setPending] = useState<Verdict[] | null>(null);
  const [resolved, setResolved] = useState<Verdict[]>([]);
  const [offline, setOffline] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await rpc<{ verdicts: Verdict[] }>("telemetry", { view: "pending" });
    if (hasError(res)) {
      if (res.offline) setOffline(res.error);
      return;
    }
    setOffline(null);
    setPending(res.verdicts);
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(() => document.visibilityState === "visible" && load(), 5000);
    return () => window.clearInterval(id);
  }, [load, rev]);

  const handle = (v: Verdict) => {
    setPending((p) => (p ?? []).filter((x) => x.id !== v.id));
    setResolved((r) => [v, ...r.filter((x) => x.id !== v.id)]);
    onReviewed(v);
  };

  const list = (pending ?? []).filter((p) => !resolved.some((r) => r.id === p.id));

  return (
    <div className="space-y-3">
      <Panel
        code="FDR-20"
        label="REVIEW QUEUE"
        meta={[`${list.length} AWAITING OPERATOR`, "HUMAN-IN-THE-LOOP"]}
        bodyClassName="px-4 py-3"
      >
        <p className="max-w-3xl text-sm text-mute">
          QUARANTINE means the shield found no proof of attack but won&apos;t let an autonomous agent sign alone.
          The transaction is frozen until you decide. Your call, note and identity are written to the recorder.
        </p>
      </Panel>

      {offline && <OfflineState error={offline} onRetry={load} />}

      {pending === null && !offline && <div className="h-40 animate-pulse border border-line bg-panel" />}

      {pending !== null && list.length === 0 && (
        <div className="grid-dots flex flex-col items-center justify-center gap-2 border border-line bg-panel px-4 py-14 text-center">
          <span className="font-mono text-xs tracking-[0.16em] text-allow">QUEUE CLEAR</span>
          <p className="max-w-md text-sm text-mute">
            Nothing is waiting on a human. Run <span className="font-mono text-ink">A6 · First-seen vault deposit</span> in the
            Attack Lab to produce a quarantine.
          </p>
        </div>
      )}

      {list.map((v) => (
        <PendingCard key={v.id} verdict={v} onOpen={onOpen} onReviewed={handle} />
      ))}

      {resolved.length > 0 && (
        <Panel code="FDR-21" label="RESOLVED THIS SESSION" meta={[`${resolved.length}`]}>
          <ul>
            {resolved.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 last:border-b-0">
                <span className={`stamp font-mono text-xs font-semibold tracking-[0.14em] ${v.status === "approved" ? "text-allow" : "text-block"}`}>
                  {v.status === "approved" ? "APPROVED" : "DENIED"}
                </span>
                <span className="font-mono text-xs text-ink">{v.scenario_id ?? v.id}</span>
                <span className="font-mono text-[11px] text-mute">
                  {v.review?.operator} · {clock(v.review?.ts)}
                </span>
                {v.review?.note && <span className="truncate text-xs text-mute">“{v.review.note}”</span>}
                <button type="button" onClick={() => onOpen(v)} className="ml-auto font-mono text-[10px] tracking-wider text-mute hover:text-ink">
                  DETAIL ▸
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function PendingCard({ verdict: v, onOpen, onReviewed }: { verdict: Verdict; onOpen: (v: Verdict) => void; onReviewed: (v: Verdict) => void }) {
  const tx = v.proposed_tx;
  const failing = v.gate1.checks.filter((c) => !c.passed);
  const pct = Math.round(v.gate2.hijack_likelihood * 100);
  return (
    <article className="relative border border-quarantine/50 bg-panel">
      <div className="absolute inset-y-0 left-0 w-1 bg-quarantine" aria-hidden />
      <div className="terminal-header flex flex-wrap items-center justify-between gap-2 border-b border-line py-1.5 pl-5 pr-3">
        <span>
          <span className="text-quarantine">HOLD</span> · {v.id} · CH {tx.chain_id} · {clock(v.ts)} · {v.agent_id}
        </span>
        <span className="text-quarantine">frozen {relTime(v.ts)}</span>
      </div>
      <div className="grid gap-5 py-4 pl-5 pr-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <DecisionBadge decision={v.decision} size="md" />
            <span className="font-mono text-[11px] text-mute">{v.scenario_id ?? "custom request"}</span>
          </div>
          <p className="text-[15px] leading-relaxed text-ink">{v.operator_summary}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-line bg-canvas p-3 font-mono text-[11px] sm:grid-cols-4">
            <div>
              <div className="text-mute/70">AMOUNT</div>
              <div className="text-ink">{tx.amount_human ?? formatEth(tx.value_wei)}</div>
            </div>
            <div>
              <div className="text-mute/70">METHOD</div>
              <div className="truncate text-ink">{tx.method ?? "-"}()</div>
            </div>
            <div className="min-w-0">
              <div className="text-mute/70">TO · {networkLabel(tx.chain_id).toUpperCase()}</div>
              <ExtLink href={addressUrl(tx.chain_id, tx.to)} className="block truncate text-ink">
                {tx.to.slice(0, 12)}…
              </ExtLink>
            </div>
            <div>
              <div className="text-mute/70">HIJACK</div>
              <div className={pct >= 35 ? "text-quarantine" : "text-ink"}>{pct}%</div>
            </div>
          </div>
          {failing.length > 0 && <div className="terminal-header !mb-1">why it was held</div>}
          {failing.length > 0 && (
            <ul className="space-y-1 text-xs">
              {failing.map((c) => (
                <li key={c.id} className="flex gap-2">
                  <span className={`w-16 shrink-0 font-mono uppercase ${c.severity === "medium" ? "text-quarantine" : "text-block"}`}>{c.severity}</span>
                  <span className="text-ink/90">{c.name}</span>
                  <span className="truncate text-mute">- {c.detail}</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => onOpen(v)} className="font-mono text-[11px] tracking-wider text-mute underline decoration-line-strong underline-offset-4 hover:text-ink">
            Full investigation · trace · chain evidence ▸
          </button>
        </div>
        <div className="border-t border-line pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div className="terminal-header mb-2 text-quarantine">operator decision</div>
          <ReviewControls verdict={v} onReviewed={onReviewed} compact />
        </div>
      </div>
    </article>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowSquareOut, Tray } from "@phosphor-icons/react";
import type { Verdict } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { addressUrl, formatEth, networkLabel, relTime, short } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { ExtLink, OfflineState } from "./Panel";
import { ReviewControls } from "./ReviewControls";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    setSelectedId(null);
    onReviewed(v);
  };

  const list = (pending ?? []).filter((p) => !resolved.some((r) => r.id === p.id));
  const selected = list.find((v) => v.id === selectedId) ?? list[0] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-medium text-ink">Review</h2>
          <p className="mt-0.5 max-w-2xl text-[13px] text-mute">
            Quarantined transactions found no proof of attack but need a person before an agent signs them. Your decision and note are
            written to the recorder.
          </p>
        </div>
        {pending !== null && (
          <span className="text-[13px] text-faint">
            <span className="font-mono tabular-nums text-ink">{list.length}</span> waiting
          </span>
        )}
      </div>

      {offline && <OfflineState error={offline} onRetry={load} />}

      {pending === null && !offline && (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
          <div className="space-y-2 rounded-[10px] border border-line bg-panel p-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <div className="space-y-3 rounded-[10px] border border-line bg-panel p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-16" />
            <Skeleton className="h-24" />
          </div>
        </div>
      )}

      {pending !== null && list.length === 0 && (
        <div className="rounded-[10px] border border-line bg-panel">
          <EmptyState
            icon={<Tray size={28} />}
            title="Nothing waiting for review"
            body="When AgentShield holds a transaction for a human, it shows up here. Run the first-seen vault scenario in the Attack Lab to create one."
          />
        </div>
      )}

      {list.length > 0 && selected && (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr] lg:items-start">
          <ul className="max-h-[70vh] overflow-y-auto rounded-[10px] border border-line bg-panel p-1.5" aria-label="Transactions waiting for review">
            {list.map((v) => {
              const tx = v.proposed_tx;
              const fails = v.gate1.checks.filter((c) => !c.passed).length;
              const on = v.id === selected.id;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    aria-current={on}
                    className={`w-full rounded-md px-3 py-2.5 text-left transition-colors ${on ? "bg-elevated" : "hover:bg-elevated/50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[12.5px] text-ink">{v.agent_id}</span>
                      <span className="shrink-0 text-xs text-faint">{relTime(v.ts)}</span>
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[12px] text-mute">
                      {tx.method ?? "call"}() to {short(tx.to)}
                    </div>
                    <div className="mt-1 flex gap-3 text-xs text-faint">
                      <span>
                        hijack <span className="font-mono tabular-nums text-mute">{Math.round(v.gate2.hijack_likelihood * 100)}%</span>
                      </span>
                      <span>
                        <span className="font-mono tabular-nums text-mute">{fails}</span> {fails === 1 ? "check" : "checks"} failed
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <ReviewDetail key={selected.id} verdict={selected} onOpen={onOpen} onReviewed={handle} />
        </div>
      )}

      {resolved.length > 0 && (
        <div className="rounded-[10px] border border-line bg-panel">
          <div className="border-b border-line px-4 py-2.5 text-[13px] font-medium text-ink">Decided this session</div>
          <ul className="divide-y divide-line">
            {resolved.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[13px]">
                <span className={v.status === "approved" ? "text-allow" : "text-block"}>{v.status === "approved" ? "Approved" : "Denied"}</span>
                <span className="font-mono text-xs text-mute">{v.scenario_id ?? short(v.id, 8)}</span>
                <span className="text-xs text-faint">
                  {v.review?.operator}
                  {v.review?.ts ? `, ${relTime(v.review.ts)}` : ""}
                </span>
                {v.review?.note && <span className="min-w-0 truncate text-xs text-faint">&ldquo;{v.review.note}&rdquo;</span>}
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onOpen(v)}>
                  Open
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReviewDetail({ verdict: v, onOpen, onReviewed }: { verdict: Verdict; onOpen: (v: Verdict) => void; onReviewed: (v: Verdict) => void }) {
  const tx = v.proposed_tx;
  const failing = v.gate1.checks.filter((c) => !c.passed);
  const pct = Math.round(v.gate2.hijack_likelihood * 100);
  return (
    <article className="min-w-0 rounded-[10px] border border-line bg-panel">
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-faint">
              <span className="font-mono">{v.agent_id}</span>, held {relTime(v.ts)}
            </div>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{v.operator_summary}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onOpen(v)}>
            <ArrowSquareOut size={14} aria-hidden />
            Open full verdict
          </Button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-line py-3 sm:grid-cols-4">
          <Fact k="Amount">{tx.amount_human ?? formatEth(tx.value_wei)}</Fact>
          <Fact k="Method">{tx.method ? `${tx.method}()` : "-"}</Fact>
          <Fact k={`To, ${networkLabel(tx.chain_id)}`}>
            <ExtLink href={addressUrl(tx.chain_id, tx.to)} className="text-ink">
              {short(tx.to)}
            </ExtLink>
          </Fact>
          <Fact k="Hijack likelihood">
            <span className={pct >= 70 ? "text-block" : pct >= 35 ? "text-quarantine" : "text-ink"}>{pct}%</span>
          </Fact>
          <Fact k="Target">{v.chain.to_is_contract === null ? "Unknown" : v.chain.to_is_contract ? "Contract" : "Wallet"}</Fact>
          <Fact k="Simulation">{v.chain.simulation ? (v.chain.simulation.ok ? "No revert" : "Reverts") : "Not run"}</Fact>
          <Fact k="Registry">{v.chain.onchain_ioc ? `IOC #${v.chain.onchain_ioc.ioc_id}` : "No match"}</Fact>
          <Fact k="Mode">{v.mode === "agent" ? "Agent" : "Fast"}</Fact>
        </dl>

        {failing.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs text-faint">Why it was held</div>
            <ul className="space-y-1.5">
              {failing.map((c, i) => (
                <li key={`${c.id}-${i}`} className="text-[13px]">
                  <span className="text-ink">{c.name}</span> <span className="font-mono text-[11px] text-faint">{c.id}</span>
                  <div className="text-mute">{c.detail}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="border-t border-line px-5 py-4">
        <ReviewControls verdict={v} onReviewed={onReviewed} compact />
      </div>
    </article>
  );
}

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-faint">{k}</dt>
      <dd className="mt-0.5 truncate font-mono text-[12.5px] text-mute">{children}</dd>
    </div>
  );
}

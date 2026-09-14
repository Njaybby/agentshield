"use client";

import { useCallback, useEffect, useState } from "react";
import { Play } from "@phosphor-icons/react";
import type { Health, Overview as OverviewData, Verdict } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { Button } from "@/components/ui/Button";
import { VerdictDrawer } from "./VerdictDetail";
import { AttackLab } from "./AttackLab";
import { Inspect } from "./Inspect";
import { ReviewQueue } from "./ReviewQueue";
import { Analytics } from "./Analytics";
import { CTIPanel } from "./CTIPanel";
import { Integrate } from "./Integrate";
import { Overview } from "./Overview";
import { HealthPill } from "./HealthPill";

const TABS = [
  ["overview", "Overview"],
  ["lab", "Attack Lab"],
  ["review", "Review"],
  ["inspect", "Inspect"],
  ["analytics", "Analytics"],
  ["cti", "Threat intel"],
  ["integrate", "Integrate"],
] as const;
export type TabId = (typeof TABS)[number][0];

const ALIASES: Record<string, TabId> = { recorder: "overview" };

function readTab(): TabId | null {
  const raw = new URLSearchParams(window.location.search).get("tab") || window.location.hash.slice(1);
  const want = ALIASES[raw] ?? raw;
  return TABS.some(([id]) => id === want) ? (want as TabId) : null;
}

export function FlightRecorder() {
  const [tab, setTab] = useState<TabId>("overview");
  const [health, setHealth] = useState<Health | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [selected, setSelected] = useState<Verdict | null>(null);
  const [rev, setRev] = useState(0); // bumps when a verdict is created or updated so lists refetch

  const refresh = useCallback(async () => {
    const [h, o] = await Promise.all([rpc<Health>("health"), rpc<OverviewData>("telemetry", { view: "overview" })]);
    if (hasError(h) && h.offline) {
      setOffline(h.error);
      setHealth(null);
    } else if (!hasError(h)) {
      setOffline(null);
      setHealth(h);
    }
    if (!hasError(o)) setOverview(o);
  }, []);

  useEffect(() => {
    const sync = () => {
      const t = readTab();
      if (t) setTab(t);
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    refresh();
    const poll = window.setInterval(() => document.visibilityState === "visible" && refresh(), 5000);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
      window.clearInterval(poll);
    };
  }, [refresh]);

  const go = useCallback((id: TabId) => {
    setTab(id);
    window.history.replaceState(null, "", `${window.location.pathname}?tab=${id}`);
  }, []);

  const changed = useCallback(() => {
    setRev((r) => r + 1);
    refresh();
  }, [refresh]);

  const upsert = useCallback(
    (v: Verdict) => {
      setSelected((cur) => (cur && cur.id === v.id ? v : cur));
      changed();
    },
    [changed],
  );

  const pending = overview?.stats.pending_review ?? 0;

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-20 pt-6 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Console</h1>
          <p className="mt-0.5 text-[13px] text-faint">Every transaction your agents propose, checked before it is signed.</p>
        </div>
        <div className="flex items-center gap-2">
          <HealthPill health={health} offline={offline} />
          <Button variant="primary" size="sm" onClick={() => go("lab")}>
            <Play size={14} weight="fill" aria-hidden />
            Run attack
          </Button>
        </div>
      </div>

      <nav className="-mx-4 mt-5 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0" aria-label="Console sections">
        <div role="tablist" className="flex min-w-max gap-1">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => go(id)}
              className={`relative flex h-10 items-center gap-2 px-2.5 text-[13px] transition-colors duration-[120ms] ${
                tab === id ? "text-ink" : "text-faint hover:text-ink"
              }`}
            >
              {label}
              {id === "review" && pending > 0 && (
                <span className="rounded bg-quarantine/15 px-1.5 font-mono text-[11px] leading-[18px] tabular-nums text-quarantine">{pending}</span>
              )}
              {tab === id && <span className="absolute inset-x-2.5 -bottom-px h-px bg-ink" aria-hidden />}
            </button>
          ))}
        </div>
      </nav>

      <div className="mt-6">
        {tab === "overview" && (
          <Overview overview={overview} offline={offline} rev={rev} onOpen={setSelected} onReview={() => go("review")} onRunAttack={() => go("lab")} />
        )}
        <div hidden={tab !== "lab"}>
          <AttackLab onOpen={setSelected} onChange={changed} />
        </div>
        <div hidden={tab !== "inspect"}>
          <Inspect onOpen={setSelected} onChange={changed} />
        </div>
        {tab === "review" && <ReviewQueue rev={rev} onOpen={setSelected} onReviewed={upsert} />}
        {tab === "analytics" && <Analytics />}
        {tab === "cti" && <CTIPanel />}
        {tab === "integrate" && <Integrate />}
      </div>

      <VerdictDrawer verdict={selected} onClose={() => setSelected(null)} onUpdate={upsert} />
    </div>
  );
}

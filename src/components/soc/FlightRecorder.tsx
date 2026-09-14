"use client";

import { useCallback, useEffect, useState } from "react";
import type { Health, Overview, Verdict } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { addressUrl, clock, ms, short } from "@/lib/format";
import { ExtLink, OfflineState } from "./Panel";
import { VerdictDrawer } from "./VerdictDetail";
import { AttackLab } from "./AttackLab";
import { Inspect } from "./Inspect";
import { ReviewQueue } from "./ReviewQueue";
import { Analytics } from "./Analytics";
import { RecorderLog } from "./RecorderLog";
import { CTIPanel } from "./CTIPanel";
import { Integrate } from "./Integrate";

const TABS = [
  ["lab", "Attack Lab"],
  ["inspect", "Inspect"],
  ["review", "Review Queue"],
  ["analytics", "Analytics"],
  ["recorder", "Recorder"],
  ["cti", "CTI"],
  ["integrate", "Integrate"],
] as const;
export type TabId = (typeof TABS)[number][0];

export function FlightRecorder() {
  const [tab, setTab] = useState<TabId>("lab");
  const [health, setHealth] = useState<Health | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [offline, setOffline] = useState<string | null>(null);
  const [selected, setSelected] = useState<Verdict | null>(null);
  const [rev, setRev] = useState(0); // bumps when a verdict is created/updated so lists refetch
  const [now, setNow] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const [h, o] = await Promise.all([rpc<Health>("health"), rpc<Overview>("telemetry", { view: "overview" })]);
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
    const syncHash = () => {
      const want = (new URLSearchParams(window.location.search).get("tab") || window.location.hash.slice(1)) as TabId;
      if (TABS.some(([id]) => id === want)) setTab(want);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    refresh();
    const poll = window.setInterval(() => document.visibilityState === "visible" && refresh(), 5000);
    const tick = window.setInterval(() => setNow(new Date()), 250);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [refresh]);

  const go = (id: TabId) => {
    setTab(id);
    window.history.replaceState(null, "", `${window.location.pathname}?tab=${id}`);
  };

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

  const s = overview?.stats;
  const pending = s?.pending_review ?? 0;

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-16 pt-5 md:px-6">
      {/* Title row */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="terminal-header">nokara labs // agentshield // pre-trade firewall</div>
          <h1 className="display-serif mt-1 text-4xl leading-none md:text-5xl">Flight Recorder</h1>
        </div>
        <div className="text-right font-mono">
          <div className="text-xl tabular-nums tracking-tight text-ink md:text-2xl">{clock(now)}</div>
          <div className="terminal-header">UTC · {offline ? <span className="text-block">LINK DOWN</span> : health ? <span className="text-allow">LINK UP</span> : "LINKING…"}</div>
        </div>
      </div>

      {/* Status strip */}
      <div className="mb-3 overflow-x-auto border border-line bg-panel">
        <div className="flex min-w-max items-stretch divide-x divide-line font-mono text-[11px]">
          <span className="terminal-header flex items-center px-3 !text-ink">FDR-00 · SYS</span>
          <StatusCell k="runtime" v={health ? (health.runtime === "agentcore" ? "Bedrock AgentCore" : health.runtime === "vercel" ? "Vercel" : "Local") : "-"} state={health ? "ok" : offline ? "bad" : "idle"} />
          <StatusCell k="model" v={health?.model_provider ?? "-"} state={health ? "ok" : "idle"} />
          <StatusCell k="strands" v={health ? (health.strands_ready ? "ready" : "not ready") : "-"} state={health ? (health.strands_ready ? "ok" : "warn") : "idle"} />
          <StatusCell k="store" v={health ? (health.store === "clickhouse" ? "ClickHouse" : "memory") : "-"} state={health ? (health.store === "clickhouse" ? "ok" : "warn") : "idle"} />
          <StatusCell k="base rpc" v={health ? (health.chain_rpc ? "connected" : "down") : "-"} state={health ? (health.chain_rpc ? "ok" : "bad") : "idle"} />
          <StatusCell
            k="registry · 84532"
            v={
              health?.registry_address ? (
                <ExtLink href={addressUrl(84532, health.registry_address)} className="text-ink">
                  {short(health.registry_address, 4)}
                </ExtLink>
              ) : health ? (
                "not configured"
              ) : (
                "-"
              )
            }
            state={health ? (health.registry_address ? "ok" : "warn") : "idle"}
          />
        </div>
      </div>

      {offline && (
        <div className="mb-3">
          <OfflineState error={offline} onRetry={refresh} />
        </div>
      )}

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 lg:grid-cols-8">
        <AutoResolvedTile pct={s && s.total > 0 ? s.auto_resolved_pct : null} />
        <Tile label="verdicts" value={s?.total} />
        <Tile label="blocked" value={s?.blocked} tone="text-block" />
        <Tile label="quarantined" value={s?.quarantined} tone="text-quarantine" />
        <Tile label="allowed" value={s?.allowed} tone="text-allow" />
        <button type="button" onClick={() => go("review")} className="bg-panel text-left hover:bg-elevated">
          <Tile label="awaiting operator" value={s?.pending_review} tone={pending ? "text-quarantine" : "text-ink"} flag={pending > 0} bare />
        </button>
        <Tile label="avg latency" value={s ? ms(s.avg_latency_ms) : undefined} />
      </div>

      {/* Tabs */}
      <nav className="mb-3 flex overflow-x-auto border-b border-line" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => go(id)}
            className={`relative flex shrink-0 items-center gap-2 px-3.5 py-2.5 text-sm transition-colors ${
              tab === id ? "text-ink" : "text-mute hover:text-ink"
            }`}
          >
            {label}
            {id === "review" && pending > 0 && (
              <span className="bg-quarantine px-1.5 font-mono text-[10px] font-semibold text-black">{pending}</span>
            )}
            {id === "analytics" && <span className="font-mono text-[9px] tracking-wider text-mute">CLICKHOUSE</span>}
            {tab === id && <span className="absolute inset-x-2 -bottom-px h-px bg-block" />}
          </button>
        ))}
      </nav>

      <div hidden={tab !== "lab"}>
        <AttackLab onOpen={setSelected} onChange={changed} />
      </div>
      <div hidden={tab !== "inspect"}>
        <Inspect onOpen={setSelected} onChange={changed} />
      </div>
      {tab === "review" && <ReviewQueue rev={rev} onOpen={setSelected} onReviewed={upsert} />}
      {tab === "analytics" && <Analytics />}
      {tab === "recorder" && <RecorderLog rev={rev} onOpen={setSelected} />}
      {tab === "cti" && <CTIPanel />}
      {tab === "integrate" && <Integrate />}

      <VerdictDrawer verdict={selected} onClose={() => setSelected(null)} onUpdate={upsert} />
    </div>
  );
}

function AutoResolvedTile({ pct }: { pct: number | null }) {
  const clamped = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className="col-span-2 flex flex-col justify-between bg-panel px-4 py-3 sm:col-span-3 lg:col-span-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="terminal-header !text-ink">AUTO-RESOLVED</span>
        <span className="font-mono text-[10px] text-mute">ALLOW + BLOCK / ALL</span>
      </div>
      <div className="mt-1 flex items-end gap-3">
        <span className="font-mono text-4xl leading-none tabular-nums tracking-tight text-ink">
          {pct === null ? "-" : `${Number.isInteger(clamped) ? clamped : clamped.toFixed(1)}%`}
        </span>
        <span className="pb-0.5 text-xs text-mute">settled without paging you</span>
      </div>
      <div className="mt-2 h-1 bg-line" aria-hidden>
        <div className="h-full bg-ink" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function StatusCell({ k, v, state }: { k: string; v: React.ReactNode; state: "ok" | "warn" | "bad" | "idle" }) {
  const dot = { ok: "bg-allow", warn: "bg-quarantine", bad: "bg-block pulse-block", idle: "bg-line-strong" }[state];
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className={`h-1.5 w-1.5 ${dot}`} aria-hidden />
      <span className="uppercase tracking-[0.1em] text-mute">{k}</span>
      <span className="text-ink">{v}</span>
    </div>
  );
}

function Tile({
  label,
  value,
  tone = "text-ink",
  flag,
  bare,
}: {
  label: string;
  value: number | string | undefined;
  tone?: string;
  flag?: boolean;
  bare?: boolean;
}) {
  return (
    <div className={`px-4 py-3 ${bare ? "" : "bg-panel"}`}>
      <div className="terminal-header flex items-center gap-1.5">
        {flag && <span className="h-1.5 w-1.5 bg-quarantine pulse-block" aria-hidden />}
        {label}
      </div>
      <div className={`mt-1 font-mono text-2xl tabular-nums tracking-tight ${tone}`}>{value ?? "-"}</div>
    </div>
  );
}

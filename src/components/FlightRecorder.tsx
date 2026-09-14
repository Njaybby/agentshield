"use client";

import { useCallback, useEffect, useState } from "react";
import { AttackLab } from "./AttackLab";
import { DecisionBadge } from "./DecisionBadge";
import type { ShieldVerdict } from "@/lib/shield/types";

interface Overview {
  stats: {
    total: number;
    blocked: number;
    quarantined: number;
    allowed: number;
    avgLatency: number;
  };
  latest: ShieldVerdict[];
  cti_count: number;
  telemetry: { id: string; ts: string; kind: string; payload: Record<string, unknown> }[];
}

export function FlightRecorder() {
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<"live" | "attacks" | "elastic" | "cti">("attacks");
  const [elastic, setElastic] = useState<Record<string, unknown>[]>([]);
  const [cti, setCti] = useState<Record<string, unknown>[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/telemetry");
    const json = await res.json();
    setData(json);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (tab === "elastic") {
      fetch("/api/telemetry?view=elastic")
        .then((r) => r.json())
        .then((d) => setElastic(d.documents ?? []));
    }
    if (tab === "cti") {
      fetch("/api/telemetry?view=cti")
        .then((r) => r.json())
        .then((d) => setCti(d.feed ?? []));
    }
  }, [tab, data?.stats.total]);

  const s = data?.stats;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="terminal-header">nokara labs // agentshield // flight recorder</div>
          <h1 className="display-serif text-3xl tracking-tight md:text-4xl">
            SOC Console
          </h1>
        </div>
        <div className="flex gap-1">
          {(
            [
              ["attacks", "Attack Lab"],
              ["live", "Live"],
              ["elastic", "Elastic Docs"],
              ["cti", "CTI Feed"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded px-3 py-1.5 text-sm ${
                tab === id
                  ? "border border-line-strong bg-elevated text-ink"
                  : "text-mute hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5 md:gap-3">
        <Metric label="Checks" value={String(s?.total ?? 0)} />
        <Metric label="Blocked" value={String(s?.blocked ?? 0)} accent="block" />
        <Metric
          label="Quarantine"
          value={String(s?.quarantined ?? 0)}
          accent="quarantine"
        />
        <Metric label="Allowed" value={String(s?.allowed ?? 0)} accent="allow" />
        <Metric
          label="Avg latency"
          value={`${s?.avgLatency ?? 0} ms`}
          mono
        />
      </div>

      {tab === "attacks" && <AttackLab onComplete={refresh} />}

      {tab === "live" && (
        <div className="border border-line bg-panel">
          <div className="border-b border-line px-4 py-3">
            <div className="terminal-header">latest verdicts</div>
          </div>
          <div className="divide-y divide-line">
            {(data?.latest ?? []).length === 0 && (
              <p className="p-4 text-sm text-mute">
                No verdicts yet. Run the Attack Lab to populate the recorder.
              </p>
            )}
            {(data?.latest ?? []).map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <DecisionBadge decision={v.decision} />
                    <span className="text-sm">{v.scenario_id ?? v.agent_id}</span>
                  </div>
                  <p className="mt-1 max-w-2xl text-xs text-mute">
                    {v.explanations[1] ?? v.explanations[0]}
                  </p>
                </div>
                <div className="text-right text-xs text-mute">
                  <div className="tabular">{v.latency_ms} ms</div>
                  <div>{new Date(v.ts).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "elastic" && (
        <div className="border border-line bg-panel p-4">
          <div className="terminal-header mb-3">
            elasticsearch-ready security events · {elastic.length} docs
          </div>
          <pre className="max-h-[480px] overflow-auto text-xs leading-5 text-mute">
            {JSON.stringify(elastic.slice(0, 5), null, 2)}
          </pre>
        </div>
      )}

      {tab === "cti" && (
        <div className="border border-line bg-panel">
          <div className="border-b border-line px-4 py-3 terminal-header">
            decentralized threat intel · {cti.length} IOCs
          </div>
          <div className="divide-y divide-line">
            {cti.map((row) => (
              <div key={String(row.ioc_id)} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular text-ink">{String(row.ioc_id)}</span>
                  <span className="text-mute">{String(row.category)}</span>
                  <span className="uppercase tracking-wide text-xs text-quarantine">
                    {String(row.severity)}
                  </span>
                </div>
                <div className="mt-1 font-medium">{String(row.title)}</div>
                <p className="mt-1 text-xs text-mute">{String(row.reason)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: "allow" | "block" | "quarantine";
  mono?: boolean;
}) {
  const color =
    accent === "allow"
      ? "text-allow"
      : accent === "block"
        ? "text-block"
        : accent === "quarantine"
          ? "text-quarantine"
          : "text-ink";
  return (
    <div className="border border-line bg-panel px-3 py-3">
      <div className="terminal-header">{label}</div>
      <div className={`mt-1 text-xl ${color} ${mono ? "tabular" : ""}`}>
        {value}
      </div>
    </div>
  );
}

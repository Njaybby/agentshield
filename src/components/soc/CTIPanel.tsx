"use client";

import { useCallback, useEffect, useState } from "react";
import type { CTIView } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { ExtLink, OfflineState, Panel } from "./Panel";
import { addressUrl, short } from "@/lib/format";

const sevTone = (s: string) =>
  s === "critical" ? "text-block" : s === "high" ? "text-[#f87171]" : s === "medium" ? "text-quarantine" : "text-mute";

export function CTIPanel() {
  const [data, setData] = useState<CTIView | null>(null);
  const [offline, setOffline] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await rpc<CTIView>("telemetry", { view: "cti" });
    if (hasError(res)) return setOffline(res.error);
    setOffline(null);
    setData(res);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (offline && !data) return <OfflineState error={offline} onRetry={load} />;
  if (!data) return <div className="h-72 animate-pulse border border-line bg-panel" />;

  const reg = data.onchain.registry_address;

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
      <Panel code="FDR-60" label="CTI FEED" meta={[`${data.feed.length} IOCS`, "LOCAL + GOPLUS"]}>
        <ul>
          {data.feed.length === 0 && <li className="px-4 py-6 text-sm text-mute">No indicators loaded.</li>}
          {data.feed.map((r) => (
            <li key={r.ioc_id} className="border-b border-line px-4 py-3 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="text-ink">{r.ioc_id}</span>
                <span className={`uppercase ${sevTone(r.severity)}`}>{r.severity}</span>
                <span className="border border-line-strong px-1 text-[10px] uppercase text-mute">{r.category}</span>
                <span className="text-[10px] uppercase text-mute/70">{r.source}</span>
              </div>
              <div className="mt-1 text-sm text-ink/90">{r.title}</div>
              {(r.address || r.pattern) && (
                <div className="mt-1 break-all font-mono text-[11px] text-mute">
                  {r.address && (
                    <ExtLink href={addressUrl(8453, r.address)} className="text-ink/80">
                      {r.address}
                    </ExtLink>
                  )}
                  {r.pattern && <span>/{r.pattern}/</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        code="FDR-61"
        label="REPUTATION REGISTRY"
        meta={[`CH ${data.onchain.chain_id}`, "ERC-8004-STYLE", "X402 PAY-PER-QUERY"]}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 font-mono text-[11px]">
          <span className="terminal-header">contract</span>
          {reg ? (
            <ExtLink href={addressUrl(84532, reg)} className="break-all text-ink">
              {reg}
            </ExtLink>
          ) : (
            <span className="text-quarantine">not deployed / not configured</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left font-mono text-[11px]">
            <thead className="terminal-header">
              <tr className="border-b border-line">
                <th className="px-4 py-2 font-normal">#</th>
                <th className="px-4 py-2 font-normal">target</th>
                <th className="px-4 py-2 font-normal">category</th>
                <th className="px-4 py-2 font-normal">sev</th>
                <th className="px-4 py-2 text-right font-normal">conf</th>
                <th className="px-4 py-2 font-normal">publisher</th>
              </tr>
            </thead>
            <tbody>
              {data.onchain.iocs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 font-sans text-sm text-mute">
                    No on-chain IOCs published yet.
                  </td>
                </tr>
              )}
              {data.onchain.iocs.map((i) => (
                <tr key={i.ioc_id} className="border-b border-line last:border-b-0" title={i.uri}>
                  <td className="px-4 py-2.5 text-mute">{i.ioc_id}</td>
                  <td className="px-4 py-2.5">
                    <ExtLink href={addressUrl(8453, i.target)} className="text-ink">
                      {short(i.target, 5)}
                    </ExtLink>
                  </td>
                  <td className="px-4 py-2.5 uppercase text-ink/80">{i.category}</td>
                  <td className={`px-4 py-2.5 uppercase ${sevTone(i.severity)}`}>{i.severity}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink">{i.confidence}%</td>
                  <td className="px-4 py-2.5">
                    <ExtLink href={addressUrl(84532, i.publisher)} className="text-mute">
                      {short(i.publisher, 4)}
                    </ExtLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

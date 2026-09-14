"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldWarning } from "@phosphor-icons/react";
import type { CTIView } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { addressUrl, short } from "@/lib/format";
import { EmptyState, Skeleton, Tag } from "@/components/ui/States";
import { ExtLink, OfflineState, Panel } from "./Panel";

function sentence(s: string) {
  const t = s.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function Severity({ level }: { level: string }) {
  const l = level.toLowerCase();
  const tone =
    l === "critical"
      ? "border-block/35 bg-block/10 !text-block"
      : l === "high"
        ? "border-quarantine/35 bg-quarantine/10 !text-quarantine"
        : "";
  return <Tag className={tone}>{sentence(l)}</Tag>;
}

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
  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-[10px]" />
        <Skeleton className="h-80 w-full rounded-[10px]" />
      </div>
    );

  const reg = data.onchain.registry_address;
  const th = "h-9 px-4 font-normal";

  return (
    <div className="space-y-4">
      <Panel
        label="On-chain registry"
        meta={["ReputationRegistry on Base Sepolia", `${data.onchain.iocs.length} indicators`]}
        className="min-w-0"
        right={
          reg ? (
            <ExtLink href={addressUrl(84532, reg)} className="text-xs text-mute">
              {short(reg, 5)}
            </ExtLink>
          ) : (
            <span className="text-xs text-quarantine">Not configured</span>
          )
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-xs text-faint">
                <th className={th}>ID</th>
                <th className={th}>Target</th>
                <th className={th}>Category</th>
                <th className={th}>Severity</th>
                <th className={`${th} text-right`}>Confidence</th>
                <th className={th}>Publisher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.onchain.iocs.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon={<ShieldWarning size={22} />} title="No indicators published yet" body="Staked contributors publish IOCs to the registry. The agent reads them on every check." />
                  </td>
                </tr>
              )}
              {data.onchain.iocs.map((i) => (
                <tr key={i.ioc_id} className="h-11" title={i.uri}>
                  <td className="px-4 font-mono text-xs tabular-nums text-faint">{i.ioc_id}</td>
                  <td className="px-4">
                    <ExtLink href={addressUrl(8453, i.target)} className="text-xs text-ink">
                      {short(i.target, 5)}
                    </ExtLink>
                    {i.uri && <div className="max-w-[260px] truncate text-xs text-faint">{i.uri}</div>}
                  </td>
                  <td className="px-4 text-mute">{sentence(i.category)}</td>
                  <td className="px-4">
                    <Severity level={i.severity} />
                  </td>
                  <td className="px-4 text-right font-mono text-xs tabular-nums text-ink">{i.confidence}%</td>
                  <td className="px-4">
                    <ExtLink href={addressUrl(84532, i.publisher)} className="text-xs text-mute">
                      {short(i.publisher, 4)}
                    </ExtLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel label="Local feed" meta={[`${data.feed.length} indicators`, "Curated list and GoPlus"]} className="min-w-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-xs text-faint">
                <th className={th}>ID</th>
                <th className={th}>Indicator</th>
                <th className={th}>Category</th>
                <th className={th}>Severity</th>
                <th className={th}>Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.feed.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState title="No indicators loaded" />
                  </td>
                </tr>
              )}
              {data.feed.map((r) => (
                <tr key={r.ioc_id} className="min-h-11">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-faint">{r.ioc_id}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-ink">{r.title}</div>
                    {r.address && (
                      <ExtLink href={addressUrl(8453, r.address)} className="text-xs text-faint">
                        {short(r.address, 5)}
                      </ExtLink>
                    )}
                    {r.pattern && <div className="max-w-[360px] truncate font-mono text-xs text-faint">/{r.pattern}/</div>}
                  </td>
                  <td className="px-4 py-2.5 text-mute">{sentence(r.category)}</td>
                  <td className="px-4 py-2.5">
                    <Severity level={r.severity} />
                  </td>
                  <td className="px-4 py-2.5 text-mute">{r.source === "onchain" ? "On-chain" : r.source === "goplus" ? "GoPlus" : "Local"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

"use client";

import { ms } from "@/lib/format";
import { useCti, useOverview } from "./useLive";

export function LiveNumbers() {
  const { data, failed } = useOverview();
  const { data: cti } = useCti();
  const s = data?.stats;

  const items: { label: string; value: string | null }[] = [
    { label: "Transactions checked", value: s ? s.total.toLocaleString() : null },
    { label: "Blocked before signing", value: s ? s.blocked.toLocaleString() : null },
    { label: "Settled without a human", value: s ? `${s.auto_resolved_pct}%` : null },
    { label: "Average decision time", value: s ? ms(s.avg_latency_ms) : null },
    { label: "Indicators on-chain", value: cti ? String(cti.onchain.iocs.length) : null },
  ];

  return (
    <section aria-label="Live numbers from the recorder" className="border-y border-line">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-x-6 gap-y-6 px-4 py-8 md:grid-cols-5 md:px-6">
        {items.map((it) => (
          <div key={it.label} className="min-w-0">
            <div className="font-mono text-2xl tabular-nums tracking-tight text-ink md:text-[28px]">
              {it.value ?? (failed ? "-" : <span className="skeleton inline-block h-7 w-16 align-middle" />)}
            </div>
            <div className="mt-1 text-[13px] text-faint">{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

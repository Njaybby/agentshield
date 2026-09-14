import type { ShieldVerdict, TelemetryEvent } from "./types";

const MAX = 200;

const verdicts: ShieldVerdict[] = [];
const telemetry: TelemetryEvent[] = [];

export function pushVerdict(v: ShieldVerdict) {
  verdicts.unshift(v);
  if (verdicts.length > MAX) verdicts.pop();
  telemetry.unshift({
    id: `tel-${v.id}`,
    ts: v.ts,
    kind: "verdict",
    payload: {
      decision: v.decision,
      agent_id: v.agent_id,
      scenario_id: v.scenario_id,
      latency_ms: v.latency_ms,
      cti_hits: v.cti_hits.map((h) => h.ioc_id),
    },
  });
  if (telemetry.length > MAX) telemetry.pop();
}

export function listVerdicts(limit = 50): ShieldVerdict[] {
  return verdicts.slice(0, limit);
}

export function listTelemetry(limit = 80): TelemetryEvent[] {
  return telemetry.slice(0, limit);
}

export function clearStore() {
  verdicts.length = 0;
  telemetry.length = 0;
}

export function stats() {
  const total = verdicts.length;
  const blocked = verdicts.filter((v) => v.decision === "BLOCK").length;
  const quarantined = verdicts.filter((v) => v.decision === "QUARANTINE").length;
  const allowed = verdicts.filter((v) => v.decision === "ALLOW").length;
  const avgLatency =
    total === 0
      ? 0
      : Math.round(verdicts.reduce((a, v) => a + v.latency_ms, 0) / total);
  return { total, blocked, quarantined, allowed, avgLatency };
}

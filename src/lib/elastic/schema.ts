import type { ShieldVerdict } from "../shield/types";

/**
 * Elastic-ready security event document.
 * Maps cleanly into Elasticsearch / Elastic Security for SOC workflows
 * (Forge the Future: Search, Observability, Security).
 */
export function toElasticDoc(v: ShieldVerdict): Record<string, unknown> {
  return {
    "@timestamp": v.ts,
    event: {
      kind: "alert",
      category: ["intrusion_detection", "malware"],
      type: [v.decision === "ALLOW" ? "allowed" : "denied"],
      action: "agentshield.pre_trade_check",
      outcome: v.decision === "ALLOW" ? "success" : "failure",
      severity:
        v.decision === "BLOCK" ? 80 : v.decision === "QUARANTINE" ? 50 : 10,
      id: v.id,
      duration: v.latency_ms * 1_000_000,
    },
    agent: {
      id: v.agent_id,
      type: "crypto-trading-agent",
      name: "AgentShield",
    },
    threat: {
      framework: "MITRE ATT&CK",
      indicator: v.cti_hits.map((h) => ({
        name: h.title,
        type: h.category,
        description: h.match,
        reference: h.ioc_id,
      })),
      technique: v.cti_hits
        .filter((h) => h.mitre)
        .map((h) => ({ id: h.mitre, name: h.title })),
    },
    destination: {
      address: v.proposed_tx.to,
      domain: v.proposed_tx.token_symbol,
    },
    network: {
      chain_id: v.proposed_tx.chain_id,
    },
    agentshield: {
      decision: v.decision,
      scenario_id: v.scenario_id,
      gate1_passed: v.gate1.passed,
      gate2_passed: v.gate2.passed,
      gate2_mode: v.gate2.mode,
      hijack_likelihood: v.gate2.hijack_likelihood,
      failing_checks: v.gate1.checks
        .filter((c) => !c.passed)
        .map((c) => c.id),
      explanations: v.explanations,
    },
    message: `AgentShield ${v.decision} for agent ${v.agent_id}`,
    tags: ["agentshield", "pre-trade", "soc", "x402-ready"],
  };
}

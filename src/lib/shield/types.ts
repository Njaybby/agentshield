export type Decision = "ALLOW" | "BLOCK" | "QUARANTINE";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface ProvenanceSource {
  type: "user" | "web" | "token_metadata" | "social" | "tool" | "mempool";
  content: string;
  url?: string;
  fetched_at?: string;
}

export interface ProposedTx {
  to: string;
  value_wei: string;
  data?: string;
  chain_id: number;
  method?: string;
  token_symbol?: string;
  spender?: string;
  amount_human?: string;
}

export interface ShieldPolicy {
  max_value_wei: string;
  per_counterparty_max_wei: string;
  allowlist: string[];
  denylist: string[];
  novel_contract_quarantine: boolean;
  rate_limit_per_minute: number;
  require_gate2: boolean;
}

export interface ShieldRequest {
  agent_id: string;
  proposed_tx: ProposedTx;
  provenance: {
    user_intent: string;
    sources: ProvenanceSource[];
  };
  policy?: Partial<ShieldPolicy>;
  scenario_id?: string;
}

export interface GateCheck {
  id: string;
  name: string;
  passed: boolean;
  severity: Severity;
  detail: string;
}

export interface Gate1Result {
  passed: boolean;
  checks: GateCheck[];
}

export interface Gate2Result {
  passed: boolean;
  score: number;
  hijack_likelihood: number;
  reasons: string[];
  model: string;
  mode: "llm" | "heuristic";
}

export interface CTIHit {
  ioc_id: string;
  title: string;
  severity: Severity;
  category: string;
  match: string;
  mitre?: string;
}

export interface ShieldVerdict {
  id: string;
  ts: string;
  agent_id: string;
  decision: Decision;
  gate1: Gate1Result;
  gate2: Gate2Result;
  cti_hits: CTIHit[];
  explanations: string[];
  proposed_tx: ProposedTx;
  scenario_id?: string;
  latency_ms: number;
  elastic_doc: Record<string, unknown>;
}

export interface TelemetryEvent {
  id: string;
  ts: string;
  kind: "verdict" | "attack_demo" | "cti_ingest" | "policy";
  payload: Record<string, unknown>;
}

export const DEFAULT_POLICY: ShieldPolicy = {
  max_value_wei: "5000000000000000000", // 5 ETH
  per_counterparty_max_wei: "2000000000000000000", // 2 ETH
  allowlist: [],
  denylist: [],
  novel_contract_quarantine: true,
  rate_limit_per_minute: 30,
  require_gate2: true,
};

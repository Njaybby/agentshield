export type Decision = "ALLOW" | "BLOCK" | "QUARANTINE";
export type Mode = "fast" | "agent";
export type VerdictStatus = "final" | "pending_review" | "approved" | "denied";

export interface ProvenanceSource {
  type: string;
  content: string;
  url?: string;
}

export interface ProposedTx {
  to: string;
  value_wei: string;
  chain_id: number;
  data?: string;
  method?: string;
  token_symbol?: string;
  token_address?: string;
  spender?: string;
  amount_human?: string;
}

export interface ShieldRequest {
  agent_id: string;
  scenario_id?: string | null;
  policy?: Record<string, unknown> | null;
  provenance: { user_intent: string; sources: ProvenanceSource[] };
  proposed_tx: ProposedTx;
}

export interface Check {
  id: string;
  name: string;
  passed: boolean;
  severity: "info" | "medium" | "high" | "critical";
  detail: string;
  source: string;
}

export interface Verdict {
  id: string;
  ts: string;
  agent_id: string;
  decision: Decision;
  status: VerdictStatus;
  mode: Mode;
  operator_summary: string;
  explanations: string[];
  latency_ms: number;
  gate1: { forced_block: boolean; novel_quarantine: boolean; checks: Check[] };
  gate2: {
    passed: boolean;
    hijack_likelihood: number;
    attack_class: string;
    reasons: string[];
    evidence: string[];
    model: string;
    mode: "llm" | "heuristic" | "skipped";
  };
  review: { action: "APPROVE" | "DENY"; note: string; operator: string; ts: string } | null;
  proposed_tx: ProposedTx;
  // chain evidence, CTI hits, trace and the event doc are passed through untyped
  [key: string]: unknown;
}

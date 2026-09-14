// Backend contract. Mirrors the Python agent's /rpc (and AgentCore) payloads exactly.

export type Decision = "ALLOW" | "BLOCK" | "QUARANTINE";
export type Mode = "fast" | "agent";
export type Severity = "info" | "medium" | "high" | "critical";

export type ProvenanceSource = { type: string; content: string; url?: string };

export type ProposedTx = {
  /** The trading agent's own wallet (signer). */
  from?: string;
  to: string;
  value_wei: string;
  data?: string;
  chain_id: number;
  method?: string;
  token_symbol?: string;
  token_address?: string;
  spender?: string;
  amount_human?: string;
};

export type ShieldRequest = {
  agent_id: string;
  scenario_id?: string | null;
  policy?: Record<string, unknown> | null;
  provenance: { user_intent: string; sources: ProvenanceSource[] };
  proposed_tx: ProposedTx;
};

export type Check = {
  id: string;
  name: string;
  passed: boolean;
  severity: Severity;
  detail: string;
  source: "policy" | "injection" | "honeypot" | "chain" | "cti";
};

export type TraceStep = {
  i: number;
  kind: "system" | "gate" | "tool" | "model";
  name: string;
  input?: unknown;
  output?: unknown;
  started_at: string;
  duration_ms: number;
  status: "ok" | "error";
};

export type CTIRecord = {
  ioc_id: string;
  title: string;
  category: string;
  severity: string;
  address?: string;
  pattern?: string;
  source: "local" | "onchain" | "goplus";
};

export type OnchainIOC = {
  ioc_id: number;
  target: string;
  category: string;
  severity: string;
  confidence: number;
  publisher: string;
  uri: string;
};

export type VerdictStatus = "final" | "pending_review" | "approved" | "denied";

export type Verdict = {
  id: string;
  ts: string;
  agent_id: string;
  scenario_id: string | null;
  decision: Decision;
  status: VerdictStatus;
  mode: Mode;
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
  chain: {
    chain_id: number;
    network: string;
    to_is_contract: boolean | null;
    code_size: number | null;
    decoded_call: { selector: string; signature: string; args: Record<string, string> } | null;
    simulation: { ok: boolean; revert_reason: string | null } | null;
    goplus: {
      token?: { is_honeypot: boolean; buy_tax: string; sell_tax: string; flags: string[] };
      address?: { malicious: boolean; flags: string[] };
    } | null;
    onchain_ioc: OnchainIOC | null;
    errors: string[];
  };
  cti_hits: CTIRecord[];
  explanations: string[];
  operator_summary: string;
  trace: TraceStep[];
  review: { action: "APPROVE" | "DENY"; note: string; operator: string; ts: string } | null;
  proposed_tx: ProposedTx;
  latency_ms: number;
  engine: string;
  event_doc: Record<string, unknown>;
};

export type Scenario = {
  id: string;
  name: string;
  family: "injection" | "honeypot" | "drainer" | "clean";
  blurb: string;
  expected: Decision;
  request: ShieldRequest;
};

export type Health = {
  ok: boolean;
  model_provider: string;
  strands_ready: boolean;
  store: "clickhouse" | "memory";
  chain_rpc: boolean;
  registry_address: string | null;
  runtime: "agentcore" | "vercel" | "local";
};

export type AttackResult = { scenario: Scenario; verdict: Verdict; matched_expected: boolean };
export type AttackAllResult = { results: AttackResult[]; score: { matched: number; total: number } };

export type Overview = {
  stats: {
    total: number;
    blocked: number;
    quarantined: number;
    allowed: number;
    pending_review: number;
    avg_latency_ms: number;
    /** 0-100: share of checks settled ALLOW/BLOCK without paging a human. */
    auto_resolved_pct: number;
  };
  latest: Verdict[];
  cti_count: number;
  model_provider: string;
  store: string;
};

export type CTIView = {
  feed: CTIRecord[];
  onchain: { registry_address: string | null; chain_id: 84532; iocs: OnchainIOC[] };
};

export type Analytics = {
  timeline: { bucket: string; ALLOW: number; BLOCK: number; QUARANTINE: number }[];
  attack_classes: { attack_class: string; count: number }[];
  latency: { p50: number; p95: number; p99: number };
  top_failing_checks: { check_id: string; count: number }[];
  anomalies: {
    agent_id: string;
    window_count: number;
    baseline_mean: number;
    zscore: number;
    flagged: boolean;
  }[];
  source: "clickhouse" | "memory";
};

export type Offline = { error: string; offline: true };

export const RPC_ACTIONS = ["health", "scenarios", "shield", "attack", "review", "telemetry"] as const;
export type RpcAction = (typeof RPC_ACTIONS)[number];

export function isOffline(x: unknown): x is Offline {
  return typeof x === "object" && x !== null && (x as Offline).offline === true;
}

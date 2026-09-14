import {
  DEFAULT_POLICY,
  type Gate1Result,
  type GateCheck,
  type ShieldPolicy,
  type ShieldRequest,
} from "./types";
import { scanProvenanceForInjection } from "./injection";
import { scanTxForHoneypotRisk } from "./honeypot";

const rateBuckets = new Map<string, number[]>();

function mergePolicy(partial?: Partial<ShieldPolicy>): ShieldPolicy {
  return { ...DEFAULT_POLICY, ...partial };
}

function checkRateLimit(agentId: string, limit: number): GateCheck {
  const now = Date.now();
  const windowMs = 60_000;
  const prev = (rateBuckets.get(agentId) ?? []).filter((t) => now - t < windowMs);
  prev.push(now);
  rateBuckets.set(agentId, prev);
  const ok = prev.length <= limit;
  return {
    id: "P1_RATE_LIMIT",
    name: "Per-agent rate limit",
    passed: ok,
    severity: ok ? "info" : "high",
    detail: ok
      ? `${prev.length}/${limit} checks in the last minute`
      : `Rate limit exceeded (${prev.length}/${limit})`,
  };
}

function checkValueCaps(req: ShieldRequest, policy: ShieldPolicy): GateCheck[] {
  const value = BigInt(req.proposed_tx.value_wei || "0");
  const max = BigInt(policy.max_value_wei);
  const per = BigInt(policy.per_counterparty_max_wei);
  const checks: GateCheck[] = [];

  checks.push({
    id: "P2_MAX_VALUE",
    name: "Global value cap",
    passed: value <= max,
    severity: value <= max ? "info" : "critical",
    detail:
      value <= max
        ? `value ${value.toString()} ≤ cap ${max.toString()}`
        : `value ${value.toString()} exceeds cap ${max.toString()}`,
  });

  checks.push({
    id: "P3_COUNTERPARTY_CAP",
    name: "Per-counterparty cap",
    passed: value <= per,
    severity: value <= per ? "info" : "high",
    detail:
      value <= per
        ? `counterparty transfer within ${per.toString()} wei`
        : `counterparty transfer exceeds ${per.toString()} wei`,
  });

  return checks;
}

function checkLists(req: ShieldRequest, policy: ShieldPolicy): GateCheck[] {
  const to = req.proposed_tx.to.toLowerCase();
  const checks: GateCheck[] = [];

  if (policy.denylist.map((a) => a.toLowerCase()).includes(to)) {
    checks.push({
      id: "P4_DENYLIST",
      name: "Policy denylist",
      passed: false,
      severity: "critical",
      detail: `${to} is denylisted by operator policy`,
    });
  }

  if (policy.allowlist.length > 0) {
    const ok = policy.allowlist.map((a) => a.toLowerCase()).includes(to);
    checks.push({
      id: "P5_ALLOWLIST",
      name: "Policy allowlist",
      passed: ok,
      severity: ok ? "info" : "high",
      detail: ok
        ? "Counterparty is allowlisted"
        : "Counterparty not on allowlist — blocked",
    });
  } else {
    checks.push({
      id: "P5_ALLOWLIST",
      name: "Policy allowlist",
      passed: true,
      severity: "info",
      detail: "Allowlist empty — open mode with other gates",
    });
  }

  return checks;
}

function checkNovelContract(req: ShieldRequest, policy: ShieldPolicy): GateCheck {
  const known = new Set([
    "0x0000000000000000000000000000000000000001", // demo WETH
    "0x0000000000000000000000000000000000000002", // demo Uniswap
    "0x0000000000000000000000000000000000000003", // demo USDC
  ]);
  const to = req.proposed_tx.to.toLowerCase();
  const isKnown = known.has(to) || policy.allowlist.map((a) => a.toLowerCase()).includes(to);
  if (!policy.novel_contract_quarantine || isKnown) {
    return {
      id: "P6_NOVEL_CONTRACT",
      name: "Novel contract quarantine",
      passed: true,
      severity: "info",
      detail: isKnown
        ? "Counterparty is known / allowlisted"
        : "Quarantine disabled",
    };
  }
  return {
    id: "P6_NOVEL_CONTRACT",
    name: "Novel contract quarantine",
    passed: false,
    severity: "medium",
    detail: `First-seen contract ${to} — quarantine until attested`,
  };
}

/**
 * Gate 1 — deterministic, non-bypassable by any model.
 * Prompt injection, honeypot IOCs, value caps, lists, rate limits.
 */
export function runGate1(req: ShieldRequest): Gate1Result {
  const policy = mergePolicy(req.policy);
  const checks: GateCheck[] = [
    checkRateLimit(req.agent_id, policy.rate_limit_per_minute),
    ...checkValueCaps(req, policy),
    ...checkLists(req, policy),
    checkNovelContract(req, policy),
    ...scanProvenanceForInjection(req.provenance.sources, req.provenance.user_intent),
    ...scanTxForHoneypotRisk(req.proposed_tx),
  ];

  const hardFail = checks.some(
    (c) =>
      !c.passed &&
      (c.severity === "critical" ||
        c.severity === "high" ||
        c.id === "P5_ALLOWLIST" ||
        c.id === "P2_MAX_VALUE"),
  );

  // Novel contract alone → quarantine path (handled by engine), not hard fail here
  const passed = !hardFail;

  return { passed, checks };
}

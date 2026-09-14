export interface CTIRecord {
  ioc_id: string;
  title: string;
  category:
    | "honeypot"
    | "drainer"
    | "prompt_injection"
    | "malicious_metadata"
    | "sybil_reviewer"
    | "x402_abuse";
  severity: "info" | "low" | "medium" | "high" | "critical";
  address?: string;
  pattern?: string;
  reason: string;
  mitre?: string;
  first_seen: string;
  source: string;
}

export const KNOWN_HONEYPOTS = [
  {
    address: "0x111111111111111111111111111111111111dead",
    name: "SAFE2MOON honeypot",
    reason: "Buy succeeds, sell always reverts; tax wallet is deployer",
  },
  {
    address: "0x222222222222222222222222222222222222beef",
    name: "ArbV3Router lookalike",
    reason: "Bytecode clone of Uniswap V3 router with siphon hook",
  },
];

export const KNOWN_DRAINERS = [
  {
    address: "0x333333333333333333333333333333333333cafe",
    name: "Permit2 phantom spender",
    reason: "Drains via crafted permit signatures after unlimited approve",
  },
  {
    address: "0x444444444444444444444444444444444444fade",
    name: "AgentWallet interceptor",
    reason: "Man-in-the-middle proxy that rewrites agent calldata",
  },
];

export const CTI_FEED: CTIRecord[] = [
  {
    ioc_id: "CTI-2026-001",
    title: "Morse-code wallet drain via token metadata",
    category: "prompt_injection",
    severity: "critical",
    pattern: "morse_stego",
    reason:
      "Documented live theft (~$204k): hostile Morse payload in token URI / social bio hijacked agent intent",
    mitre: "AML.T1059",
    first_seen: "2026-03-12",
    source: "AgentShield CTI",
  },
  {
    ioc_id: "CTI-2026-002",
    title: "SAFE2MOON honeypot cluster",
    category: "honeypot",
    severity: "critical",
    address: KNOWN_HONEYPOTS[0].address,
    reason: KNOWN_HONEYPOTS[0].reason,
    mitre: "AML.T1565",
    first_seen: "2026-01-08",
    source: "AgentShield CTI",
  },
  {
    ioc_id: "CTI-2026-003",
    title: "ArbV3Router bytecode siphon",
    category: "honeypot",
    severity: "high",
    address: KNOWN_HONEYPOTS[1].address,
    reason: KNOWN_HONEYPOTS[1].reason,
    first_seen: "2026-04-22",
    source: "AgentShield CTI",
  },
  {
    ioc_id: "CTI-2026-004",
    title: "Permit2 phantom spender",
    category: "drainer",
    severity: "critical",
    address: KNOWN_DRAINERS[0].address,
    reason: KNOWN_DRAINERS[0].reason,
    first_seen: "2026-02-19",
    source: "AgentShield CTI",
  },
  {
    ioc_id: "CTI-2026-005",
    title: "AgentWallet interceptor proxy",
    category: "drainer",
    severity: "critical",
    address: KNOWN_DRAINERS[1].address,
    reason: KNOWN_DRAINERS[1].reason,
    first_seen: "2026-05-01",
    source: "AgentShield CTI",
  },
  {
    ioc_id: "CTI-2026-006",
    title: "x402 discovery Sybil capture",
    category: "x402_abuse",
    severity: "high",
    pattern: "sybil_server_metadata",
    reason:
      "Crafted server metadata captured 71.8% of agent selections; 5 Sybil aliases captured 60.2%",
    first_seen: "2026-06-10",
    source: "arXiv x402 attack study",
  },
  {
    ioc_id: "CTI-2026-007",
    title: "ERC-8004 fake reviewer swarm",
    category: "sybil_reviewer",
    severity: "high",
    pattern: "fake_reputation_ring",
    reason: "Up to 90.6% of reviewers in observed rings were coordinated Sybils",
    first_seen: "2026-07-03",
    source: "AgentShield CTI",
  },
  {
    ioc_id: "CTI-2026-008",
    title: "Instruction override in tool JSON",
    category: "prompt_injection",
    severity: "high",
    pattern: "ignore previous instructions",
    reason: "Tool responses embedding jailbreak phrases to flip take→drain",
    first_seen: "2026-03-28",
    source: "AgentShield CTI",
  },
];

export function matchCTI(opts: {
  address?: string;
  textBlob?: string;
}): typeof CTI_FEED {
  const hits: typeof CTI_FEED = [];
  const addr = opts.address?.toLowerCase();
  const blob = (opts.textBlob ?? "").toLowerCase();

  for (const rec of CTI_FEED) {
    if (addr && rec.address?.toLowerCase() === addr) {
      hits.push(rec);
      continue;
    }
    if (rec.pattern && blob.includes(rec.pattern.toLowerCase())) {
      hits.push(rec);
      continue;
    }
    if (rec.category === "prompt_injection" && /ignore.*instruction|morse|\.-/.test(blob)) {
      if (!hits.find((h) => h.ioc_id === rec.ioc_id)) hits.push(rec);
    }
  }
  return hits;
}

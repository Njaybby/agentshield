import type { GateCheck, ProposedTx } from "./types";
import { KNOWN_HONEYPOTS, KNOWN_DRAINERS } from "../cti/feed";

const UNLIMITED =
  /^0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff$/i;

/** Heuristic bytecode / calldata fingerprints for common drainers. */
const DRAINER_SELECTORS = [
  "0x095ea7b3", // approve
  "0xa9059cbb", // transfer
  "0x23b872dd", // transferFrom
  "0x5c60da1b", // implementation (proxy peek)
];

export function scanTxForHoneypotRisk(tx: ProposedTx): GateCheck[] {
  const checks: GateCheck[] = [];
  const to = tx.to.toLowerCase();
  const spender = tx.spender?.toLowerCase();

  const honeypot = KNOWN_HONEYPOTS.find((h) => h.address.toLowerCase() === to);
  if (honeypot) {
    checks.push({
      id: "H1_KNOWN_HONEYPOT",
      name: "Known honeypot contract",
      passed: false,
      severity: "critical",
      detail: `${honeypot.name}: ${honeypot.reason}`,
    });
  }

  const drainerTo = KNOWN_DRAINERS.find((d) => d.address.toLowerCase() === to);
  if (drainerTo) {
    checks.push({
      id: "H2_KNOWN_DRAINER",
      name: "Known drainer counterparty",
      passed: false,
      severity: "critical",
      detail: `${drainerTo.name}: ${drainerTo.reason}`,
    });
  }

  if (spender) {
    const drainer = KNOWN_DRAINERS.find(
      (d) => d.address.toLowerCase() === spender,
    );
    if (drainer) {
      checks.push({
        id: "H2_KNOWN_DRAINER",
        name: "Known drainer spender",
        passed: false,
        severity: "critical",
        detail: `${drainer.name}: ${drainer.reason}`,
      });
    }
  }

  if (tx.method === "approve" || tx.data?.startsWith("0x095ea7b3")) {
    const amountHex = tx.data && tx.data.length >= 138 ? tx.data.slice(74, 138) : "";
    if (UNLIMITED.test(`0x${amountHex}`) || tx.amount_human === "unlimited") {
      checks.push({
        id: "H3_UNLIMITED_APPROVE",
        name: "Unlimited token approval",
        passed: false,
        severity: "high",
        detail: `Unlimited approve to ${spender ?? "unknown spender"} — quarantine required`,
      });
    }
  }

  // Fake "router" that is actually an EOA-looking short history address
  if (/router|swap|aggregator/i.test(tx.token_symbol ?? "") && !honeypot) {
    checks.push({
      id: "H4_LOOKALIKE_LABEL",
      name: "Lookalike router label",
      passed: true,
      severity: "low",
      detail: "Token/method label mimics a DEX router — flagged for Gate 2 review",
    });
  }

  if (tx.data && DRAINER_SELECTORS.some((s) => tx.data!.startsWith(s))) {
    // informational — selector alone is not hostile
  }

  // Sell-tax / can't-sell honeypot simulation stub (deterministic demo signals)
  if ((tx.token_symbol ?? "").toUpperCase().includes("SAFE") && to.endsWith("dead")) {
    checks.push({
      id: "H5_SIM_CANT_SELL",
      name: "Honeypot simulation: cannot sell",
      passed: false,
      severity: "critical",
      detail: "Simulated sell reverted — classic honeypot trap",
    });
  }

  if (checks.filter((c) => !c.passed).length === 0) {
    checks.push({
      id: "H0_CLEAN",
      name: "No honeypot / drainer IOC",
      passed: true,
      severity: "info",
      detail: "Counterparty not in CTI denylist; no unlimited approve",
    });
  }

  return checks;
}

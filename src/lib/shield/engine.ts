import { randomUUID } from "crypto";
import { runGate1 } from "./gates";
import { runGate2 } from "./reviewer";
import { pushVerdict } from "./store";
import { matchCTI } from "../cti/feed";
import type { Decision, ShieldRequest, ShieldVerdict } from "./types";
import { toElasticDoc } from "../elastic/schema";

export async function evaluateShield(
  req: ShieldRequest,
): Promise<ShieldVerdict> {
  const t0 = Date.now();
  const gate1 = runGate1(req);

  const forcedBlock = gate1.checks.some(
    (c) =>
      !c.passed &&
      (c.id.startsWith("S1_") ||
        c.id.startsWith("H1_") ||
        c.id.startsWith("H2_") ||
        c.id.startsWith("H3_") ||
        c.id.startsWith("H5_") ||
        c.id === "P2_MAX_VALUE" ||
        c.id === "P4_DENYLIST" ||
        c.id === "P1_RATE_LIMIT" ||
        (c.id === "P5_ALLOWLIST" && c.severity !== "info")),
  );

  const novelFail = gate1.checks.some(
    (c) => c.id === "P6_NOVEL_CONTRACT" && !c.passed,
  );

  const gate2 = forcedBlock
    ? {
        passed: false,
        score: 0,
        hijack_likelihood: 1,
        reasons: ["Skipped — Gate 1 hard failure"],
        model: "n/a",
        mode: "heuristic" as const,
      }
    : await runGate2(req);

  const textBlob = [
    req.provenance.user_intent,
    ...req.provenance.sources.map((s) => s.content),
  ].join("\n");

  const cti = matchCTI({
    address: req.proposed_tx.to,
    textBlob,
  }).map((r) => ({
    ioc_id: r.ioc_id,
    title: r.title,
    severity: r.severity,
    category: r.category,
    match: r.address ?? r.pattern ?? r.category,
    mitre: r.mitre,
  }));

  if (req.proposed_tx.spender) {
    for (const hit of matchCTI({ address: req.proposed_tx.spender })) {
      if (!cti.find((c) => c.ioc_id === hit.ioc_id)) {
        cti.push({
          ioc_id: hit.ioc_id,
          title: hit.title,
          severity: hit.severity,
          category: hit.category,
          match: hit.address ?? hit.pattern ?? hit.category,
          mitre: hit.mitre,
        });
      }
    }
  }

  let decision: Decision;
  if (forcedBlock || !gate2.passed) {
    decision = "BLOCK";
  } else if (novelFail) {
    decision = "QUARANTINE";
  } else {
    decision = "ALLOW";
  }

  const failed = gate1.checks.filter((c) => !c.passed);
  const explanations = [
    `Gate 1 ${forcedBlock ? "FAIL" : "PASS"} — ${failed.length} failing check(s)`,
    ...failed.slice(0, 4).map((c) => `${c.id}: ${c.detail}`),
    `Gate 2 ${gate2.mode} — hijack=${gate2.hijack_likelihood.toFixed(2)} (${gate2.model})`,
    ...gate2.reasons.slice(0, 3),
    cti.length
      ? `CTI matches: ${cti.map((h) => h.ioc_id).join(", ")}`
      : "CTI: no IOC matches",
  ];

  const verdict: ShieldVerdict = {
    id: randomUUID(),
    ts: new Date().toISOString(),
    agent_id: req.agent_id,
    decision,
    gate1,
    gate2,
    cti_hits: cti,
    explanations,
    proposed_tx: req.proposed_tx,
    scenario_id: req.scenario_id,
    latency_ms: Date.now() - t0,
    elastic_doc: {},
  };
  verdict.elastic_doc = toElasticDoc(verdict);
  pushVerdict(verdict);
  return verdict;
}

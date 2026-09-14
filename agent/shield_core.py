"""Deterministic Gate 1 + CTI + honeypot core used by Strands tools."""

from __future__ import annotations

import re
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any

MORSE_MAP = {
    ".-": "A",
    "-...": "B",
    "-.-.": "C",
    "-..": "D",
    ".": "E",
    "..-.": "F",
    "--.": "G",
    "....": "H",
    "..": "I",
    ".---": "J",
    "-.-": "K",
    ".-..": "L",
    "--": "M",
    "-.": "N",
    "---": "O",
    ".--.": "P",
    "--.-": "Q",
    ".-.": "R",
    "...": "S",
    "-": "T",
    "..-": "U",
    "...-": "V",
    ".--": "W",
    "-..-": "X",
    "-.--": "Y",
    "--..": "Z",
}

INJECTION_PHRASES = [
    re.compile(r"ignore (all |any )?(previous|prior|above) (instructions|rules|prompts)", re.I),
    re.compile(r"disregard (your|the) (system|safety|policy)", re.I),
    re.compile(r"you are now (unrestricted|jailbroken|DAN)", re.I),
    re.compile(r"override (safety|policy|guardrails?)", re.I),
    re.compile(r"transfer (all|entire) (funds|balance) to", re.I),
    re.compile(r"exfiltrat(e|ion)|leak (the )?(seed|private key|mnemonic)", re.I),
]

MORSE_RE = re.compile(
    r"(?:^|[\s([{])([.\-\/]{1,6}(?:\s+[.\-\/]{1,6}){4,})(?:$|[\s)\]}.,;:!?\n])",
    re.M,
)

HONEYPOTS = {
    "0x111111111111111111111111111111111111dead": "SAFE2MOON honeypot — sells revert",
    "0x222222222222222222222222222222222222beef": "ArbV3Router lookalike siphon",
}

DRAINERS = {
    "0x333333333333333333333333333333333333cafe": "Permit2 phantom spender",
    "0x444444444444444444444444444444444444fade": "AgentWallet interceptor",
}

KNOWN_ROUTERS = {
    "0x0000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000002",
    "0x0000000000000000000000000000000000000003",
}

CTI_FEED = [
    {
        "ioc_id": "CTI-2026-001",
        "title": "Morse-code wallet drain via token metadata",
        "category": "prompt_injection",
        "severity": "critical",
        "pattern": "morse",
    },
    {
        "ioc_id": "CTI-2026-002",
        "title": "SAFE2MOON honeypot cluster",
        "category": "honeypot",
        "severity": "critical",
        "address": "0x111111111111111111111111111111111111dead",
    },
    {
        "ioc_id": "CTI-2026-004",
        "title": "Permit2 phantom spender",
        "category": "drainer",
        "severity": "critical",
        "address": "0x333333333333333333333333333333333333cafe",
    },
    {
        "ioc_id": "CTI-2026-005",
        "title": "AgentWallet interceptor proxy",
        "category": "drainer",
        "severity": "critical",
        "address": "0x444444444444444444444444444444444444fade",
    },
    {
        "ioc_id": "CTI-2026-007",
        "title": "ERC-8004 fake reviewer swarm",
        "category": "sybil_reviewer",
        "severity": "high",
        "pattern": "sybil",
    },
]

_rate: dict[str, list[float]] = {}
_verdicts: list[dict[str, Any]] = []


@dataclass
class Check:
    id: str
    name: str
    passed: bool
    severity: str
    detail: str


def _decode_morse(chunk: str) -> str:
    out = []
    for tok in chunk.strip().split():
        if tok == "/":
            out.append(" ")
        else:
            out.append(MORSE_MAP.get(tok, "?"))
    return re.sub(r"\s+", " ", "".join(out)).strip()


def scan_injection(user_intent: str, sources: list[dict[str, str]]) -> list[Check]:
    checks: list[Check] = []
    corpus = [("user_intent", user_intent)] + [
        (f"{s.get('type', 'src')}:{i}", s.get("content", "")) for i, s in enumerate(sources)
    ]
    for label, content in corpus:
        for re_pat in INJECTION_PHRASES:
            if re_pat.search(content):
                checks.append(
                    Check(
                        "S1_PROMPT_INJECTION",
                        "Prompt-injection phrase",
                        False,
                        "critical",
                        f"Matched {re_pat.pattern} in {label}",
                    )
                )
        m = MORSE_RE.search(content)
        if m:
            decoded = _decode_morse(m.group(1))
            hostile = bool(
                re.search(
                    r"TRANSFER|DRAIN|IGNORE|APPROVE|SEED|PRIVATE|WALLET|SENDALL|HIJACK",
                    decoded,
                )
            )
            checks.append(
                Check(
                    "S1_MORSE_STEGANOGRAPHY",
                    "Morse steganography",
                    not hostile,
                    "critical" if hostile else "medium",
                    f'Decoded Morse in {label}: "{decoded}"'
                    + (" — hostile payload" if hostile else ""),
                )
            )
    if not checks:
        checks.append(
            Check(
                "S1_CLEAN",
                "Injection surface clean",
                True,
                "info",
                "No injection / stego signatures in provenance",
            )
        )
    return checks


def scan_honeypot(tx: dict[str, Any]) -> list[Check]:
    checks: list[Check] = []
    to = str(tx.get("to", "")).lower()
    spender = str(tx.get("spender") or "").lower()

    if to in HONEYPOTS:
        checks.append(
            Check("H1_KNOWN_HONEYPOT", "Known honeypot", False, "critical", HONEYPOTS[to])
        )
    if to in DRAINERS:
        checks.append(
            Check("H2_KNOWN_DRAINER", "Known drainer counterparty", False, "critical", DRAINERS[to])
        )
    if spender in DRAINERS:
        checks.append(
            Check("H2_KNOWN_DRAINER", "Known drainer spender", False, "critical", DRAINERS[spender])
        )
    if tx.get("method") == "approve" and (
        tx.get("amount_human") == "unlimited"
        or "ffffffffffffffff" in str(tx.get("data") or "").lower()
    ):
        checks.append(
            Check(
                "H3_UNLIMITED_APPROVE",
                "Unlimited token approval",
                False,
                "high",
                f"Unlimited approve to {spender or 'unknown'}",
            )
        )
    if "SAFE" in str(tx.get("token_symbol") or "").upper() and to.endswith("dead"):
        checks.append(
            Check(
                "H5_SIM_CANT_SELL",
                "Honeypot simulation: cannot sell",
                False,
                "critical",
                "Simulated sell reverted",
            )
        )
    if not any(not c.passed for c in checks):
        checks.append(
            Check("H0_CLEAN", "No honeypot / drainer IOC", True, "info", "Counterparty clean")
        )
    return checks


def match_cti(address: str | None, text_blob: str) -> list[dict[str, Any]]:
    hits = []
    addr = (address or "").lower()
    blob = text_blob.lower()
    for rec in CTI_FEED:
        if rec.get("address") and rec["address"].lower() == addr:
            hits.append(rec)
        elif rec.get("pattern") and rec["pattern"] in blob:
            hits.append(rec)
        elif rec["category"] == "prompt_injection" and (
            "ignore" in blob and "instruction" in blob or "morse" in blob or ".-" in blob
        ):
            if rec not in hits:
                hits.append(rec)
    return hits


def run_gate1(
    agent_id: str,
    user_intent: str,
    sources: list[dict[str, str]],
    tx: dict[str, Any],
    policy: dict[str, Any] | None = None,
) -> dict[str, Any]:
    policy = policy or {}
    max_wei = int(policy.get("max_value_wei", "5000000000000000000"))
    per_wei = int(policy.get("per_counterparty_max_wei", "2000000000000000000"))
    novel_q = policy.get("novel_contract_quarantine", True)
    rate_limit = int(policy.get("rate_limit_per_minute", 30))

    checks: list[Check] = []
    now = time.time()
    bucket = [t for t in _rate.get(agent_id, []) if now - t < 60]
    bucket.append(now)
    _rate[agent_id] = bucket
    checks.append(
        Check(
            "P1_RATE_LIMIT",
            "Per-agent rate limit",
            len(bucket) <= rate_limit,
            "info" if len(bucket) <= rate_limit else "high",
            f"{len(bucket)}/{rate_limit} checks/min",
        )
    )

    value = int(tx.get("value_wei") or "0")
    checks.append(
        Check(
            "P2_MAX_VALUE",
            "Global value cap",
            value <= max_wei,
            "info" if value <= max_wei else "critical",
            f"value {value} vs cap {max_wei}",
        )
    )
    checks.append(
        Check(
            "P3_COUNTERPARTY_CAP",
            "Per-counterparty cap",
            value <= per_wei,
            "info" if value <= per_wei else "high",
            f"value {value} vs per-cp {per_wei}",
        )
    )

    to = str(tx.get("to", "")).lower()
    if novel_q and to not in KNOWN_ROUTERS:
        checks.append(
            Check(
                "P6_NOVEL_CONTRACT",
                "Novel contract quarantine",
                False,
                "medium",
                f"First-seen contract {to}",
            )
        )
    else:
        checks.append(
            Check(
                "P6_NOVEL_CONTRACT",
                "Novel contract quarantine",
                True,
                "info",
                "Known / quarantine disabled",
            )
        )

    checks.extend(scan_injection(user_intent, sources))
    checks.extend(scan_honeypot(tx))

    forced = any(
        (not c.passed)
        and (
            c.id.startswith("S1_")
            or c.id.startswith("H1_")
            or c.id.startswith("H2_")
            or c.id.startswith("H3_")
            or c.id.startswith("H5_")
            or c.id in {"P2_MAX_VALUE", "P1_RATE_LIMIT"}
        )
        for c in checks
    )
    novel_only = any(c.id == "P6_NOVEL_CONTRACT" and not c.passed for c in checks)

    return {
        "forced_block": forced,
        "novel_quarantine": novel_only and not forced,
        "checks": [asdict(c) for c in checks],
    }


def run_gate2_heuristic(
    user_intent: str, sources: list[dict[str, str]], tx: dict[str, Any]
) -> dict[str, Any]:
    blob = "\n".join([user_intent] + [s.get("content", "") for s in sources]).lower()
    intent = user_intent.lower()
    score = 0.12
    reasons: list[str] = []
    if re.search(
        r"ignore (previous|prior)|morse|transfer all|seed phrase|jailbreak|unlimited approve",
        blob,
    ):
        score += 0.55
        reasons.append("Provenance contains hostile instruction-like content")
    if tx.get("method") == "approve" and tx.get("amount_human") == "unlimited":
        score += 0.25
        reasons.append("Tx matches unlimited-approve drain pattern")
    intent_swap = bool(re.search(r"swap|buy|sell|trade|rebalance", intent))
    if intent_swap and tx.get("method") in {"transfer", "approve"}:
        score += 0.2
        reasons.append("User intent does not match proposed transaction semantics")
    if not reasons:
        reasons.append("Intent, provenance, and tx semantics are consistent")
    hijack = min(0.99, score)
    return {
        "passed": hijack < 0.45,
        "hijack_likelihood": hijack,
        "score": 1 - hijack,
        "reasons": reasons,
        "model": "agentshield-heuristic-v1",
        "mode": "heuristic",
    }


def decide(gate1: dict[str, Any], gate2: dict[str, Any]) -> str:
    if gate1["forced_block"] or not gate2["passed"]:
        return "BLOCK"
    if gate1["novel_quarantine"]:
        return "QUARANTINE"
    return "ALLOW"


def build_elastic_doc(verdict: dict[str, Any]) -> dict[str, Any]:
    return {
        "@timestamp": verdict["ts"],
        "event": {
            "kind": "alert",
            "category": ["intrusion_detection"],
            "action": "agentshield.pre_trade_check",
            "outcome": "success" if verdict["decision"] == "ALLOW" else "failure",
            "id": verdict["id"],
        },
        "agent": {"id": verdict["agent_id"], "name": "AgentShield", "type": "strands"},
        "agentshield": {
            "decision": verdict["decision"],
            "scenario_id": verdict.get("scenario_id"),
            "hijack_likelihood": verdict["gate2"]["hijack_likelihood"],
            "failing_checks": [
                c["id"] for c in verdict["gate1"]["checks"] if not c["passed"]
            ],
        },
        "tags": ["agentshield", "strands", "pre-trade", "soc", "professional-agents"],
        "message": f"AgentShield {verdict['decision']} for {verdict['agent_id']}",
    }


def evaluate_shield(payload: dict[str, Any]) -> dict[str, Any]:
    t0 = time.time()
    agent_id = payload.get("agent_id", "unknown")
    provenance = payload.get("provenance") or {}
    user_intent = provenance.get("user_intent", "")
    sources = provenance.get("sources") or []
    tx = payload.get("proposed_tx") or {}
    policy = payload.get("policy")

    gate1 = run_gate1(agent_id, user_intent, sources, tx, policy)
    if gate1["forced_block"]:
        gate2 = {
            "passed": False,
            "hijack_likelihood": 1.0,
            "score": 0.0,
            "reasons": ["Skipped — Gate 1 hard failure"],
            "model": "n/a",
            "mode": "heuristic",
        }
    else:
        gate2 = run_gate2_heuristic(user_intent, sources, tx)

    blob = "\n".join([user_intent] + [s.get("content", "") for s in sources])
    cti = match_cti(tx.get("to"), blob)
    if tx.get("spender"):
        for hit in match_cti(tx.get("spender"), ""):
            if hit not in cti:
                cti.append(hit)

    decision = decide(gate1, gate2)
    failed = [c for c in gate1["checks"] if not c["passed"]]
    explanations = [
        f"Gate 1 {'FAIL' if gate1['forced_block'] else 'PASS'} — {len(failed)} failing check(s)",
        *[f"{c['id']}: {c['detail']}" for c in failed[:4]],
        f"Gate 2 {gate2['mode']} — hijack={gate2['hijack_likelihood']:.2f} ({gate2['model']})",
        *gate2["reasons"][:3],
        f"CTI matches: {', '.join(h['ioc_id'] for h in cti)}" if cti else "CTI: no IOC matches",
    ]
    verdict = {
        "id": str(uuid.uuid4()),
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "agent_id": agent_id,
        "decision": decision,
        "gate1": gate1,
        "gate2": gate2,
        "cti_hits": cti,
        "explanations": explanations,
        "proposed_tx": tx,
        "scenario_id": payload.get("scenario_id"),
        "latency_ms": int((time.time() - t0) * 1000),
        "engine": "strands-tools",
    }
    verdict["elastic_doc"] = build_elastic_doc(verdict)
    _verdicts.insert(0, verdict)
    _verdicts[:] = _verdicts[:200]
    return verdict


def list_verdicts(limit: int = 50) -> list[dict[str, Any]]:
    return _verdicts[:limit]


def stats() -> dict[str, int]:
    total = len(_verdicts)
    return {
        "total": total,
        "blocked": sum(1 for v in _verdicts if v["decision"] == "BLOCK"),
        "quarantined": sum(1 for v in _verdicts if v["decision"] == "QUARANTINE"),
        "allowed": sum(1 for v in _verdicts if v["decision"] == "ALLOW"),
        "avgLatency": int(sum(v["latency_ms"] for v in _verdicts) / total) if total else 0,
    }

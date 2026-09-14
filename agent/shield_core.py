"""Deterministic security rules: injection/stego scans, honeypot + drainer IOCs, policy caps, CTI, heuristic Gate 2."""

from __future__ import annotations

import re
import time
from dataclasses import asdict, dataclass
from typing import Any

from .chain import KNOWN_CONTRACTS, parse_wei

MORSE_MAP = {
    ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E", "..-.": "F", "--.": "G",
    "....": "H", "..": "I", ".---": "J", "-.-": "K", ".-..": "L", "--": "M", "-.": "N",
    "---": "O", ".--.": "P", "--.-": "Q", ".-.": "R", "...": "S", "-": "T", "..-": "U",
    "...-": "V", ".--": "W", "-..-": "X", "-.--": "Y", "--..": "Z",
    "-----": "0", ".----": "1", "..---": "2", "...--": "3", "....-": "4",
    ".....": "5", "-....": "6", "--...": "7", "---..": "8", "----.": "9",
}

INJECTION_PHRASES = [
    re.compile(r"ignore (all |any )?(previous|prior|above) (instructions|rules|prompts)", re.I),
    re.compile(r"disregard (your|the|all) (system|safety|policy|previous)", re.I),
    re.compile(r"you are now (unrestricted|jailbroken|DAN|in developer mode)", re.I),
    re.compile(r"override (safety|policy|guardrails?)", re.I),
    re.compile(r"(new|updated) (system )?instructions?:", re.I),
    re.compile(r"transfer (all|entire) (funds|balance|tokens)", re.I),
    re.compile(r"exfiltrat(e|ion)|leak (the )?(seed|private key|mnemonic)", re.I),
]

HOSTILE_WORDS = re.compile(r"TRANSFER|DRAIN|IGNORE|APPROVE|SEED|PRIVATE|WALLET|SENDALL|HIJACK|OVERRIDE", re.I)

MORSE_RE = re.compile(
    r"(?:^|[\s([{:])([.\-\/]{1,6}(?:\s+[.\-\/]{1,6}){4,})(?:$|[\s)\]}.,;:!?\n])",
    re.M,
)
ZERO_WIDTH_RE = re.compile("[​-‏⁠-⁤﻿]")
ADDRESS_RE = re.compile(r"0x[a-fA-F0-9]{40}")

HONEYPOTS = {
    "0x111111111111111111111111111111111111dead": "SAFE2MOON honeypot: sells revert",
    "0x222222222222222222222222222222222222beef": "ArbV3Router lookalike siphon",
}

DRAINERS = {
    "0x333333333333333333333333333333333333cafe": "Permit2 phantom spender",
    "0x444444444444444444444444444444444444fade": "AgentWallet interceptor",
}

CTI_FEED = [
    {"ioc_id": "CTI-2026-001", "title": "Morse-code wallet drain via token metadata", "category": "prompt_injection", "severity": "critical", "pattern": "morse", "source": "local"},
    {"ioc_id": "CTI-2026-002", "title": "SAFE2MOON honeypot cluster", "category": "honeypot", "severity": "critical", "address": "0x111111111111111111111111111111111111dead", "source": "local"},
    {"ioc_id": "CTI-2026-003", "title": "Unicode tag smuggling in tool output", "category": "prompt_injection", "severity": "critical", "pattern": "unicode_tags", "source": "local"},
    {"ioc_id": "CTI-2026-004", "title": "Permit2 phantom spender", "category": "drainer", "severity": "critical", "address": "0x333333333333333333333333333333333333cafe", "source": "local"},
    {"ioc_id": "CTI-2026-005", "title": "AgentWallet interceptor proxy", "category": "drainer", "severity": "critical", "address": "0x444444444444444444444444444444444444fade", "source": "local"},
    {"ioc_id": "CTI-2026-006", "title": "Fake router migration notices", "category": "social_engineering", "severity": "high", "pattern": "migration router", "source": "local"},
]

DEFAULT_POLICY = {
    "max_value_wei": "5000000000000000000",
    "per_counterparty_max_wei": "2000000000000000000",
    "novel_contract_quarantine": True,
    "rate_limit_per_minute": 30,
    "allowlist": [],
}

_rate: dict[str, list[float]] = {}


@dataclass
class Check:
    id: str
    name: str
    passed: bool
    severity: str  # info | medium | high | critical
    detail: str
    source: str  # policy | injection | honeypot | chain | cti


def _decode_morse(chunk: str) -> str:
    out = [" " if tok == "/" else MORSE_MAP.get(tok, "?") for tok in chunk.strip().split()]
    return re.sub(r"\s+", " ", "".join(out)).strip()


def _decode_unicode_tags(text: str) -> str:
    # Unicode "tag" characters (U+E0000..U+E007F) mirror ASCII and are invisible when rendered.
    return "".join(chr(ord(ch) - 0xE0000) for ch in text if 0xE0000 <= ord(ch) <= 0xE007F)


def scan_injection(user_intent: str, sources: list[dict[str, Any]]) -> list[Check]:
    checks: list[Check] = []
    corpus = [("user_intent", user_intent)] + [
        (f"{s.get('type', 'src')}[{i}]", str(s.get("content", ""))) for i, s in enumerate(sources)
    ]
    for label, content in corpus:
        for pattern in INJECTION_PHRASES:
            m = pattern.search(content)
            if m:
                checks.append(Check("S1_PROMPT_INJECTION", "Prompt-injection phrase", False, "critical", f'"{m.group(0)}" in {label}', "injection"))
        m = MORSE_RE.search(content)
        if m:
            decoded = _decode_morse(m.group(1))
            hostile = bool(HOSTILE_WORDS.search(decoded))
            checks.append(
                Check(
                    "S1_MORSE_STEGANOGRAPHY",
                    "Morse steganography",
                    not hostile,
                    "critical" if hostile else "medium",
                    f'Decoded Morse in {label}: "{decoded}"' + (" (hostile payload)" if hostile else ""),
                    "injection",
                )
            )
        tags = _decode_unicode_tags(content)
        if tags:
            checks.append(Check("S1_UNICODE_SMUGGLING", "Invisible Unicode tag payload", False, "critical", f'Hidden text in {label}: "{tags[:120]}"', "injection"))
        elif ZERO_WIDTH_RE.search(content):
            checks.append(Check("S1_ZERO_WIDTH", "Zero-width characters", False, "medium", f"Zero-width characters in {label}", "injection"))
    if not checks:
        checks.append(Check("S1_CLEAN", "Injection surface clean", True, "info", "No injection or stego signatures in provenance", "injection"))
    return checks


def _spender(tx: dict[str, Any], ev: dict[str, Any]) -> str:
    decoded = (ev.get("decoded_call") or {}).get("args", {})
    return str(decoded.get("spender") or decoded.get("operator") or tx.get("spender") or "").lower()


def scan_honeypot(tx: dict[str, Any], ev: dict[str, Any]) -> list[Check]:
    checks: list[Check] = []
    to = str(tx.get("to", "")).lower()
    spender = _spender(tx, ev)
    decoded = ev.get("decoded_call") or {}
    method = (decoded.get("signature") or tx.get("method") or "").split("(")[0]

    if to in HONEYPOTS:
        checks.append(Check("H1_KNOWN_HONEYPOT", "Known honeypot", False, "critical", HONEYPOTS[to], "honeypot"))
    if to in DRAINERS:
        checks.append(Check("H2_KNOWN_DRAINER", "Known drainer counterparty", False, "critical", DRAINERS[to], "honeypot"))
    if spender in DRAINERS:
        checks.append(Check("H2_KNOWN_DRAINER", "Known drainer spender", False, "critical", DRAINERS[spender], "honeypot"))

    unlimited = decoded.get("args", {}).get("amount") == "MAX_UINT256" or (
        method in {"approve", "increaseAllowance"} and tx.get("amount_human") == "unlimited"
    )
    if method == "setApprovalForAll" and decoded.get("args", {}).get("approved") == "True":
        unlimited = True
    if method in {"approve", "increaseAllowance", "setApprovalForAll"} and unlimited:
        label = KNOWN_CONTRACTS.get(spender)
        if label:
            checks.append(Check("H3_UNLIMITED_APPROVE", "Unlimited approval", True, "info", f"Unlimited approval to {label} (standard router pattern)", "honeypot"))
        else:
            checks.append(Check("H3_UNLIMITED_APPROVE", "Unlimited approval", False, "critical", f"Unlimited approval to untrusted spender {spender or 'unknown'}", "honeypot"))

    if not any(not c.passed for c in checks):
        checks.append(Check("H0_CLEAN", "No honeypot / drainer IOC", True, "info", "Counterparty not on local IOC lists", "honeypot"))
    return checks


def chain_checks(tx: dict[str, Any], ev: dict[str, Any]) -> list[Check]:
    checks: list[Check] = []
    if ev.get("decoded_call") and ev.get("to_is_contract") is False:
        checks.append(Check("C1_CALL_TO_EOA", "Calldata sent to non-contract", False, "high", f"{tx.get('to')} has no bytecode on {ev['network']} but tx carries calldata", "chain"))
    sim = ev.get("simulation")
    if sim and not sim["ok"]:
        checks.append(Check("C2_SIM_REVERT", "Simulation reverted", False, "medium", f"eth_call reverted: {sim['revert_reason']}", "chain"))
    goplus = ev.get("goplus") or {}
    token = goplus.get("token")
    if token and (token["is_honeypot"] or token["flags"]):
        checks.append(Check("C3_GOPLUS_TOKEN_RISK", "GoPlus token risk", False, "critical" if token["is_honeypot"] else "high", f"honeypot={token['is_honeypot']} sell_tax={token['sell_tax']} flags={','.join(token['flags'])}", "chain"))
    addr = goplus.get("address")
    if addr and addr["malicious"]:
        checks.append(Check("C4_GOPLUS_MALICIOUS_ADDRESS", "GoPlus malicious address", False, "critical", f"Flags: {', '.join(addr['flags'])}", "chain"))
    ioc = ev.get("onchain_ioc")
    if ioc:
        checks.append(Check("C5_ONCHAIN_IOC", "On-chain registry IOC", False, "critical" if ioc["severity"] in {"high", "critical"} else "high", f"ReputationRegistry IOC #{ioc['ioc_id']} {ioc['category']} (confidence {ioc['confidence']})", "cti"))
    if not checks:
        detail = "Chain evidence clean" if ev.get("code_size") is not None else "Chain evidence unavailable"
        checks.append(Check("C0_CHAIN_CLEAN", "Chain evidence", True, "info", detail, "chain"))
    return checks


def run_gate1(
    agent_id: str,
    user_intent: str,
    sources: list[dict[str, Any]],
    tx: dict[str, Any],
    policy: dict[str, Any] | None,
    ev: dict[str, Any],
) -> dict[str, Any]:
    policy = {**DEFAULT_POLICY, **(policy or {})}
    max_wei = int(policy["max_value_wei"])
    per_wei = int(policy["per_counterparty_max_wei"])
    rate_limit = int(policy["rate_limit_per_minute"])
    allowlist = {a.lower() for a in policy["allowlist"]}

    checks: list[Check] = []
    now = time.time()
    bucket = [t for t in _rate.get(agent_id, []) if now - t < 60] + [now]
    _rate[agent_id] = bucket
    checks.append(Check("P1_RATE_LIMIT", "Per-agent rate limit", len(bucket) <= rate_limit, "info" if len(bucket) <= rate_limit else "critical", f"{len(bucket)}/{rate_limit} checks/min", "policy"))

    try:
        value = parse_wei(tx.get("value_wei"))
    except ValueError:
        value = 0
        checks.append(Check("P0_MALFORMED_VALUE", "Malformed value", False, "high", f"Unparseable value_wei {tx.get('value_wei')!r}", "policy"))
    checks.append(Check("P2_MAX_VALUE", "Global value cap", value <= max_wei, "info" if value <= max_wei else "critical", f"{value / 1e18:.4f} ETH vs cap {max_wei / 1e18:.2f} ETH", "policy"))
    checks.append(Check("P3_COUNTERPARTY_CAP", "Per-counterparty cap", value <= per_wei, "info" if value <= per_wei else "high", f"{value / 1e18:.4f} ETH vs per-counterparty {per_wei / 1e18:.2f} ETH", "policy"))

    to = str(tx.get("to", "")).lower()
    known = to in KNOWN_CONTRACTS or to in allowlist
    if policy["novel_contract_quarantine"] and not known:
        checks.append(Check("P6_NOVEL_CONTRACT", "Novel counterparty", False, "medium", f"First-seen counterparty {to}", "policy"))
    else:
        checks.append(Check("P6_NOVEL_CONTRACT", "Novel counterparty", True, "info", KNOWN_CONTRACTS.get(to, "Allowlisted"), "policy"))

    spender = _spender(tx, ev)
    if spender and spender not in KNOWN_CONTRACTS and spender not in allowlist:
        checks.append(Check("P7_UNKNOWN_SPENDER", "Approval to unknown spender", False, "medium", f"Spender {spender} is not an allowlisted router", "policy"))

    checks.extend(scan_injection(user_intent, sources))
    checks.extend(scan_honeypot(tx, ev))
    checks.extend(chain_checks(tx, ev))

    failing = [c for c in checks if not c.passed]
    forced = any(c.severity == "critical" for c in failing)
    needs_review = any(c.severity in {"high", "medium"} for c in failing)
    ordered = sorted(checks, key=lambda c: (c.passed, ["critical", "high", "medium", "info"].index(c.severity)))
    return {
        "forced_block": forced,
        "novel_quarantine": needs_review and not forced,
        "checks": [asdict(c) for c in ordered],
    }


def infer_attack_class(gate1: dict[str, Any]) -> str:
    failing = {c["id"] for c in gate1["checks"] if not c["passed"]}
    for prefix, cls in [
        ("S1_MORSE", "steganography"),
        ("S1_UNICODE", "steganography"),
        ("S1_PROMPT", "prompt_injection"),
        ("H1_", "honeypot"),
        ("C3_", "honeypot"),
        ("H3_", "approval_drain"),
        ("H2_", "drainer"),
        ("C4_", "drainer"),
        ("C5_", "drainer"),
        ("P2_", "value_limit"),
        ("P7_", "novel_counterparty"),
        ("P6_", "novel_counterparty"),
    ]:
        if any(f.startswith(prefix) for f in failing):
            return cls
    return "none"


def run_gate2_heuristic(
    user_intent: str,
    sources: list[dict[str, Any]],
    tx: dict[str, Any],
    ev: dict[str, Any],
    gate1: dict[str, Any] | None = None,
) -> dict[str, Any]:
    blob = "\n".join([user_intent] + [str(s.get("content", "")) for s in sources]).lower()
    intent = user_intent.lower()
    method = ((ev.get("decoded_call") or {}).get("signature") or tx.get("method") or "").split("(")[0]
    score = 0.1
    reasons: list[str] = []
    evidence: list[str] = []
    ioc_fail = [c for c in (gate1 or {}).get("checks", []) if not c["passed"] and c["severity"] == "critical" and c["source"] in {"honeypot", "chain", "cti"}]
    if ioc_fail:
        score += 0.5
        reasons.append(f"Counterparty evidence: {ioc_fail[0]['name'].lower()}")
        evidence.append(ioc_fail[0]["detail"])
    m = re.search(r"ignore (previous|prior)[^.\n]*|transfer all[^.\n]*|seed phrase|jailbreak|migration router[^.\n]*", blob)
    if m or MORSE_RE.search(blob):
        score += 0.55
        reasons.append("Provenance contains instruction-like content aimed at the agent")
        evidence.append(m.group(0) if m else "morse-encoded payload")
    if method in {"approve", "increaseAllowance"} and (ev.get("decoded_call") or {}).get("args", {}).get("amount") == "MAX_UINT256":
        score += 0.25
        reasons.append("Unlimited approval matches the drain pattern")
    if re.search(r"swap|buy|sell|trade|rebalance", intent) and method == "transfer":
        score += 0.25
        reasons.append("Human asked for a trade but the tx is a plain transfer")
        evidence.append(f"intent: {user_intent}")
    if not reasons:
        reasons.append("Intent, provenance, and tx semantics are consistent")
    hijack = round(min(0.99, score), 2)
    return {
        "passed": hijack < 0.5,
        "hijack_likelihood": hijack,
        "attack_class": "none",
        "reasons": reasons,
        "evidence": evidence,
        "model": "agentshield-heuristic-v2",
        "mode": "heuristic",
    }


def match_cti(addresses: list[str], blob: str) -> list[dict[str, Any]]:
    addrs = {a.lower() for a in addresses if a}
    lower = blob.lower()
    hits = []
    for rec in CTI_FEED:
        if rec.get("address") and rec["address"] in addrs:
            hits.append(rec)
        elif rec.get("pattern") == "morse" and MORSE_RE.search(blob):
            hits.append(rec)
        elif rec.get("pattern") == "unicode_tags" and _decode_unicode_tags(blob):
            hits.append(rec)
        elif rec.get("pattern") and rec["pattern"] not in {"morse", "unicode_tags"} and rec["pattern"] in lower:
            hits.append(rec)
    return hits


def decide(gate1: dict[str, Any], gate2: dict[str, Any]) -> str:
    if gate1["forced_block"] or not gate2["passed"]:
        return "BLOCK"
    if gate1["novel_quarantine"]:
        return "QUARANTINE"
    return "ALLOW"


def build_event_doc(v: dict[str, Any]) -> dict[str, Any]:
    return {
        "@timestamp": v["ts"],
        "event": {
            "kind": "alert" if v["decision"] != "ALLOW" else "event",
            "category": ["intrusion_detection"],
            "action": "agentshield.pre_trade_check",
            "outcome": "success" if v["decision"] == "ALLOW" else "failure",
            "id": v["id"],
        },
        "agent": {"id": v["agent_id"], "name": "AgentShield", "type": "strands"},
        "agentshield": {
            "decision": v["decision"],
            "status": v["status"],
            "mode": v["mode"],
            "scenario_id": v.get("scenario_id"),
            "attack_class": v["gate2"].get("attack_class"),
            "hijack_likelihood": v["gate2"]["hijack_likelihood"],
            "failing_checks": [c["id"] for c in v["gate1"]["checks"] if not c["passed"]],
            "review": v.get("review"),
        },
        "destination": {"address": v["proposed_tx"].get("to"), "chain_id": v["proposed_tx"].get("chain_id")},
        "tags": ["agentshield", "strands", "pre-trade"],
        "message": f"AgentShield {v['decision']} for {v['agent_id']}",
    }

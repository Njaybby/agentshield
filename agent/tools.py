"""Strands @tool wrappers — the agent does real pre-trade security work."""

from __future__ import annotations

import json
from typing import Any

from strands import tool

from . import shield_core as core


@tool
def scan_prompt_injection(user_intent: str, provenance_json: str) -> str:
    """Scan user intent and provenance sources for prompt injection and Morse steganography.

    Args:
        user_intent: What the human asked the trading agent to do.
        provenance_json: JSON list of provenance sources [{type, content, url?}].
    """
    sources = json.loads(provenance_json) if provenance_json else []
    checks = core.scan_injection(user_intent, sources)
    return json.dumps({"checks": [c.__dict__ for c in checks]}, indent=2)


@tool
def check_honeypot_and_drainer(
    to_address: str,
    method: str = "",
    spender: str = "",
    amount_human: str = "",
    token_symbol: str = "",
    data: str = "",
) -> str:
    """Check whether a proposed counterparty is a known honeypot or drainer.

    Args:
        to_address: Transaction `to` address.
        method: Contract method name if known (approve, transfer, swap...).
        spender: Spender address for approvals.
        amount_human: Human-readable amount or 'unlimited'.
        token_symbol: Token ticker if known.
        data: Optional calldata hex.
    """
    tx = {
        "to": to_address,
        "method": method,
        "spender": spender or None,
        "amount_human": amount_human or None,
        "token_symbol": token_symbol or None,
        "data": data or None,
    }
    checks = core.scan_honeypot(tx)
    return json.dumps({"checks": [c.__dict__ for c in checks]}, indent=2)


@tool
def lookup_threat_intel(address: str = "", text_blob: str = "") -> str:
    """Look up AgentShield CTI IOCs for an address or free-text blob.

    Args:
        address: On-chain address to match.
        text_blob: Combined provenance/intent text for pattern matching.
    """
    hits = core.match_cti(address or None, text_blob)
    return json.dumps({"hits": hits, "count": len(hits)}, indent=2)


@tool
def run_deterministic_gate1(
    agent_id: str,
    user_intent: str,
    provenance_json: str,
    proposed_tx_json: str,
    policy_json: str = "{}",
) -> str:
    """Run Gate 1 — non-bypassable deterministic policy + injection + honeypot checks.

    Args:
        agent_id: Calling agent identifier.
        user_intent: Human intent string.
        provenance_json: JSON list of sources the trading agent read.
        proposed_tx_json: JSON proposed transaction object.
        policy_json: Optional JSON policy overrides.
    """
    sources = json.loads(provenance_json or "[]")
    tx = json.loads(proposed_tx_json or "{}")
    policy = json.loads(policy_json or "{}")
    result = core.run_gate1(agent_id, user_intent, sources, tx, policy)
    return json.dumps(result, indent=2)


@tool
def run_adversarial_gate2(
    user_intent: str,
    provenance_json: str,
    proposed_tx_json: str,
) -> str:
    """Run Gate 2 adversarial review on tx + provenance only (never the agent chat).

    Args:
        user_intent: Human intent.
        provenance_json: JSON provenance sources.
        proposed_tx_json: JSON proposed transaction.
    """
    sources = json.loads(provenance_json or "[]")
    tx = json.loads(proposed_tx_json or "{}")
    result = core.run_gate2_heuristic(user_intent, sources, tx)
    return json.dumps(result, indent=2)


@tool
def finalize_shield_verdict(
    agent_id: str,
    user_intent: str,
    provenance_json: str,
    proposed_tx_json: str,
    policy_json: str = "{}",
    scenario_id: str = "",
) -> str:
    """End-to-end shield evaluation: Gate1 + Gate2 + CTI + Elastic doc + Flight Recorder log.

    Use this when you have enough context to produce the final ALLOW/BLOCK/QUARANTINE decision.

    Args:
        agent_id: Calling agent id.
        user_intent: Human intent.
        provenance_json: JSON provenance sources.
        proposed_tx_json: JSON proposed tx.
        policy_json: Optional policy overrides.
        scenario_id: Optional attack-lab scenario id.
    """
    payload: dict[str, Any] = {
        "agent_id": agent_id,
        "provenance": {
            "user_intent": user_intent,
            "sources": json.loads(provenance_json or "[]"),
        },
        "proposed_tx": json.loads(proposed_tx_json or "{}"),
        "policy": json.loads(policy_json or "{}") or None,
        "scenario_id": scenario_id or None,
    }
    if payload["policy"] == {}:
        payload["policy"] = None
    verdict = core.evaluate_shield(payload)
    return json.dumps(verdict, indent=2)


@tool
def notify_operator(decision: str, summary: str, agent_id: str) -> str:
    """Notify the human operator of a shield decision (surfaces only when judgment is needed).

    Args:
        decision: ALLOW, BLOCK, or QUARANTINE.
        summary: Short plain-language explanation for the human.
        agent_id: Which trading agent this relates to.
    """
    note = {
        "channel": "flight_recorder",
        "agent_id": agent_id,
        "decision": decision,
        "summary": summary,
        "status": "delivered",
    }
    return json.dumps(note, indent=2)


SHIELD_TOOLS = [
    scan_prompt_injection,
    check_honeypot_and_drainer,
    lookup_threat_intel,
    run_deterministic_gate1,
    run_adversarial_gate2,
    finalize_shield_verdict,
    notify_operator,
]

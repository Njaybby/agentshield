"""Action dispatcher shared by FastAPI (POST /rpc) and the AgentCore Runtime entrypoint."""

from __future__ import annotations

import os
from typing import Any

from . import chain, engine, store
from . import shield_core as core
from .model import provider_label
from .scenarios import SCENARIOS, expected_for, get_scenario


def _scenario_public(s: dict[str, Any]) -> dict[str, Any]:
    return {k: s[k] for k in ("id", "name", "family", "blurb", "expected", "request")} | {"expected_fast": s.get("expected_fast", s["expected"])}


def _registry_iocs() -> list[dict[str, Any]]:
    iocs = []
    for addr in list(core.HONEYPOTS) + list(core.DRAINERS):
        try:
            ioc = chain.onchain_ioc(addr)
        except Exception:
            ioc = None
        if ioc:
            iocs.append(ioc)
    return iocs


def handle(action: str | None, body: dict[str, Any]) -> dict[str, Any]:
    mode = "agent" if body.get("mode") == "agent" else "fast"

    if action == "health":
        provider = provider_label()
        return {
            "ok": True,
            "service": "agentshield",
            "model_provider": provider,
            "strands_ready": provider != "none",
            "store": store.backend_name(),
            "chain_rpc": chain.rpc_healthy(),
            "registry_address": chain.registry_address(),
            "runtime": os.getenv("AGENTSHIELD_RUNTIME") or ("vercel" if os.getenv("VERCEL") else "local"),
        }

    if action == "scenarios":
        return {"attacks": [_scenario_public(s) for s in SCENARIOS]}

    if action == "shield":
        request = body.get("request")
        if not isinstance(request, dict) or "proposed_tx" not in request:
            return {"error": "body.request with proposed_tx and provenance is required"}
        return engine.evaluate(request, mode)

    if action == "attack":
        if body.get("all"):
            results = []
            for s in SCENARIOS:
                v = engine.evaluate(s["request"], "fast")
                results.append({"scenario": _scenario_public(s), "verdict": v, "matched_expected": v["decision"] == expected_for(s, "fast")})
            return {"results": results, "score": {"matched": sum(r["matched_expected"] for r in results), "total": len(results)}}
        s = get_scenario(body.get("id", ""))
        if not s:
            return {"error": "unknown attack id"}
        v = engine.evaluate(s["request"], mode)
        return {"scenario": _scenario_public(s), "verdict": v, "matched_expected": v["decision"] == expected_for(s, mode)}

    if action == "review":
        # `action` is the envelope field, so the operator's choice arrives as review_action (or decision).
        choice = body.get("review_action") or body.get("decision", "")
        return engine.review(body.get("verdict_id", ""), choice, body.get("note", ""), body.get("operator", "operator"))

    if action == "telemetry":
        view = body.get("view", "overview")
        if view == "verdicts":
            return {"verdicts": store.list_verdicts(80)}
        if view == "pending":
            return {"verdicts": store.list_verdicts(50, status="pending_review")}
        if view == "verdict":
            return store.get_verdict(body.get("id", "")) or {"error": "not found"}
        if view == "cti":
            return {"feed": core.CTI_FEED, "onchain": {"registry_address": chain.registry_address(), "chain_id": 84532, "iocs": _registry_iocs()}}
        if view == "analytics":
            return store.analytics()
        return {"stats": store.stats(), "latest": store.list_verdicts(12), "cti_count": len(core.CTI_FEED), "model_provider": provider_label(), "store": store.backend_name()}

    return {"error": f"unknown action {action!r}"}

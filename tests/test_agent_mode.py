"""Offline test of AgentShield agent mode with scripted fake models (no model API needed).

Exercises: Strands orchestrator loop, closure tools, TraceHooks, Gate 2 structured_output_model,
strictest() floor, and ClickHouse persistence. Run from the repo root:
  .venv/bin/python tests/test_agent_mode.py
"""

from __future__ import annotations

import json
import sys
import uuid
from typing import Any

sys.path.insert(0, ".")
from dotenv import load_dotenv  # noqa: E402

load_dotenv(".env")

from strands.models.model import Model  # noqa: E402

import agent.agentshield as shield  # noqa: E402
from agent.scenarios import get_scenario  # noqa: E402

NOTICE_ADDR = "0x7a1F3c0F6F4b1E52C2C8d8a4f9B0e6D3a2C1b0F9"


def tool_use_events(calls: list[tuple[str, dict[str, Any]]]):
    yield {"messageStart": {"role": "assistant"}}
    for name, args in calls:
        yield {"contentBlockStart": {"start": {"toolUse": {"toolUseId": f"t-{uuid.uuid4().hex[:8]}", "name": name}}}}
        yield {"contentBlockDelta": {"delta": {"toolUse": {"input": json.dumps(args)}}}}
        yield {"contentBlockStop": {}}
    yield {"messageStop": {"stopReason": "tool_use"}}
    yield {"metadata": {"usage": {"inputTokens": 1, "outputTokens": 1, "totalTokens": 2}, "metrics": {"latencyMs": 1}}}


def text_events(text: str):
    yield {"messageStart": {"role": "assistant"}}
    yield {"contentBlockDelta": {"delta": {"text": text}}}
    yield {"contentBlockStop": {}}
    yield {"messageStop": {"stopReason": "end_turn"}}
    yield {"metadata": {"usage": {"inputTokens": 1, "outputTokens": 1, "totalTokens": 2}, "metrics": {"latencyMs": 1}}}


class FakeModel(Model):
    def __init__(self, model_id: str):
        self.config = {"model_id": model_id}

    def update_config(self, **kwargs: Any) -> None:
        self.config.update(kwargs)

    def get_config(self) -> dict[str, Any]:
        return self.config

    async def structured_output(self, output_model, prompt, system_prompt=None, **kwargs):
        raise NotImplementedError
        yield  # pragma: no cover


class FakeOrchestrator(FakeModel):
    SCRIPT = [
        [("inspect_transaction", {}), ("scan_provenance", {})],
        [("run_policy_gate", {}), ("lookup_threat_intel", {"address": NOTICE_ADDR})],
        [("adversarial_review", {})],
        [("submit_verdict", {"decision": "BLOCK", "attack_class": "social_engineering", "operator_summary": "The trading agent was told by a fake Uniswap notice to approve an interim router. That address is unknown and the notice is social engineering, so the approval was blocked."})],
        [("notify_operator", {"severity": "critical", "message": "Blocked USDC approval to fake migration router"})],
    ]

    async def stream(self, messages, tool_specs=None, system_prompt=None, **kwargs):
        turn = sum(1 for m in messages if m["role"] == "assistant")
        events = tool_use_events(self.SCRIPT[turn]) if turn < len(self.SCRIPT) else text_events("Investigation complete.")
        for e in events:
            yield e


class FakeGate2(FakeModel):
    async def stream(self, messages, tool_specs=None, system_prompt=None, **kwargs):
        last = messages[-1]["content"] if messages else []
        if any("toolResult" in block for block in last):
            for e in text_events("Assessment submitted."):
                yield e
            return
        names = [spec["name"] for spec in (tool_specs or [])]
        assert names, "Gate 2 reviewer was not given a structured output tool"
        assessment = {
            "hijack_likelihood": 0.86,
            "attack_class": "social_engineering",
            "reasons": ["Unverified 'migration' notice redirects the approval spender", "Spender is not the official SwapRouter02"],
            "evidence": ["approve and route swaps through the interim router", f"spender={NOTICE_ADDR.lower()}"],
            "recommended_decision": "BLOCK",
        }
        for e in tool_use_events([(names[0], assessment)]):
            yield e


def fake_resolve_model(role: str = "orchestrator"):
    return (FakeGate2("fake-haiku-gate2"), "bedrock") if role == "gate2" else (FakeOrchestrator("fake-sonnet-orchestrator"), "bedrock")


def main() -> int:
    shield.resolve_model = fake_resolve_model
    scenario = get_scenario("A7_SOCIAL_ENGINEERING")
    v = shield.run_agent(scenario["request"])

    print("decision:", v["decision"], "| status:", v["status"], "| mode:", v["mode"], "| engine:", v["engine"])
    print("gate2:", v["gate2"]["mode"], v["gate2"]["attack_class"], v["gate2"]["hijack_likelihood"], v["gate2"]["recommended_decision"], v["gate2"]["model"])
    print("summary:", v["operator_summary"][:120])
    print("notifications:", len(v["notifications"]))
    for step in v["trace"]:
        out = step["output"]
        hint = (json.dumps(out)[:70] if out is not None else "")
        print(f"  [{step['i']:02}] {step['kind']:<6} {step['name']:<24} {step['status']:<5} {hint}")

    tools = [s["name"] for s in v["trace"] if s["kind"] == "tool"]
    lookup = next((s for s in v["trace"] if s["name"] == "lookup_threat_intel"), None)
    checks = {
        "decision BLOCK (escalated past fast-mode QUARANTINE)": v["decision"] == "BLOCK",
        "gate2 ran as llm with structured output": v["gate2"]["mode"] == "llm" and v["gate2"]["attack_class"] == "social_engineering",
        "all 7 tools recorded by TraceHooks": set(tools) == {"inspect_transaction", "scan_provenance", "run_policy_gate", "lookup_threat_intel", "adversarial_review", "submit_verdict", "notify_operator"},
        "model turns recorded": sum(s["kind"] == "model" for s in v["trace"]) >= 5,
        "tool outputs parsed as JSON": isinstance(lookup and lookup["output"], dict),
        "no error steps": all(s["status"] == "ok" for s in v["trace"]),
        "operator summary from submit_verdict": v["operator_summary"].startswith("The trading agent was told"),
        "notification captured": len(v["notifications"]) == 1,
    }

    # Escalation-only: an orchestrator that says ALLOW must not relax a Gate 1 forced BLOCK.
    FakeOrchestrator.SCRIPT[3] = [("submit_verdict", {"decision": "ALLOW", "attack_class": "none", "operator_summary": "Looks fine."})]
    v2 = shield.run_agent(get_scenario("A3_UNLIMITED_APPROVE")["request"])
    checks["LLM ALLOW cannot relax Gate 1 BLOCK (A3)"] = v2["decision"] == "BLOCK"

    from agent import store

    stored = store.get_verdict(v["id"])
    checks[f"verdict persisted ({store.backend_name()})"] = bool(stored) and stored["decision"] == "BLOCK" and len(stored["trace"]) == len(v["trace"])

    failed = [name for name, ok in checks.items() if not ok]
    for name, ok in checks.items():
        print(("PASS " if ok else "FAIL ") + name)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

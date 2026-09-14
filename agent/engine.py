"""Shield evaluation pipeline shared by the fast path, the Strands agent, FastAPI and AgentCore."""

from __future__ import annotations

import json
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any

from . import chain, store
from . import shield_core as core

RANK = {"ALLOW": 0, "QUARANTINE": 1, "BLOCK": 2}


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def strictest(*decisions: str | None) -> str:
    return max((d for d in decisions if d in RANK), key=RANK.__getitem__, default="ALLOW")


class Trace:
    def __init__(self) -> None:
        self.steps: list[dict[str, Any]] = []

    def add(self, kind: str, name: str, input: Any, output: Any, started_at: str, duration_ms: int, status: str = "ok") -> None:
        self.steps.append({"i": len(self.steps), "kind": kind, "name": name, "input": input, "output": output, "started_at": started_at, "duration_ms": duration_ms, "status": status})

    @contextmanager
    def step(self, kind: str, name: str, input: Any = None):
        rec = {"output": None, "status": "ok"}
        started, t = now_iso(), time.perf_counter()
        try:
            yield rec
        except Exception as exc:
            rec["status"], rec["output"] = "error", {"error": str(exc)}
            raise
        finally:
            self.add(kind, name, input, rec["output"], started, int((time.perf_counter() - t) * 1000), rec["status"])


class ShieldContext:
    """Per-request state. Chain evidence and Gate 1 are computed once and shared by every caller."""

    def __init__(self, request: dict[str, Any]) -> None:
        self.request = request
        self.agent_id = request.get("agent_id") or "unknown"
        prov = request.get("provenance") or {}
        self.intent: str = prov.get("user_intent", "")
        self.sources: list[dict[str, Any]] = prov.get("sources") or []
        self.tx: dict[str, Any] = request.get("proposed_tx") or {}
        self.policy: dict[str, Any] = request.get("policy") or {}
        self.trace = Trace()
        self.gate2: dict[str, Any] | None = None
        self.agent_verdict: dict[str, Any] | None = None
        self.notifications: list[dict[str, Any]] = []
        self._evidence: dict[str, Any] | None = None
        self._gate1: dict[str, Any] | None = None

    @property
    def chain_id(self) -> int:
        return int(self.tx.get("chain_id") or 8453)

    def evidence(self) -> dict[str, Any]:
        if self._evidence is None:
            self._evidence = chain.gather_evidence(self.tx)
        return self._evidence

    def gate1(self) -> dict[str, Any]:
        if self._gate1 is None:
            self._gate1 = core.run_gate1(self.agent_id, self.intent, self.sources, self.tx, self.policy, self.evidence())
        return self._gate1

    def provenance_blob(self) -> str:
        return "\n".join([self.intent] + [str(s.get("content", "")) for s in self.sources])

    def cti(self) -> list[dict[str, Any]]:
        ev = self.evidence()
        args = (ev.get("decoded_call") or {}).get("args", {})
        addresses = [self.tx.get("to"), self.tx.get("spender"), args.get("spender"), args.get("to")]
        addresses += core.ADDRESS_RE.findall(self.provenance_blob())
        hits = core.match_cti([a for a in addresses if a], self.provenance_blob())
        ioc = ev.get("onchain_ioc")
        if ioc:
            hits.append({"ioc_id": f"REG-{ioc['ioc_id']}", "title": ioc["uri"] or f"Registry IOC for {ioc['target']}", "category": ioc["category"].lower(), "severity": ioc["severity"], "address": ioc["target"], "source": "onchain"})
        gp = (ev.get("goplus") or {}).get("address")
        if gp and gp["malicious"]:
            hits.append({"ioc_id": "GOPLUS", "title": f"GoPlus flags: {', '.join(gp['flags'])}", "category": "malicious_address", "severity": "critical", "source": "goplus"})
        return hits


def lookup_address(address: str, chain_id: int = 8453) -> dict[str, Any]:
    address = address.lower()
    result: dict[str, Any] = {
        "address": address,
        "label": chain.KNOWN_CONTRACTS.get(address),
        "local_ioc": core.HONEYPOTS.get(address) or core.DRAINERS.get(address),
        "cti": core.match_cti([address], ""),
    }
    if result["label"]:
        # GoPlus tags canonical contracts like WETH as "honeypot related" because scams route through them.
        result["goplus"] = {"skipped": f"{result['label']} is a known canonical contract; association flags do not apply"}
    else:
        try:
            result["goplus"] = chain.goplus_address(chain_id, address)
        except Exception as exc:
            result["goplus_error"] = str(exc)[:120]
    try:
        result["onchain_ioc"] = chain.onchain_ioc(address)
    except Exception as exc:
        result["registry_error"] = str(exc)[:120]
    return result


def run_fast(ctx: ShieldContext, t0: float | None = None) -> dict[str, Any]:
    t0 = t0 or time.perf_counter()
    ctx.trace.add("system", "receive_request", {"agent_id": ctx.agent_id, "intent": ctx.intent, "sources": len(ctx.sources)}, None, now_iso(), 0)
    with ctx.trace.step("gate", "chain_evidence", {"to": ctx.tx.get("to"), "chain_id": ctx.chain_id}) as s:
        s["output"] = ctx.evidence()
    with ctx.trace.step("gate", "gate1_policy_firewall") as s:
        g1 = ctx.gate1()
        s["output"] = {"forced_block": g1["forced_block"], "needs_review": g1["novel_quarantine"], "failing": [c["id"] for c in g1["checks"] if not c["passed"]]}
    with ctx.trace.step("gate", "cti_lookup") as s:
        s["output"] = ctx.cti()
    with ctx.trace.step("gate", "gate2_heuristic") as s:
        ctx.gate2 = core.run_gate2_heuristic(ctx.intent, ctx.sources, ctx.tx, ctx.evidence(), ctx.gate1())
        s["output"] = ctx.gate2
    return finalize(ctx, "fast", t0)


def _template_summary(decision: str, ctx: ShieldContext, gate1: dict[str, Any]) -> str:
    failing = [c for c in gate1["checks"] if not c["passed"]]
    if decision == "ALLOW":
        return f"Cleared: {ctx.agent_id} may sign. Intent, provenance and on-chain evidence are consistent."
    top = "; ".join(c["detail"] for c in failing[:2]) or "; ".join((ctx.gate2 or {}).get("reasons", [])[:2])
    if decision == "BLOCK":
        return f"Blocked before signing. {top}."
    return f"Held for your review. {top}. Approve to release the transaction or deny to discard it."


def finalize(ctx: ShieldContext, mode: str, t0: float, summary: str | None = None) -> dict[str, Any]:
    gate1 = ctx.gate1()
    gate2 = ctx.gate2 or core.run_gate2_heuristic(ctx.intent, ctx.sources, ctx.tx, ctx.evidence(), ctx.gate1())
    if gate2.get("attack_class", "none") == "none":
        gate2["attack_class"] = core.infer_attack_class(gate1)

    # Deterministic floor; LLM reviewers can only escalate it.
    decision = strictest(
        core.decide(gate1, gate2),
        gate2.get("recommended_decision"),
        (ctx.agent_verdict or {}).get("decision"),
    )
    cti = ctx.cti()
    failing = [c for c in gate1["checks"] if not c["passed"]]
    explanations = [
        f"Gate 1 {'FAIL' if gate1['forced_block'] else 'PASS'}: {len(failing)} failing check(s)",
        *[f"{c['id']}: {c['detail']}" for c in failing[:4]],
        f"Gate 2 {gate2['mode']}: hijack={gate2['hijack_likelihood']:.2f} ({gate2['model']})",
        *gate2["reasons"][:3],
        f"CTI matches: {', '.join(h['ioc_id'] for h in cti)}" if cti else "CTI: no IOC matches",
    ]
    ev = ctx.evidence()
    verdict: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "ts": now_iso(),
        "agent_id": ctx.agent_id,
        "scenario_id": ctx.request.get("scenario_id"),
        "decision": decision,
        "status": "pending_review" if decision == "QUARANTINE" else "final",
        "mode": mode,
        "gate1": gate1,
        "gate2": gate2,
        "chain": {k: ev.get(k) for k in ("chain_id", "network", "to_is_contract", "code_size", "decoded_call", "simulation", "goplus", "onchain_ioc", "errors")},
        "cti_hits": cti,
        "explanations": explanations,
        "operator_summary": summary or _template_summary(decision, ctx, gate1),
        "notifications": ctx.notifications,
        "trace": json.loads(json.dumps(ctx.trace.steps, default=str)),
        "review": None,
        "proposed_tx": ctx.tx,
        "latency_ms": int((time.perf_counter() - t0) * 1000),
        "engine": "strands-agent" if mode == "agent" else "deterministic",
    }
    verdict["event_doc"] = core.build_event_doc(verdict)
    store.save_verdict(verdict)
    return verdict


def evaluate(request: dict[str, Any], mode: str = "fast") -> dict[str, Any]:
    if mode == "agent":
        from .agentshield import run_agent

        return run_agent(request)
    return run_fast(ShieldContext(request))


def review(verdict_id: str, action: str, note: str = "", operator: str = "operator") -> dict[str, Any]:
    v = store.get_verdict(verdict_id)
    if not v:
        return {"error": f"verdict {verdict_id} not found"}
    action = action.upper()
    if action not in {"APPROVE", "DENY"}:
        return {"error": "action must be APPROVE or DENY"}
    if v["status"] != "pending_review":
        return {"error": f"verdict is {v['status']}, not pending_review", "verdict": v}
    v["status"] = "approved" if action == "APPROVE" else "denied"
    v["review"] = {"action": action, "note": note, "operator": operator, "ts": now_iso()}
    v["event_doc"] = core.build_event_doc(v)
    store.save_verdict(v, with_trace=False)
    return v

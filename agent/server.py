"""FastAPI bridge: Strands AgentShield ↔ Flight Recorder UI."""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import shield_core as core
from .agentshield import invoke_for_payload, invoke_strands
from .model import resolve_model
from .scenarios import SCENARIOS, get_scenario

load_dotenv()

app = FastAPI(
    title="AgentShield Strands API",
    description="Professional Agents track — pre-trade safety oracle on Strands Agents SDK",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ShieldBody(BaseModel):
    agent_id: str
    proposed_tx: dict[str, Any]
    provenance: dict[str, Any]
    policy: dict[str, Any] | None = None
    scenario_id: str | None = None
    use_strands: bool = Field(
        default=False,
        description="If true, run the full Strands agent loop (requires model credentials).",
    )


class PromptBody(BaseModel):
    prompt: str


def _provider() -> str:
    _, provider = resolve_model()
    return provider


@app.get("/health")
def health():
    provider = _provider()
    return {
        "ok": True,
        "service": "agentshield-strands",
        "model_provider": provider,
        "strands_ready": provider != "none",
        "track": "Professional Agents",
        "hackathon": "Agents for Humans",
    }


@app.get("/scenarios")
def scenarios():
    return {
        "attacks": [
            {
                "id": s["id"],
                "name": s["name"],
                "family": s["family"],
                "blurb": s["blurb"],
                "expected": s["expected"],
            }
            for s in SCENARIOS
        ]
    }


@app.post("/shield")
def shield(body: ShieldBody):
    payload = body.model_dump()
    if body.use_strands:
        strands = invoke_for_payload(payload)
        # Still return deterministic verdict for UI consistency
        verdict = core.evaluate_shield(payload)
        return {"verdict": verdict, "strands": strands}
    verdict = core.evaluate_shield(payload)
    return {"verdict": verdict, "strands": None}


@app.post("/demo/attack")
def demo_attack(body: dict[str, Any]):
    if body.get("all"):
        results = []
        for s in SCENARIOS:
            verdict = core.evaluate_shield(s["request"])
            results.append(
                {
                    "scenario": {
                        "id": s["id"],
                        "name": s["name"],
                        "family": s["family"],
                        "blurb": s["blurb"],
                        "expected": s["expected"],
                    },
                    "verdict": verdict,
                    "matched_expected": verdict["decision"] == s["expected"],
                }
            )
        return {"results": results}

    sid = body.get("id")
    s = get_scenario(sid) if sid else None
    if not s:
        return {"error": "unknown attack id"}
    use_strands = bool(body.get("use_strands"))
    strands = invoke_for_payload(s["request"]) if use_strands else None
    verdict = core.evaluate_shield(s["request"])
    return {
        "scenario": {
            "id": s["id"],
            "name": s["name"],
            "family": s["family"],
            "blurb": s["blurb"],
            "expected": s["expected"],
        },
        "verdict": verdict,
        "matched_expected": verdict["decision"] == s["expected"],
        "strands": strands,
    }


@app.post("/agent/invoke")
def agent_invoke(body: PromptBody):
    return invoke_strands(body.prompt)


@app.get("/telemetry")
def telemetry(view: str = "overview"):
    if view == "cti":
        return {"feed": core.CTI_FEED}
    if view == "verdicts":
        return {"verdicts": core.list_verdicts(80)}
    if view == "elastic":
        return {"documents": [v["elastic_doc"] for v in core.list_verdicts(40)]}
    return {
        "stats": core.stats(),
        "latest": core.list_verdicts(12),
        "cti_count": len(core.CTI_FEED),
        "model_provider": _provider(),
    }


def main():
    import uvicorn

    port = int(os.getenv("AGENT_PORT", "8000"))
    uvicorn.run("agent.server:app", host="0.0.0.0", port=port, reload=False)


if __name__ == "__main__":
    main()

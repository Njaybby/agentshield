from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, TypedDict

Decision = Literal["ALLOW", "BLOCK", "QUARANTINE"]
Mode = Literal["fast", "agent"]
Status = Literal["final", "pending_review", "approved", "denied"]


class ProvenanceSource(TypedDict, total=False):
    type: str
    content: str
    url: str


class ProposedTx(TypedDict, total=False):
    to: str
    value_wei: str
    data: str
    chain_id: int
    method: str
    token_symbol: str
    token_address: str
    spender: str
    amount_human: str


class Provenance(TypedDict):
    user_intent: str
    sources: list[ProvenanceSource]


class ShieldRequest(TypedDict, total=False):
    agent_id: str
    scenario_id: str | None
    policy: dict[str, Any] | None
    provenance: Provenance
    proposed_tx: ProposedTx


DECISIONS = ("ALLOW", "BLOCK", "QUARANTINE")


@dataclass
class Verdict:
    id: str
    decision: Decision
    status: Status
    mode: str
    operator_summary: str
    latency_ms: int
    raw: dict[str, Any] = field(repr=False)

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Verdict:
        return cls(
            id=str(d.get("id", "")),
            decision=d["decision"],
            status=d.get("status", "final"),
            mode=d.get("mode", "fast"),
            operator_summary=d.get("operator_summary", ""),
            latency_ms=int(d.get("latency_ms") or 0),
            raw=d,
        )

    @property
    def allowed(self) -> bool:
        return self.decision == "ALLOW" or self.status == "approved"

    @property
    def pending(self) -> bool:
        return self.status == "pending_review"

    @property
    def checks(self) -> list[dict[str, Any]]:
        return (self.raw.get("gate1") or {}).get("checks", [])

    @property
    def failing_checks(self) -> list[dict[str, Any]]:
        return [c for c in self.checks if not c.get("passed")]

    def __getitem__(self, key: str) -> Any:
        return self.raw[key]

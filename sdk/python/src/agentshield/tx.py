from __future__ import annotations

from typing import Any, Iterable

from .types import ProvenanceSource, ShieldRequest


def _hex(data: Any) -> str | None:
    if data is None or data == b"" or data == "":
        return None
    if isinstance(data, (bytes, bytearray)):
        return "0x" + bytes(data).hex()
    if hasattr(data, "hex") and not isinstance(data, str):  # HexBytes
        h = data.hex()
        return h if h.startswith("0x") else "0x" + h
    s = str(data)
    return s if s.startswith("0x") else "0x" + s


def _wei(value: Any) -> str:
    if value is None:
        return "0"
    if isinstance(value, int):
        return str(value)
    s = str(value).strip()
    return str(int(s, 16)) if s.lower().startswith("0x") else str(int(s))


def _sources(sources: Iterable[str | ProvenanceSource] | None) -> list[ProvenanceSource]:
    out: list[ProvenanceSource] = []
    for s in sources or []:
        out.append({"type": "text", "content": s} if isinstance(s, str) else dict(s))  # type: ignore[arg-type]
    return out


def request_from_tx(
    tx: dict[str, Any],
    intent: str,
    sources: Iterable[str | ProvenanceSource] | None = None,
    agent_id: str = "agent",
    **tx_fields: Any,
) -> ShieldRequest:
    """Build a ShieldRequest from a web3.py style tx dict (to, value, data or input, chainId).

    Extra keyword args (method, token_symbol, spender, amount_human, ...) go into proposed_tx.
    """
    if not intent:
        raise ValueError("intent is required: what the human asked the agent to do")
    chain_id = tx.get("chainId", tx.get("chain_id"))
    if chain_id is None:
        raise ValueError("tx needs chainId")
    proposed: dict[str, Any] = {
        "to": str(tx["to"]),
        "value_wei": _wei(tx.get("value")),
        "chain_id": int(chain_id),
    }
    data = _hex(tx.get("data", tx.get("input")))
    if data:
        proposed["data"] = data
    proposed.update({k: v for k, v in tx_fields.items() if v is not None})
    return {
        "agent_id": agent_id,
        "provenance": {"user_intent": intent, "sources": _sources(sources)},
        "proposed_tx": proposed,  # type: ignore[typeddict-item]
    }

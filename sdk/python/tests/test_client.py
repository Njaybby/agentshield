import json

import httpx
import pytest

from agentshield import Blocked, Denied, ReviewTimeout, Shield, ShieldError, ShieldUnavailable, request_from_tx

REQ = {
    "agent_id": "desk-01",
    "provenance": {"user_intent": "Swap 0.05 ETH to USDC", "sources": []},
    "proposed_tx": {"to": "0x2626664c2603336E57B271c5C0b26F421741e481", "value_wei": "50000000000000000", "chain_id": 8453},
}


def verdict(decision, status=None, vid="v1"):
    return {
        "id": vid,
        "decision": decision,
        "status": status or ("pending_review" if decision == "QUARANTINE" else "final"),
        "mode": "fast",
        "operator_summary": f"{decision} summary",
        "latency_ms": 12,
        "gate1": {"checks": [{"id": "P1", "passed": decision != "BLOCK"}]},
    }


def make_shield(handler, **kw):
    shield = Shield("https://shield.test", transport=httpx.MockTransport(handler), poll_every=0, **kw)
    shield._sleep = lambda s: None
    return shield


def rpc_handler(first, polls=()):
    polls = list(polls)
    seen = []

    def handler(request):
        body = json.loads(request.content)
        seen.append(body)
        assert request.url.path == "/api/rpc"
        if body["action"] == "shield":
            return httpx.Response(200, json=first)
        return httpx.Response(200, json=polls.pop(0))

    handler.seen = seen
    return handler


def test_allow_signs():
    h = rpc_handler(verdict("ALLOW"))
    signed = []
    out = make_shield(h).guard(REQ, lambda tx: signed.append(tx) or "0xhash")
    assert out == "0xhash"
    assert signed == [REQ["proposed_tx"]]
    assert h.seen[0] == {"action": "shield", "mode": "fast", "request": REQ}


def test_block_raises_and_does_not_sign():
    signed = []
    with pytest.raises(Blocked) as e:
        make_shield(rpc_handler(verdict("BLOCK"))).guard(REQ, signed.append)
    assert signed == []
    assert e.value.verdict.decision == "BLOCK"
    assert e.value.verdict.failing_checks == [{"id": "P1", "passed": False}]


def test_quarantine_approved_signs_after_polling():
    h = rpc_handler(verdict("QUARANTINE"), [verdict("QUARANTINE"), verdict("QUARANTINE", "approved")])
    assert make_shield(h).guard(REQ, lambda tx: "signed") == "signed"
    assert [b["action"] for b in h.seen] == ["shield", "telemetry", "telemetry"]
    assert h.seen[1] == {"action": "telemetry", "view": "verdict", "id": "v1"}


def test_quarantine_denied_raises():
    signed = []
    h = rpc_handler(verdict("QUARANTINE"), [verdict("QUARANTINE", "denied")])
    with pytest.raises(Denied):
        make_shield(h).guard(REQ, signed.append)
    assert signed == []


def test_quarantine_timeout_raises():
    h = rpc_handler(verdict("QUARANTINE"), [verdict("QUARANTINE")] * 3)
    with pytest.raises(ReviewTimeout):
        make_shield(h, max_wait=0).guard(REQ, lambda tx: "signed")


def test_unreachable_fails_closed():
    def down(request):
        raise httpx.ConnectError("connection refused")

    signed = []
    with pytest.raises(ShieldUnavailable):
        make_shield(down).guard(REQ, signed.append)
    assert signed == []


def test_unreachable_fail_open_signs_when_opted_in():
    def down(request):
        raise httpx.ConnectError("connection refused")

    assert make_shield(down, fail_closed=False).guard(REQ, lambda tx: "signed") == "signed"


def test_rate_limit_and_offline_are_unavailable():
    for status, body in [(429, {"error": "rate limited"}), (503, {"error": "agent down", "offline": True})]:
        with pytest.raises(ShieldUnavailable):
            make_shield(lambda r, s=status, b=body: httpx.Response(s, json=b)).check(REQ)


def test_bad_request_never_fails_open():
    h = lambda r: httpx.Response(200, json={"error": "body.request with proposed_tx and provenance is required"})
    with pytest.raises(ShieldError) as e:
        make_shield(h, fail_closed=False).guard(REQ, lambda tx: "signed")
    assert not isinstance(e.value, ShieldUnavailable)


def test_non_json_is_unavailable():
    with pytest.raises(ShieldUnavailable):
        make_shield(lambda r: httpx.Response(502, text="<html>bad gateway</html>")).check(REQ)


def test_request_from_tx():
    req = request_from_tx(
        {"to": "0xabc", "value": "0x0de0b6b3a7640000", "input": b"\x09\x5e\xa7\xb3", "chainId": 8453},
        intent="Approve the router",
        sources=["Router recommends approve", {"type": "web", "url": "https://x", "content": "docs"}],
        agent_id="bot-7",
        method="approve",
    )
    assert req == {
        "agent_id": "bot-7",
        "provenance": {
            "user_intent": "Approve the router",
            "sources": [{"type": "text", "content": "Router recommends approve"}, {"type": "web", "url": "https://x", "content": "docs"}],
        },
        "proposed_tx": {"to": "0xabc", "value_wei": "1000000000000000000", "chain_id": 8453, "data": "0x095ea7b3", "method": "approve"},
    }
    with pytest.raises(ValueError):
        request_from_tx({"to": "0xabc"}, intent="x")


def test_protect_decorator():
    h = rpc_handler(verdict("ALLOW"))
    shield = make_shield(h, agent_id="bot-1")
    sent = []

    @shield.protect(chain_id=8453)
    def send(tx, nonce=0):
        sent.append((tx, nonce))
        return "0xhash"

    tx = {"to": "0xabc", "value": 5}
    assert send(tx, nonce=3, intent="Pay the invoice") == "0xhash"
    assert sent == [(tx, 3)]
    req = h.seen[0]["request"]
    assert req["agent_id"] == "bot-1" and req["proposed_tx"]["chain_id"] == 8453

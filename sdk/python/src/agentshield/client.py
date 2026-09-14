from __future__ import annotations

import functools
import logging
import time
from typing import Any, Callable, Iterable, TypeVar

import httpx

from .errors import Blocked, Denied, ReviewTimeout, ShieldError, ShieldUnavailable
from .tx import request_from_tx
from .types import DECISIONS, Mode, ProvenanceSource, ShieldRequest, Verdict

DEFAULT_BASE_URL = "https://agentshield-lyart.vercel.app"

log = logging.getLogger("agentshield")
T = TypeVar("T")


class Shield:
    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        mode: Mode = "fast",
        timeout: float = 90.0,
        fail_closed: bool = True,
        agent_id: str = "agent",
        poll_every: float = 5.0,
        max_wait: float = 1800.0,
        transport: httpx.BaseTransport | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.mode = mode
        self.fail_closed = fail_closed
        self.agent_id = agent_id
        self.poll_every = poll_every
        self.max_wait = max_wait
        self._http = httpx.Client(timeout=timeout, transport=transport)
        self._sleep = time.sleep

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> Shield:
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    def _rpc(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            r = self._http.post(f"{self.base_url}/api/rpc", json=payload)
        except httpx.HTTPError as e:
            raise ShieldUnavailable(f"shield unreachable: {e}") from e
        try:
            body = r.json()
        except ValueError as e:
            raise ShieldUnavailable(f"shield returned non-JSON (HTTP {r.status_code})") from e
        err = body.get("error") if isinstance(body, dict) else "unexpected response"
        if err:
            # Outages and rate limits are unavailability. Anything else is a bad request.
            if r.status_code >= 500 or r.status_code == 429 or body.get("offline"):
                raise ShieldUnavailable(str(err))
            raise ShieldError(str(err))
        if r.status_code >= 400:
            raise ShieldUnavailable(f"HTTP {r.status_code}")
        return body

    @staticmethod
    def _verdict(body: dict[str, Any]) -> Verdict:
        if body.get("decision") not in DECISIONS:
            raise ShieldUnavailable("response has no decision")
        return Verdict.from_dict(body)

    def check(self, request: ShieldRequest, mode: Mode | None = None) -> Verdict:
        return self._verdict(self._rpc({"action": "shield", "mode": mode or self.mode, "request": request}))

    def get_verdict(self, verdict_id: str) -> Verdict:
        return self._verdict(self._rpc({"action": "telemetry", "view": "verdict", "id": verdict_id}))

    def wait_for_review(self, verdict_id: str, poll_every: float | None = None, max_wait: float | None = None) -> Verdict:
        poll_every = self.poll_every if poll_every is None else poll_every
        max_wait = self.max_wait if max_wait is None else max_wait
        start = time.monotonic()
        while True:
            v = self.get_verdict(verdict_id)
            if not v.pending:
                return v
            waited = time.monotonic() - start
            if waited >= max_wait:
                raise ReviewTimeout(v, waited)
            self._sleep(poll_every)

    def guard(self, request: ShieldRequest, sign_fn: Callable[[Any], T], mode: Mode | None = None) -> T:
        """Sign only if AgentShield allows it. Raises Blocked, Denied, ReviewTimeout or ShieldUnavailable otherwise."""
        tx = request["proposed_tx"]
        try:
            v = self.check(request, mode)
        except ShieldUnavailable:
            if self.fail_closed:
                raise
            log.warning("agentshield unavailable, fail_closed=False: signing without a verdict")
            return sign_fn(tx)

        if v.decision == "BLOCK":
            raise Blocked(v)
        if v.decision == "QUARANTINE" and v.pending:
            log.info("agentshield: %s held for operator review", v.id)
            v = self.wait_for_review(v.id)
        if v.status == "denied":
            raise Denied(v)
        if v.allowed:
            return sign_fn(tx)
        raise Blocked(v)

    def protect(
        self,
        fn: Callable[..., T] | None = None,
        *,
        mode: Mode | None = None,
        chain_id: int | None = None,
    ) -> Any:
        """Decorate a signer that takes a web3.py style tx dict.

        Callers pass intent= (required), and optionally sources= and agent_id=.
        """

        def wrap(sign: Callable[..., T]) -> Callable[..., T]:
            @functools.wraps(sign)
            def inner(
                tx: dict[str, Any],
                *args: Any,
                intent: str,
                sources: Iterable[str | ProvenanceSource] | None = None,
                agent_id: str | None = None,
                **kwargs: Any,
            ) -> T:
                tx_in = tx if chain_id is None or "chainId" in tx else {**tx, "chainId": chain_id}
                req = request_from_tx(tx_in, intent=intent, sources=sources, agent_id=agent_id or self.agent_id)
                return self.guard(req, lambda _ptx: sign(tx, *args, **kwargs), mode=mode)

            return inner

        return wrap(fn) if fn is not None else wrap


def guard(request: ShieldRequest, sign_fn: Callable[[Any], T], **shield_kwargs: Any) -> T:
    with Shield(**shield_kwargs) as shield:
        return shield.guard(request, sign_fn)

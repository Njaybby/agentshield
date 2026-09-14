from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .types import Verdict


class ShieldError(Exception):
    """Base error. Anything raised by guard() means the transaction was not signed."""


class ShieldUnavailable(ShieldError):
    """The shield could not be reached or returned no usable verdict."""


class Blocked(ShieldError):
    def __init__(self, verdict: Verdict):
        self.verdict = verdict
        super().__init__(f"{verdict.decision} {verdict.id}: {verdict.operator_summary}")


class Denied(Blocked):
    """An operator denied a quarantined transaction."""


class ReviewTimeout(ShieldError):
    def __init__(self, verdict: Verdict, waited: float):
        self.verdict = verdict
        super().__init__(f"no operator decision on {verdict.id} after {waited:.0f}s")

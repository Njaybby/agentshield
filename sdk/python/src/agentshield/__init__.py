"""AgentShield client. Check a transaction before your agent signs it."""

from .client import DEFAULT_BASE_URL, Shield, guard
from .errors import Blocked, Denied, ReviewTimeout, ShieldError, ShieldUnavailable
from .tx import request_from_tx
from .types import Verdict

__all__ = [
    "DEFAULT_BASE_URL",
    "Blocked",
    "Denied",
    "ReviewTimeout",
    "Shield",
    "ShieldError",
    "ShieldUnavailable",
    "Verdict",
    "guard",
    "request_from_tx",
]

__version__ = "0.1.0"

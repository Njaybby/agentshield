"""Live on-chain evidence for Gate 1: Base RPC (code, calldata decode, eth_call sim), GoPlus, on-chain IOC registry."""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import httpx
from eth_abi import decode as abi_decode

MAX_UINT256 = 2**256 - 1
TIMEOUT = float(os.getenv("CHAIN_TIMEOUT_S", "4"))

NETWORKS = {
    8453: {"name": "base", "rpc_env": "BASE_RPC_URL", "rpc": "https://mainnet.base.org"},
    84532: {"name": "base-sepolia", "rpc_env": "BASE_SEPOLIA_RPC_URL", "rpc": "https://sepolia.base.org"},
}

# Well-known Base mainnet contracts (lowercase). Used as the router/token allowlist.
KNOWN_CONTRACTS = {
    "0x2626664c2603336e57b271c5c0b26f421741e481": "Uniswap V3 SwapRouter02",
    "0x6ff5693b99212da76ad316178a184ab56d299b43": "Uniswap Universal Router",
    "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43": "Aerodrome Router",
    "0x000000000022d473030f116ddee9f6b43ac78ba3": "Permit2",
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
    "0x4200000000000000000000000000000000000006": "WETH",
}

SELECTORS: dict[str, tuple[str, list[str], list[str]]] = {
    "0x095ea7b3": ("approve(address,uint256)", ["address", "uint256"], ["spender", "amount"]),
    "0xa9059cbb": ("transfer(address,uint256)", ["address", "uint256"], ["to", "amount"]),
    "0x23b872dd": ("transferFrom(address,address,uint256)", ["address", "address", "uint256"], ["from", "to", "amount"]),
    "0x39509351": ("increaseAllowance(address,uint256)", ["address", "uint256"], ["spender", "amount"]),
    "0xa22cb465": ("setApprovalForAll(address,bool)", ["address", "bool"], ["operator", "approved"]),
    "0x7ff36ab5": ("swapExactETHForTokens(uint256,address[],address,uint256)", ["uint256", "address[]", "address", "uint256"], ["amountOutMin", "path", "to", "deadline"]),
    "0x04e45aaf": ("exactInputSingle((address,address,uint24,address,uint256,uint256,uint160))", ["address", "address", "uint24", "address", "uint256", "uint256", "uint160"], ["tokenIn", "tokenOut", "fee", "recipient", "amountIn", "amountOutMinimum", "sqrtPriceLimitX96"]),
    "0x414bf389": ("exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))", [], []),
    "0x3593564c": ("execute(bytes,bytes[],uint256)", [], []),
    "0xac9650d8": ("multicall(bytes[])", [], []),
    "0xd0e30db0": ("deposit()", [], []),
    "0xb6b55f25": ("deposit(uint256)", ["uint256"], ["amount"]),
}

_cache: dict[str, tuple[float, Any]] = {}


def _cached(key: str, ttl: float, fn):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    val = fn()
    _cache[key] = (time.time(), val)
    return val


def _rpc_url(chain_id: int) -> str | None:
    net = NETWORKS.get(chain_id)
    if not net:
        return None
    return os.getenv(net["rpc_env"], net["rpc"])


def _rpc(chain_id: int, method: str, params: list[Any]) -> Any:
    url = _rpc_url(chain_id)
    if not url:
        raise RuntimeError(f"unsupported chain {chain_id}")
    r = httpx.post(url, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=TIMEOUT)
    body = r.json()
    if "error" in body:
        raise RuntimeError(json.dumps(body["error"]))
    return body["result"]


def rpc_healthy(chain_id: int = 8453) -> bool:
    try:
        return bool(_rpc(chain_id, "eth_blockNumber", []))
    except Exception:
        return False


def decode_call(data: str | None) -> dict[str, Any] | None:
    if not data or len(data) < 10:
        return None
    selector = data[:10].lower()
    known = SELECTORS.get(selector)
    if not known:
        return {"selector": selector, "signature": "unknown", "args": {}}
    signature, types, names = known
    args: dict[str, str] = {}
    if types:
        try:
            values = abi_decode(types, bytes.fromhex(data[10:]))
            for name, value in zip(names, values):
                if isinstance(value, int) and value == MAX_UINT256:
                    args[name] = "MAX_UINT256"
                elif isinstance(value, (list, tuple)):
                    args[name] = ",".join(str(v) for v in value)
                else:
                    args[name] = str(value).lower() if isinstance(value, str) else str(value)
        except Exception as exc:
            args["_decode_error"] = str(exc)[:120]
    return {"selector": selector, "signature": signature, "args": args}


def _to_hex_value(value_wei: str | int | None) -> str:
    if value_wei is None or value_wei == "":
        return "0x0"
    if isinstance(value_wei, str) and value_wei.startswith("0x"):
        return value_wei
    return hex(int(value_wei))


def parse_wei(value_wei: str | int | None) -> int:
    if value_wei is None or value_wei == "":
        return 0
    if isinstance(value_wei, str) and value_wei.lower().startswith("0x"):
        return int(value_wei, 16)
    return int(value_wei)


def simulate(chain_id: int, tx: dict[str, Any]) -> dict[str, Any]:
    # Simulate from a synthetic sender with a large balance via state override.
    sender = "0x00000000000000000000000000000000a9e75e1d"
    call = {"from": sender, "to": tx["to"], "data": tx.get("data") or "0x", "value": _to_hex_value(tx.get("value_wei"))}
    override = {sender: {"balance": hex(10**24)}}
    try:
        _rpc(chain_id, "eth_call", [call, "latest", override])
        return {"ok": True, "revert_reason": None}
    except Exception as exc:
        return {"ok": False, "revert_reason": str(exc)[:200]}


def goplus_token(chain_id: int, token: str) -> dict[str, Any] | None:
    def fetch():
        r = httpx.get(
            f"https://api.gopluslabs.io/api/v1/token_security/{chain_id}",
            params={"contract_addresses": token},
            timeout=TIMEOUT + 2,
        )
        data = (r.json().get("result") or {}).get(token.lower())
        if not data:
            return None
        risky = ["is_honeypot", "cannot_sell_all", "is_blacklisted", "hidden_owner", "owner_change_balance", "selfdestruct", "is_airdrop_scam", "trading_cooldown"]
        return {
            "is_honeypot": data.get("is_honeypot") == "1",
            "buy_tax": data.get("buy_tax") or "0",
            "sell_tax": data.get("sell_tax") or "0",
            "flags": [k for k in risky if data.get(k) == "1"],
            "name": data.get("token_name"),
            "symbol": data.get("token_symbol"),
        }

    return _cached(f"gp-token:{chain_id}:{token.lower()}", 600, fetch)


def goplus_address(chain_id: int, address: str) -> dict[str, Any] | None:
    def fetch():
        r = httpx.get(
            f"https://api.gopluslabs.io/api/v1/address_security/{address}",
            params={"chain_id": chain_id},
            timeout=TIMEOUT + 2,
        )
        data = r.json().get("result") or {}
        ignore = {"contract_address", "data_source", "number_of_malicious_contracts_created"}
        flags = [k for k, v in data.items() if k not in ignore and v == "1"]
        return {"malicious": bool(flags), "flags": flags}

    return _cached(f"gp-addr:{chain_id}:{address.lower()}", 600, fetch)


# --- On-chain CTI registry (ReputationRegistry on Base Sepolia) ---

CATEGORIES = ["HONEYPOT", "DRAINER", "PROMPT_INJECTION", "PHISHING", "SYBIL"]
SEVERITIES = ["info", "medium", "high", "critical"]


def registry_address() -> str | None:
    return os.getenv("REPUTATION_REGISTRY_ADDRESS") or None


def _registry_abi() -> list[dict[str, Any]] | None:
    path = Path(__file__).parent / "abi" / "ReputationRegistry.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def onchain_ioc(target: str) -> dict[str, Any] | None:
    """Look up an IOC for `target` in the on-chain registry via getIOCByTarget(address)."""
    reg = registry_address()
    abi = _registry_abi()
    if not reg or not abi or not target:
        return None
    fn = next((f for f in abi if f.get("type") == "function" and f.get("name") == "getIOCByTarget"), None)
    if not fn:
        return None

    def fetch():
        from eth_utils import function_abi_to_4byte_selector

        selector = function_abi_to_4byte_selector(fn)
        data = selector + target.lower().replace("0x", "").rjust(64, "0")
        raw = _rpc(84532, "eth_call", [{"to": reg, "data": data}, "latest"])
        out_types = [o["type"] for o in fn["outputs"]]
        out_names = [o["name"] for o in fn["outputs"]]
        values = dict(zip(out_names, abi_decode(out_types, bytes.fromhex(raw[2:]))))
        if not values.get("exists"):
            return None
        return {
            "ioc_id": int(values.get("iocId", 0)),
            "target": target.lower(),
            "category": CATEGORIES[int(values["category"])] if int(values["category"]) < len(CATEGORIES) else str(values["category"]),
            "severity": SEVERITIES[int(values["severity"])] if int(values["severity"]) < len(SEVERITIES) else str(values["severity"]),
            "confidence": int(values.get("confidence", 0)),
            "publisher": str(values.get("publisher", "")).lower(),
            "uri": str(values.get("uri", "")),
        }

    return _cached(f"ioc:{target.lower()}", 120, fetch)


def gather_evidence(tx: dict[str, Any]) -> dict[str, Any]:
    """Collect all chain evidence for a proposed tx. Never raises; errors are reported."""
    chain_id = int(tx.get("chain_id") or 8453)
    to = str(tx.get("to") or "").lower()
    errors: list[str] = []
    ev: dict[str, Any] = {
        "chain_id": chain_id,
        "network": NETWORKS.get(chain_id, {}).get("name", f"chain-{chain_id}"),
        "to_is_contract": None,
        "code_size": None,
        "to_label": KNOWN_CONTRACTS.get(to),
        "decoded_call": decode_call(tx.get("data")),
        "simulation": None,
        "goplus": None,
        "onchain_ioc": None,
        "errors": errors,
    }
    if os.getenv("CHAIN_EVIDENCE", "1") == "0" or chain_id not in NETWORKS or not to:
        return ev

    decoded_sig = (ev["decoded_call"] or {}).get("signature", "")
    spender = (ev["decoded_call"] or {}).get("args", {}).get("spender") or tx.get("spender")
    token = tx.get("token_address") or (to if decoded_sig.startswith(("approve", "transfer", "increaseAllowance")) else None)
    jobs = {
        "code": lambda: _cached(f"code:{chain_id}:{to}", 300, lambda: _rpc(chain_id, "eth_getCode", [to, "latest"])),
        "simulation": (lambda: simulate(chain_id, tx)) if tx.get("data") else None,
        "goplus_token": (lambda: goplus_token(chain_id, token)) if token else None,
        "goplus_address": lambda: goplus_address(chain_id, spender or to),
        "onchain_ioc": lambda: onchain_ioc(to) or (onchain_ioc(spender) if spender else None),
    }
    results: dict[str, Any] = {}
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {name: pool.submit(fn) for name, fn in jobs.items() if fn}
        for name, fut in futures.items():
            try:
                results[name] = fut.result(timeout=TIMEOUT + 4)
            except Exception as exc:
                errors.append(f"{name}: {str(exc)[:120]}")

    if "code" in results:
        ev["code_size"] = max(0, (len(results["code"]) - 2) // 2)
        ev["to_is_contract"] = ev["code_size"] > 0
    # eth_call against an address with no code always "succeeds", so it proves nothing.
    ev["simulation"] = results.get("simulation") if ev["to_is_contract"] is not False else None
    goplus = {k: v for k, v in (("token", results.get("goplus_token")), ("address", results.get("goplus_address"))) if v}
    ev["goplus"] = goplus or None
    ev["onchain_ioc"] = results.get("onchain_ioc")
    return ev

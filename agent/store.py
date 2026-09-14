"""Flight Recorder persistence: ClickHouse (system of record) with an in-memory fallback.

AgentCore Runtime sessions don't share memory, so verdicts, traces and operator reviews
live in ClickHouse. Reviews are appended as higher `version` rows (ReplacingMergeTree).
"""

from __future__ import annotations

import json
import os
import statistics
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

_client = None
_client_failed_at = 0.0
_memory: dict[str, dict[str, Any]] = {}

DDL = [
    """CREATE TABLE IF NOT EXISTS verdicts (
        id String,
        ts DateTime64(3, 'UTC'),
        agent_id LowCardinality(String),
        scenario_id Nullable(String),
        decision LowCardinality(String),
        status LowCardinality(String),
        mode LowCardinality(String),
        attack_class LowCardinality(String),
        hijack_likelihood Float32,
        latency_ms UInt32,
        failing_checks Array(String),
        to_address String,
        value_wei String,
        chain_id UInt32,
        doc String,
        version UInt64
    ) ENGINE = ReplacingMergeTree(version) ORDER BY id""",
    """CREATE TABLE IF NOT EXISTS trace_steps (
        verdict_id String,
        ts DateTime64(3, 'UTC'),
        i UInt16,
        kind LowCardinality(String),
        name LowCardinality(String),
        duration_ms UInt32,
        status LowCardinality(String)
    ) ENGINE = MergeTree ORDER BY (ts, verdict_id, i)""",
]


def _ch():
    global _client, _client_failed_at
    if _client is not None:
        return _client
    url = os.getenv("CLICKHOUSE_URL")
    if not url or time.time() - _client_failed_at < 30:
        return None
    try:
        import clickhouse_connect

        client = clickhouse_connect.get_client(
            dsn=None,
            interface="https" if url.startswith("https") else "http",
            host=url.split("://", 1)[-1].split(":")[0].rstrip("/"),
            port=int(url.rsplit(":", 1)[-1].rstrip("/")) if url.count(":") == 2 else (8443 if url.startswith("https") else 8123),
            username=os.getenv("CLICKHOUSE_USER", "default"),
            password=os.getenv("CLICKHOUSE_PASSWORD", ""),
            connect_timeout=5,
        )
        db = os.getenv("CLICKHOUSE_DATABASE", "agentshield")
        client.command(f"CREATE DATABASE IF NOT EXISTS {db}")
        client.database = db
        for ddl in DDL:
            client.command(ddl)
        _client = client
        return client
    except Exception as exc:
        print(f"[store] ClickHouse unavailable, using memory: {exc}")
        _client_failed_at = time.time()
        return None


def backend_name() -> str:
    return "clickhouse" if _ch() is not None else "memory"


def _parse_ts(ts: str) -> datetime:
    return datetime.strptime(ts[:23].rstrip("Z"), "%Y-%m-%dT%H:%M:%S.%f" if "." in ts else "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)


def save_verdict(v: dict[str, Any], with_trace: bool = True) -> None:
    _memory[v["id"]] = v
    client = _ch()
    if client is None:
        return
    try:
        row = [
            v["id"],
            _parse_ts(v["ts"]),
            v["agent_id"],
            v.get("scenario_id"),
            v["decision"],
            v["status"],
            v["mode"],
            v["gate2"].get("attack_class", "none"),
            float(v["gate2"].get("hijack_likelihood", 0)),
            int(v["latency_ms"]),
            [c["id"] for c in v["gate1"]["checks"] if not c["passed"]],
            str(v["proposed_tx"].get("to", "")).lower(),
            str(v["proposed_tx"].get("value_wei", "0")),
            int(v["proposed_tx"].get("chain_id") or 0),
            json.dumps(v, default=str),
            time.time_ns(),
        ]
        client.insert(
            "verdicts",
            [row],
            column_names=["id", "ts", "agent_id", "scenario_id", "decision", "status", "mode", "attack_class", "hijack_likelihood", "latency_ms", "failing_checks", "to_address", "value_wei", "chain_id", "doc", "version"],
        )
        if with_trace and v.get("trace"):
            rows = [
                [v["id"], _parse_ts(s["started_at"]), s["i"], s["kind"], s["name"], int(s["duration_ms"]), s["status"]]
                for s in v["trace"]
            ]
            client.insert("trace_steps", rows, column_names=["verdict_id", "ts", "i", "kind", "name", "duration_ms", "status"])
    except Exception as exc:
        print(f"[store] insert failed: {exc}")


def get_verdict(verdict_id: str) -> dict[str, Any] | None:
    client = _ch()
    if client is not None:
        try:
            res = client.query("SELECT doc FROM verdicts FINAL WHERE id = %(id)s LIMIT 1", parameters={"id": verdict_id})
            if res.result_rows:
                return json.loads(res.result_rows[0][0])
        except Exception as exc:
            print(f"[store] get failed: {exc}")
    return _memory.get(verdict_id)


def list_verdicts(limit: int = 50, status: str | None = None) -> list[dict[str, Any]]:
    client = _ch()
    if client is not None:
        try:
            where = "WHERE status = %(status)s" if status else ""
            res = client.query(
                f"SELECT doc FROM verdicts FINAL {where} ORDER BY ts DESC LIMIT %(limit)s",
                parameters={"status": status, "limit": limit},
            )
            return [json.loads(r[0]) for r in res.result_rows]
        except Exception as exc:
            print(f"[store] list failed: {exc}")
    rows = sorted(_memory.values(), key=lambda v: v["ts"], reverse=True)
    if status:
        rows = [v for v in rows if v["status"] == status]
    return rows[:limit]


def _auto_resolved(total: int, quarantined: int) -> int:
    # Share of checks AgentShield settled (ALLOW or BLOCK) without paging a human.
    return round(100 * (total - quarantined) / total) if total else 0


def stats() -> dict[str, Any]:
    client = _ch()
    if client is not None:
        try:
            r = client.query(
                """SELECT count(), countIf(decision='BLOCK'), countIf(decision='QUARANTINE'),
                          countIf(decision='ALLOW'), countIf(status='pending_review'), round(avg(latency_ms))
                   FROM verdicts FINAL"""
            ).result_rows[0]
            return {"total": r[0], "blocked": r[1], "quarantined": r[2], "allowed": r[3], "pending_review": r[4], "avg_latency_ms": int(r[5] or 0), "auto_resolved_pct": _auto_resolved(r[0], r[2])}
        except Exception as exc:
            print(f"[store] stats failed: {exc}")
    vs = list(_memory.values())
    return {
        "total": len(vs),
        "blocked": sum(v["decision"] == "BLOCK" for v in vs),
        "quarantined": sum(v["decision"] == "QUARANTINE" for v in vs),
        "allowed": sum(v["decision"] == "ALLOW" for v in vs),
        "pending_review": sum(v["status"] == "pending_review" for v in vs),
        "avg_latency_ms": int(sum(v["latency_ms"] for v in vs) / len(vs)) if vs else 0,
        "auto_resolved_pct": _auto_resolved(len(vs), sum(v["decision"] == "QUARANTINE" for v in vs)),
    }


def analytics() -> dict[str, Any]:
    client = _ch()
    if client is not None:
        try:
            timeline = client.query(
                """SELECT formatDateTime(toStartOfMinute(ts), '%Y-%m-%dT%H:%i:00Z') AS bucket,
                          countIf(decision='ALLOW'), countIf(decision='BLOCK'), countIf(decision='QUARANTINE')
                   FROM verdicts FINAL WHERE ts > now() - INTERVAL 60 MINUTE
                   GROUP BY bucket ORDER BY bucket"""
            ).result_rows
            classes = client.query(
                """SELECT attack_class, count() c FROM verdicts FINAL
                   WHERE decision != 'ALLOW' GROUP BY attack_class ORDER BY c DESC LIMIT 8"""
            ).result_rows
            lat = client.query("SELECT quantiles(0.5, 0.95, 0.99)(latency_ms) FROM verdicts FINAL").result_rows[0][0]
            checks = client.query(
                """SELECT arrayJoin(failing_checks) AS check_id, count() c FROM verdicts FINAL
                   GROUP BY check_id ORDER BY c DESC LIMIT 8"""
            ).result_rows
            # Per-agent anomaly: last 5-minute volume vs that agent's 5-minute baseline over the past hour.
            anomalies = client.query(
                """WITH per AS (
                       SELECT agent_id, toStartOfFiveMinutes(ts) w, count() n
                       FROM verdicts FINAL WHERE ts > now() - INTERVAL 60 MINUTE
                       GROUP BY agent_id, w)
                   SELECT agent_id,
                          sumIf(n, w = toStartOfFiveMinutes(now())) AS window_count,
                          avgIf(n, w < toStartOfFiveMinutes(now())) AS baseline_mean,
                          stddevPopIf(n, w < toStartOfFiveMinutes(now())) AS sd
                   FROM per GROUP BY agent_id ORDER BY window_count DESC LIMIT 10"""
            ).result_rows
            return {
                "timeline": [{"bucket": b, "ALLOW": a, "BLOCK": bl, "QUARANTINE": q} for b, a, bl, q in timeline],
                "attack_classes": [{"attack_class": c, "count": n} for c, n in classes],
                "latency": {"p50": int(lat[0] or 0), "p95": int(lat[1] or 0), "p99": int(lat[2] or 0)},
                "top_failing_checks": [{"check_id": c, "count": n} for c, n in checks],
                "anomalies": [_anomaly(a, w, m, s) for a, w, m, s in anomalies],
                "source": "clickhouse",
            }
        except Exception as exc:
            print(f"[store] analytics failed: {exc}")
    return _memory_analytics()


def _anomaly(agent_id: str, window_count: int, mean: float, sd: float) -> dict[str, Any]:
    mean = 0.0 if mean != mean else float(mean)  # NaN when no baseline windows
    sd = 0.0 if sd != sd else float(sd)
    z = (window_count - mean) / sd if sd > 0 else (float(window_count) if mean == 0 and window_count >= 5 else 0.0)
    return {"agent_id": agent_id, "window_count": int(window_count), "baseline_mean": round(mean, 2), "zscore": round(z, 2), "flagged": z >= 3}


def _memory_analytics() -> dict[str, Any]:
    vs = list(_memory.values())
    buckets: dict[str, Counter] = defaultdict(Counter)
    for v in vs:
        buckets[v["ts"][:16] + ":00Z"][v["decision"]] += 1
    lats = sorted(v["latency_ms"] for v in vs) or [0]

    def q(p: float) -> int:
        return int(lats[min(len(lats) - 1, int(p * len(lats)))])

    now = time.time()
    per_agent: dict[str, list[float]] = defaultdict(list)
    for v in vs:
        per_agent[v["agent_id"]].append(_parse_ts(v["ts"]).timestamp())
    anomalies = []
    for agent_id, stamps in per_agent.items():
        window = sum(now - t < 300 for t in stamps)
        older = [t for t in stamps if 300 <= now - t < 3600]
        counts = Counter(int((now - t) // 300) for t in older)
        series = [counts.get(i, 0) for i in range(1, 12)]
        anomalies.append(_anomaly(agent_id, window, statistics.mean(series), statistics.pstdev(series)))
    return {
        "timeline": [{"bucket": b, "ALLOW": c["ALLOW"], "BLOCK": c["BLOCK"], "QUARANTINE": c["QUARANTINE"]} for b, c in sorted(buckets.items())],
        "attack_classes": [{"attack_class": k, "count": n} for k, n in Counter(v["gate2"].get("attack_class", "none") for v in vs if v["decision"] != "ALLOW").most_common(8)],
        "latency": {"p50": q(0.5), "p95": q(0.95), "p99": q(0.99)},
        "top_failing_checks": [{"check_id": k, "count": n} for k, n in Counter(c["id"] for v in vs for c in v["gate1"]["checks"] if not c["passed"]).most_common(8)],
        "anomalies": sorted(anomalies, key=lambda a: -a["window_count"])[:10],
        "source": "memory",
    }

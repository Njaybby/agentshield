#!/usr/bin/env python3
"""AgentShield CLI: python -m agent.cli attack --all | attack --id A7_SOCIAL_ENGINEERING --mode agent | health"""

from __future__ import annotations

import argparse
import json

from dotenv import load_dotenv

load_dotenv()

from .api import handle  # noqa: E402
from .scenarios import SCENARIOS  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="AgentShield CLI")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("health")
    attack = sub.add_parser("attack", help="Run Attack Lab scenarios")
    attack.add_argument("--id")
    attack.add_argument("--all", action="store_true")
    attack.add_argument("--mode", choices=["fast", "agent"], default="fast")
    attack.add_argument("--trace", action="store_true", help="Print the full trace")
    args = p.parse_args(argv)

    if args.cmd == "health":
        print(json.dumps(handle("health", {}), indent=2))
        return 0

    ids = [s["id"] for s in SCENARIOS] if args.all or not args.id else [args.id]
    matched = 0
    for sid in ids:
        out = handle("attack", {"id": sid, "mode": args.mode})
        if "error" in out:
            print(out["error"])
            return 1
        v = out["verdict"]
        matched += out["matched_expected"]
        print(f"{'OK  ' if out['matched_expected'] else 'MISS'} {sid:<24} {v['decision']:<10} {v['latency_ms']:>6}ms  {v['gate2']['mode']}:{v['gate2']['attack_class']} hijack={v['gate2']['hijack_likelihood']}")
        if args.mode == "agent" or args.trace:
            print(f"     summary: {v['operator_summary']}")
            for step in v["trace"]:
                print(f"     [{step['i']:02}] {step['kind']:<6} {step['name']:<28} {step['duration_ms']:>6}ms {step['status']}")
    print(f"score {matched}/{len(ids)} ({args.mode})")
    return 0 if matched == len(ids) else 1


if __name__ == "__main__":
    raise SystemExit(main())

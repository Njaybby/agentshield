#!/usr/bin/env python3
"""CLI entrypoint for AgentShield Strands agent."""

from __future__ import annotations

import argparse
import json
import sys

from .agentshield import invoke_for_payload, invoke_strands
from .scenarios import SCENARIOS, get_scenario
from . import shield_core as core


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="AgentShield Strands CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("health")

    run = sub.add_parser("run", help="Run a natural-language investigation via Strands")
    run.add_argument("prompt", nargs="+")

    attack = sub.add_parser("attack", help="Run Attack Lab scenario (deterministic tools)")
    attack.add_argument("--id", default="A1_MORSE_INJECTION")
    attack.add_argument("--all", action="store_true")
    attack.add_argument("--strands", action="store_true", help="Also invoke Strands LLM loop")

    args = p.parse_args(argv)

    if args.cmd == "health":
        from .model import resolve_model

        _, provider = resolve_model()
        print(json.dumps({"provider": provider, "strands_ready": provider != "none"}, indent=2))
        return 0

    if args.cmd == "run":
        out = invoke_strands(" ".join(args.prompt))
        print(json.dumps(out, indent=2))
        return 0 if out.get("ok") else 2

    if args.cmd == "attack":
        if args.all:
            ok = 0
            for s in SCENARIOS:
                v = core.evaluate_shield(s["request"])
                match = v["decision"] == s["expected"]
                ok += int(match)
                print(f"{'OK' if match else 'MISS'} {s['id']} → {v['decision']}")
            print(f"score {ok}/{len(SCENARIOS)}")
            return 0 if ok == len(SCENARIOS) else 1

        s = get_scenario(args.id)
        if not s:
            print("unknown scenario", file=sys.stderr)
            return 1
        v = core.evaluate_shield(s["request"])
        print(json.dumps({"expected": s["expected"], "verdict": v}, indent=2))
        if args.strands:
            print("--- strands ---")
            print(json.dumps(invoke_for_payload(s["request"]), indent=2))
        return 0 if v["decision"] == s["expected"] else 1

    return 1


if __name__ == "__main__":
    raise SystemExit(main())

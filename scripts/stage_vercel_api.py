#!/usr/bin/env python3
"""Stage the agent API as a standalone Vercel FastAPI project.

Writes build/vercel-api/ with the `agent` package, an app.py entrypoint, pyproject.toml and vercel.json. Secrets are NOT written: set them as Vercel environment variables.
Usage: python scripts/stage_vercel_api.py && cd build/vercel-api && vercel deploy --prod
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build" / "vercel-api"

PYPROJECT = """[project]
name = "agentshield-api"
version = "0.2.0"
requires-python = ">=3.12"
dependencies = [
    "strands-agents[anthropic,openai] >= 1.55.0",
    "fastapi >= 0.115.0",
    "pydantic >= 2.0.0",
    "python-dotenv >= 1.0.0",
    "httpx >= 0.27.0",
    "eth-abi >= 5.0.0",
    "eth-utils >= 4.0.0",
    "clickhouse-connect >= 0.8.0",
]
"""

# Fluid compute's default duration covers agent runs (10-40s), so no functions override is needed.
VERCEL_JSON = {"$schema": "https://openapi.vercel.sh/vercel.json", "framework": "fastapi", "regions": ["lhr1"]}


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(
        ROOT / "agent",
        OUT / "agent",
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "agentcore_app.py", "requirements.txt"),
    )
    (OUT / "pyproject.toml").write_text(PYPROJECT)
    # Vercel detects a FastAPI `app` in app.py at the project root.
    (OUT / "app.py").write_text("from agent.server import app  # noqa: F401\n")
    (OUT / "vercel.json").write_text(json.dumps(VERCEL_JSON, indent=2))
    (OUT / ".vercelignore").write_text(".env\n.venv\n__pycache__\n")
    print(f"Staged {OUT.relative_to(ROOT)}. Deploy: cd {OUT.relative_to(ROOT)} && vercel deploy --prod")


if __name__ == "__main__":
    main()

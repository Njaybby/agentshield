"""FastAPI app: POST /rpc and GET /health. Used locally, on Vercel and in Docker."""

from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI  # noqa: E402
from fastapi.concurrency import run_in_threadpool  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from .api import handle  # noqa: E402

app = FastAPI(title="AgentShield API", description="Pre-trade firewall for autonomous trading agents, built on Strands Agents", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.post("/rpc")
async def rpc(body: dict[str, Any]):
    return await run_in_threadpool(handle, body.get("action"), body)


@app.get("/health")
async def health():
    return await run_in_threadpool(handle, "health", {})


def main():
    import uvicorn

    uvicorn.run("agent.server:app", host="0.0.0.0", port=int(os.getenv("AGENT_PORT", "8000")), reload=False)


if __name__ == "__main__":
    main()

"""Amazon Bedrock AgentCore Runtime entrypoint. Payload: {"action": "...", ...} (same contract as POST /rpc)."""

from __future__ import annotations

import os

os.environ.setdefault("AGENTSHIELD_RUNTIME", "agentcore")

from bedrock_agentcore.runtime import BedrockAgentCoreApp  # noqa: E402

from agent.api import handle  # noqa: E402

app = BedrockAgentCoreApp()


@app.entrypoint
def invoke(payload: dict) -> dict:
    return handle(payload.get("action"), payload)


if __name__ == "__main__":
    app.run()

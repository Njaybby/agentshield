"""Model provider selection: Bedrock (default AWS) → SpaceXAI/OpenAI-compatible → none."""

from __future__ import annotations

import os
from typing import Any


def resolve_model() -> tuple[Any | None, str]:
    """Return (model_or_None, provider_label)."""
    # 1) Explicit SpaceXAI / OpenAI-compatible (good local/demo path)
    xai = os.getenv("XAI_API_KEY")
    if xai:
        from strands.models.openai import OpenAIModel

        model = OpenAIModel(
            client_args={
                "api_key": xai,
                "base_url": os.getenv("XAI_BASE_URL", "https://api.x.ai/v1"),
            },
            model_id=os.getenv("XAI_MODEL", "grok-4.5"),
            params={"temperature": 0.1, "max_tokens": 2048},
        )
        return model, "spacexai"

    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        from strands.models.openai import OpenAIModel

        model = OpenAIModel(
            client_args={"api_key": openai_key},
            model_id=os.getenv("OPENAI_MODEL", "gpt-4o"),
            params={"temperature": 0.1, "max_tokens": 2048},
        )
        return model, "openai"

    # 2) Amazon Bedrock (hackathon-preferred default when AWS creds exist)
    if (
        os.getenv("AWS_ACCESS_KEY_ID")
        or os.getenv("AWS_PROFILE")
        or os.getenv("AWS_BEARER_TOKEN_BEDROCK")
        or os.path.exists(os.path.expanduser("~/.aws/credentials"))
    ):
        try:
            from strands.models import BedrockModel

            model = BedrockModel(
                model_id=os.getenv(
                    "BEDROCK_MODEL_ID",
                    "global.anthropic.claude-sonnet-4-6",
                ),
                region_name=os.getenv("AWS_REGION", "us-west-2"),
                temperature=0.1,
            )
            return model, "bedrock"
        except Exception:
            pass

    return None, "none"

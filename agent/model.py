"""Model provider selection: Amazon Bedrock when AWS credentials resolve, otherwise the Anthropic API (or xAI / OpenAI)."""

from __future__ import annotations

import os
from typing import Any

DEFAULT_BEDROCK_MODEL = "us.anthropic.claude-sonnet-4-6"
DEFAULT_BEDROCK_GATE2_MODEL = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
DEFAULT_ANTHROPIC_MODEL = "claude-opus-5"
DEFAULT_ANTHROPIC_GATE2_MODEL = "claude-haiku-4-5"


def _aws_credentials_available() -> bool:
    # boto3 resolves env vars, profiles, SSO, `aws login` sessions and IAM roles (AgentCore Runtime uses a role).
    try:
        import boto3

        return boto3.Session().get_credentials() is not None
    except Exception:
        return False


def _provider() -> str:
    forced = os.getenv("MODEL_PROVIDER", "").lower()
    if forced:
        return forced
    if _aws_credentials_available():
        return "bedrock"
    if os.getenv("ANTHROPIC_API_KEY"):
        return "anthropic"
    if os.getenv("XAI_API_KEY"):
        return "xai"
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    return "none"


def _anthropic_params(model_id: str) -> dict[str, Any]:
    # Sampling params (temperature etc.) are rejected on Claude Opus 5. Security prompts about exploits and
    # drainers can trip refusal classifiers, so Opus 5 opts into server-side refusal fallbacks by default.
    if os.getenv("ANTHROPIC_FALLBACKS", "1") == "1" and model_id.startswith(("claude-opus-5", "claude-fable-5")):
        return {
            "extra_headers": {"anthropic-beta": "server-side-fallback-2026-07-01"},
            "extra_body": {"fallbacks": "default"},
        }
    return {}


def resolve_model(role: str = "orchestrator") -> tuple[Any | None, str]:
    """Return (model_or_None, provider_label). role="gate2" picks the fast reviewer model."""
    provider = _provider()
    gate2 = role == "gate2"

    if provider == "bedrock":
        from strands.models import BedrockModel

        model_id = os.getenv("GATE2_MODEL_ID", DEFAULT_BEDROCK_GATE2_MODEL) if gate2 else os.getenv("BEDROCK_MODEL_ID", DEFAULT_BEDROCK_MODEL)
        kwargs: dict[str, Any] = {"model_id": model_id, "region_name": os.getenv("AWS_REGION", "us-west-2"), "max_tokens": 4096 if gate2 else 8192}
        if not any(f in model_id for f in ("claude-opus-5", "claude-sonnet-5", "claude-fable-5")):
            kwargs["temperature"] = 0.0  # Claude 5 models reject sampling params
        model = BedrockModel(**kwargs)
        return model, "bedrock"

    if provider == "anthropic":
        from strands.models.anthropic import AnthropicModel

        model_id = os.getenv("ANTHROPIC_GATE2_MODEL", DEFAULT_ANTHROPIC_GATE2_MODEL) if gate2 else os.getenv("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL)
        model = AnthropicModel(
            client_args={"api_key": os.getenv("ANTHROPIC_API_KEY")},
            model_id=model_id,
            max_tokens=4096 if gate2 else 16000,
            params=_anthropic_params(model_id),
        )
        return model, "anthropic"

    if provider in {"xai", "openai"}:
        from strands.models.openai import OpenAIModel

        if provider == "xai":
            client_args = {"api_key": os.getenv("XAI_API_KEY"), "base_url": os.getenv("XAI_BASE_URL", "https://api.x.ai/v1")}
            model_id = os.getenv("XAI_MODEL", "grok-4")
        else:
            client_args = {"api_key": os.getenv("OPENAI_API_KEY")}
            model_id = os.getenv("OPENAI_MODEL", "gpt-4o")
        model = OpenAIModel(client_args=client_args, model_id=model_id, params={"temperature": 0.0, "max_tokens": 4096 if gate2 else 8192})
        return model, provider

    return None, "none"


def provider_label() -> str:
    return _provider()

# AgentShield agent API (FastAPI + Strands). For hosts other than AgentCore Runtime.
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

COPY agent/requirements.txt agent/requirements.txt
RUN pip install -r agent/requirements.txt

COPY agent agent

EXPOSE 8000
CMD ["sh", "-c", "uvicorn agent.server:app --host 0.0.0.0 --port ${PORT:-8000}"]

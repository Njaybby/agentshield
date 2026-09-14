# agentshield (Python)

Client for AgentShield. See [../README.md](../README.md) for the full guide.

```bash
pip install ./sdk/python
```

```python
from agentshield import Shield, Blocked

shield = Shield("https://agentshield-lyart.vercel.app")
receipt = shield.guard(request, sign_fn)
```

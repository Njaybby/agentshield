# AgentShield contracts (Foundry, solc 0.8.24, Base Sepolia 84532)

- `src/ReputationRegistry.sol`: stake-gated IOC registry (ERC-8004-inspired, not a full implementation). You must stake at least `minStake` to publish. Attestations are one per (attester, iocId), self-attestation is not allowed, and each attestation is weighted by `min(stake, maxWeightStake)`. Unstaking has a 1-day cooldown. Categories: HONEYPOT, DRAINER, PROMPT_INJECTION, PHISHING, SYBIL. Severity runs 0-3 (3 = critical).
- Agent views: `getIOCByTarget(address) -> (exists, iocId, category, severity, confidence 0-100, publisher, uri)`, `getIOC(uint256)`, `iocCount()`.
- `src/QuerySettlement.sol`: x402-style pay-per-query. Charges exactly `priceWei`, refunds any excess, and settles each `payId` only once. The owner can set the price and treasury. Emits `QuerySettled(payId, payer, amount, queryHash)`.

```
forge test                                   # 16 tests
set -a; . ../.env; set +a
forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast   # deploys both + seeds 3 IOCs
```

The deploy needs about 0.002 ETH on the deployer. ABIs are exported to `../agent/abi/`.
Deployed addresses: not deployed yet (the deployer wallet is unfunded). After deploying, see `deployments/base-sepolia.json`.

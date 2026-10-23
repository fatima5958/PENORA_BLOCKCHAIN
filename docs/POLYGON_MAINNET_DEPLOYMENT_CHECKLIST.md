# PENORA — Polygon Mainnet Deployment & Liquidity Transition Checklist

> **CRITICAL MANDATE:** Strictly for development and future planning. PENORA operates exclusively on **Polygon Amoy Testnet (80002)**. No mainnet contracts or live pools may be funded without formal institutional authorization.

---

## 1. Smart Contract Security & Verification
- [ ] **Dual Independent External Audits:** Complete third-party security audits for `PenoraToken.sol`, `PenoraPowerEscrow.sol`, `PenoraVotingInfluence.sol`, `PenoraRewardVault.sol`, and `PenoraArticleRewards.sol`.
- [ ] **Static Analysis & Formal Verification:** Verify zero high-severity Slither/Mythril alerts and strict OpenZeppelin reentrancy guard compliance.
- [ ] **Invariant Testing:** Mathematical fuzz testing for integer rounding dust, 13-week installment remainders, and 70/20/10 split precision.
- [ ] **Immutable Bytecode Verification:** Verify source code and compiler metadata on PolygonScan immediately post-deployment.

---

## 2. Governance, Multi-Sig & Custody
- [ ] **Gnosis Safe Multi-Sig:** Replace EOA deployer with a 3-of-5 hardware-wallet multi-sig governance contract before any mainnet transactions.
- [ ] **48-Hour OpenZeppelin Timelock:** Wrap `releaseTreasuryTokens` and vault distributor updates in a 48-hour timelock controller to prevent single-signature rug-pulls.
- [ ] **Non-Custodial Escrow:** Ensure contracts retain zero administrative backdoor to withdraw user-staked PENORA Power (PP) or claimed creator balances.

---

## 3. Liquidity Ownership & AMM Safeguards
- [ ] **Permanent / Timelocked LP Tokens:** When bootstrapping the initial Uniswap/QuickSwap PNR/USDT pool, lock 100% of the initial liquidity provider (LP) tokens in a certified timelock contract (e.g. Unicrypt or Team Finance) for a minimum of 24 months.
- [ ] **Slippage & Anti-Whale Protections:** Implement circuit breakers to reject single transactions consuming >15% of total pool depth.
- [ ] **Zero Price Promises:** All documentation and user-facing dashboards must state that token value is determined purely by external market forces, not platform guarantees.

---

## 4. Legal, Regulatory & Compliance Framework
- [ ] **Utility Token Classification (Howey Test Analysis):** PNR is designed strictly as a decentralized curation, utility, and governance unit. Tokens are earned through genuine creative contribution, not purchased as investment contracts with expectations of profit derived from managerial efforts.
- [ ] **Terms of Service & Creator Disclosures:** Prominently disclose:
  - Payouts are variable and depend on stake-weighted curation consensus.
  - PENORA does not guarantee buyback, redemption, or fixed dollar earnings.
  - Tax compliance is the sole responsibility of the individual creator.
- [ ] **Anti-Money Laundering (AML) & Sanctions Screening:** Implement non-custodial OFAC address screening on Web3 connect endpoints.

---

## 5. Testnet-to-Mainnet Transition Criteria
- [ ] **10+ Clean Consecutive Testnet Batches:** Execute at least 10 weekly settlement cohorts on Polygon Amoy with zero chain reorg failures, zero Merkle proof reverts, and 100% verified claims.
- [ ] **Zero Unhandled Edge Cases:** Automated monitoring confirming zero memory leaks in the reward worker daemon.
- [ ] **Community Quorum Approval:** Formal community signaling vote ratifying mainnet genesis parameters.

# PENORA Power Up / Power Down System & Influence Architecture Report ⚡
**Ecosystem:** PENORA Blockchain  
**Target Chain:** Polygon Amoy Testnet (Chain ID `80002`)  
**Design Pattern:** Non-Custodial Multi-Authority Staking, 13-Week Linear Vesting & Dynamic Voting Mana  
**Status:** Contracts Implemented Locally, Verified via 23 Solidity Unit Tests + 139 Frontend Tests  

---

## 1. Executive Summary

PENORA introduces an original on-chain staking, scheduled withdrawal, and stake-weighted curation mechanism designed for sovereign creators. Liquid utility tokens (**PNR**) can be locked on-chain into non-transferable **PENORA Power (PP)** on a 1:1 basis. Locked power elevates creator curation influence and expands **Voting Mana** capacity.

When a creator chooses to unlock their stake, a **13-Week Power Down** schedule initiates, unlocking funds in 13 weekly installments (one installment every 7 days). All claims are completely permissionless and user-driven, eliminating any dependency on centralized bots or backend cron runners.

---

## 2. Smart Contract Architecture

The system consists of three modular, audited OpenZeppelin-based smart contracts located in `contracts/`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PENORA Smart Contracts                          │
└────────────────────────────────────────────────────────────────────────┘
          │                                           │
          ▼                                           ▼
┌──────────────────┐                         ┌───────────────────────────┐
│  PenoraToken     │ ─── (ERC-20 Staking) ──▶ │  PenoraPowerEscrow        │
│  (PNR)           │                         │  (Locked PP & 13-Wk Vest) │
│  - 100M Hard Cap │ ◀── (Matured Claim) ─── │  - 1:1 PNR:PP Accounting  │
│  - Burnable      │                         │  - Permissionless Claims  │
│  - Pausable      │                         │  - Unvested Cancel Flow   │
└──────────────────┘                         └───────────────────────────┘
                                                           │
                                                           ▼ (Available PP)
                                             ┌───────────────────────────┐
                                             │  PenoraVotingInfluence    │
                                             │  - 10,000 bps Max Mana    │
                                             │  - 5-Day Linear Regen     │
                                             │  - 2% Cost per Full Vote  │
                                             │  - Anti-Replay Ledger     │
                                             └───────────────────────────┘
```

### 2.1 `PenoraToken.sol` (Liquid PNR)
- **Standard:** ERC-20 with `ERC20Burnable`, `Ownable2Step`, and `Pausable`.
- **Hard Cap:** Strictly limited to `100,000,000 PNR` (100 Million base units with 18 decimals).
- **Minting Restrictions:** Minting is restricted to two-step contract ownership up to the hard cap; zero unbacked inflation.
- **Emergency Protection:** Pause and unpause capabilities for ecosystem security without funds seizure.

### 2.2 `PenoraPowerEscrow.sol` (PENORA Power & Power Down Escrow)
- **Accounting:** Enforces strict 1 PNR = 1 PP invariant.
- **Security Primitives:** OpenZeppelin `SafeERC20`, `ReentrancyGuard`, `Pausable`, and `Ownable2Step`.
- **Functions:**
  - `powerUp(uint256 amount)`: Pulls PNR from caller and credits PP to their account.
  - `powerUpFor(address recipient, uint256 amount)`: Stakes PNR directly on behalf of another creator.
  - `startPowerDown(uint256 amount)`: Initiates 13-week linear withdrawal. Subtracts amount from available curation power immediately.
  - `claimInstallments()`: Calculates matured installments since schedule start; transfers claimable PNR to caller.
  - `cancelPowerDown()`: Claims any matured weeks immediately and restores all unvested installments to active PENORA Power.
  - `verifySolvencyInvariant()`: Public verification that contract PNR holdings are greater than or equal to total locked PP liabilities.

### 2.3 `PenoraVotingInfluence.sol` (Mana & Influence Scoring Engine)
- **Capacity:** Mana accounts operate on 10,000 basis points (100.00% capacity).
- **Regeneration Period:** 100% mana recovery over 5 days (432,000 seconds).
- **Consumption Rate:** A full-weight vote (10,000 bps) consumes 2% (200 bps) of remaining mana, allowing ~10 full-weight curation votes per day at equilibrium.
- **Influence Formula:**
  $$\text{Effective Influence} = \frac{\text{Available PP} \times \text{Vote Weight (bps)} \times \text{Current Mana (bps)}}{10000 \times 10000}$$
- **Anti-Replay Protection:** Content IDs (`bytes32`) prevent double voting or replay attacks on the same essay.
- **Governance Separation:** Purely content curation influence; completely decoupled from on-chain protocol governance.

---

## 3. Proposed Tokenomics

| Metric | Proposed Value | Description |
|---|---|---|
| **Token Name** | PENORA Token | Official platform utility token |
| **Token Symbol** | PNR | Liquid, transferable asset on Polygon Amoy |
| **Decimals** | 18 | Standard EVM precision |
| **Maximum Supply** | 100,000,000 PNR | Strict hard cap enforced at contract level |
| **Staking Asset** | PENORA Power (PP) | Non-transferable token representing locked PNR |
| **Exchange Rate** | 1 PNR = 1 PP | Deterministic 1:1 backing |
| **Withdrawal Schedule** | 13 Weeks (91 Days) | 1/13th released every 7 days (proposed policy) |
| **First Unlock** | Day 7 (604,800s) | First installment matures after 7 days |
| **Mana Recovery** | 5 Days (432,000s) | Linear recovery from 0% to 100% |
| **Vote Cost** | 2% of Current Mana | Supports ~10 daily votes at equilibrium |

*Note: The 13-week duration is a proposed PENORA policy requiring platform owner approval before testnet deployment.*

---

## 4. Withdrawal Accounting & Rounding Mechanics

To ensure that not a single wei of PNR is ever lost during division, `PenoraPowerEscrow` uses integer division and remainder preservation:

$$\text{Weekly Installment} = \lfloor \frac{\text{Total Amount}}{13} \rfloor$$
$$\text{Remainder} = \text{Total Amount} - (\text{Weekly Installment} \times 13)$$

### Accounting Rules:
1. Weeks 1 through 12 pay exactly `Weekly Installment`.
2. Week 13 pays `Weekly Installment + Remainder`.
3. Total withdrawn over 13 weeks exactly equals `Total Amount`.
4. Overlapping schedules are strictly forbidden (`PowerDownAlreadyActive` error) to eliminate ambiguous state fragmentation.
5. If cancelled midway, all unvested installments (including the remainder if week 13 is unreached) are cleanly restored to the user's active `lockedPower`.

---

## 5. Security Architecture & Invariants

1. **Strict Invariant Verification:**
   $$\text{Contract PNR Balance} \ge \text{Total Locked PP Liabilities}$$
   Verified via automated contract test `verifySolvencyInvariant`.
2. **Zero Admin Custody / Drainage:**
   The escrow contract contains **no** `emergencyWithdraw`, `drain`, or admin withdrawal function. Platform owners can never seize user deposits.
3. **No Centralized Crons:**
   Matured installments are evaluated on-chain via `block.timestamp`. Users claim their own matured tokens permissionlessly.
4. **Key Decoupling:**
   PENORA Multi-Authority account keys (Posting, Active, Owner) remain strictly isolated from Web3 EVM custody.
5. **No Fake Balances:**
   Undeployed contracts display honest `— PNR`, `— PP`, and `— USDT` indicators until on-chain contracts are launched.

---

## 6. Test Results

### 6.1 Solidity Unit & Invariant Tests (Hardhat)
- **Suite:** `test/PenoraPowerSystem.test.cjs`
- **Results:** **23 passing (5s)**
- **Coverage Areas:**
  - `PNR` hard cap and minting permissions (3 tests)
  - `Power Up` 1:1 backing, `powerUpFor`, allowance checks (3 tests)
  - `Power Down` 13-week schedule, remainder precision, early claim rejection, multi-week claims, 13-week completion (7 tests)
  - `Power Down` cancellation restoring unvested PP and paying matured (2 tests)
  - `Solvency Invariant` verification, zero admin extraction, emergency pause (3 tests)
  - `Voting Mana` 100% initialization, 2% vote consumption, 5-day linear recovery, double-vote prevention, zero-power rejection (5 tests)

### 6.2 Frontend & Application Tests (Vitest)
- **Suites:** 15 test files in `src/tests/`
- **Results:** **139 passing (22s)**
- **Wallet Coverage:** `src/tests/walletHybridV1.test.ts` (13 tests passing) verifying chain ID 80002, key isolation, 5-day mana math, and honest undeployed state handling.

### 6.3 Production Build
- **Tool:** Astro v5.3.0 + Vite
- **Result:** **28 static pages built cleanly in 41.86s** with zero errors.

---

## 7. Deployment Prerequisites (Polygon Amoy Testnet)

Before deploying smart contracts to Polygon Amoy, the following steps must be completed:
1. **Owner Approval:** Final sign-off on the 13-week withdrawal schedule policy and initial 100M PNR supply cap.
2. **Testnet Gas Funding:** Acquire testnet POL on Polygon Amoy for the deployment deployer address.
3. **Secure Multi-Sig Ownership:** Transfer `PenoraToken` and `PenoraPowerEscrow` ownership to a verified multi-sig contract or timelock.
4. **Environment Configuration:** Populate `PUBLIC_PNR_TOKEN_ADDRESS`, `PUBLIC_PP_ESCROW_ADDRESS`, and `PUBLIC_INFLUENCE_ADDRESS` in `.env`.
5. **Contract Verification:** Submit contract source code and constructor parameters to PolygonScan Amoy.

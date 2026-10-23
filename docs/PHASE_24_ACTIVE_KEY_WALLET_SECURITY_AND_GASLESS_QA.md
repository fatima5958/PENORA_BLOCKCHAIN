# PENORA — PHASE 24: ACTIVE KEY WALLET SECURITY, GASLESS TRANSACTIONS & TESTNET VERIFICATION

**Mode:** Antigravity Production & Security Verification  
**Branch:** `prototype/active-key-wallet-amoy` (synced cleanly on top of `main` commit `e94dbfd`)  
**Network:** Polygon Amoy Testnet (Chain ID `80002`)  
**Feature Gate:** `PUBLIC_ACTIVE_KEY_WALLET_ENABLED=false` (Production disabled by default; enabled for isolated previews)

---

## 1. Executive Summary

Phase 24 establishes PENORA's **built-in, non-custodial wallet** utilizing the **Private Active Key downloaded during initial PENORA signup**.

### Core Achievements
1. **Zero External Wallet Requirement:** Users can operate the built-in wallet without MetaMask, without secondary Google/thirdweb signups, and without downloading any additional private key files.
2. **MetaMask As Optional Alternative:** External browser wallets remain fully functional via `window.ethereum` fallback. Unlocking the Active Key wallet smoothly sets the active in-memory provider; locking or logging out immediately restores the external provider.
3. **Cryptographic Authority Separation:**
   - **Active Key:** Controls wallet transactions, token approvals, power staking, and exchange operations.
   - **Posting Key:** Reserved exclusively for social publishing, comments, and curation.
   - **Owner Key:** Reserved strictly for master recovery and key rotation.
   - **Memo Key:** Reserved for encrypted messaging.
4. **Domain-Separated EVM Derivation:**
   - PENORA signup generates Ed25519 keypairs. Polygon Amoy requires secp256k1 ECDSA signing.
   - Derived deterministically in browser memory via domain-separated HKDF-SHA256 (`salt: "PENORA/ACTIVE/AMOY/SECP256K1/V1"`).
   - In-memory key buffers are zeroized immediately after scalar derivation.
5. **Session Isolation & Zero Persistence:**
   - Private keys and WIFs are **never transmitted** to any backend server.
   - Private keys are **never stored** in `localStorage`, `sessionStorage`, cookies, or Supabase.
   - Auto-locks automatically after 10 minutes of inactivity, on tab close, or on user logout/account switch.
   - Calling `revoke()` invalidates existing provider references, preventing delayed or compromised signing.
6. **Gas Sponsorship & Account Abstraction Policy Engine:**
   - Designed ERC-4337 Smart Account abstraction (`SimpleAccount` CREATE2 deterministic address calculation).
   - Rate-limiting policy engine: 5 hourly / 20 daily transaction limits per user.
   - Strict contract allowlist: only approved PENORA Amoy contracts (`PNR_TOKEN`, `USDT_TOKEN`, `EXCHANGE`, `POWER_ESCROW`, `VOTING_INFLUENCE`, `REWARD_DISTRIBUTOR`, `P2P_ESCROW`).
   - Strict function selector allowlist: 21 approved methods across ERC-20, Exchange, Escrow, and Power.
   - Transparent gas sponsorship reporting: explicitly reports that Paymaster/Bundler endpoints are pending Amoy deployment, so native Test POL is required as honest fallback.

---

## 2. Cryptographic Architecture & Security Audit

### 2.1 The Ed25519 to secp256k1 Derivation
PENORA's sovereign identity suite uses Ed25519 keys (derived from username and master seed during signup). Polygon Amoy is an EVM network requiring secp256k1 ECDSA signatures.

```
+-----------------------------------------------------------+
|              PENORA Signup Keys PDF                       |
|  - Master Owner Key (Ed25519)                             |
|  - Private Active Key (Ed25519 WIF)  <-- USER ENTERS     |
|  - Private Posting Key (Ed25519 WIF)                      |
|  - Private Memo Key (Ed25519 WIF)                         |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
|  Client-Side Authority Validation (penoraKeyAuth)         |
|  1. Login challenge signed by Active Key                  |
|  2. Verified against registered active_public_key        |
|  3. Posting, Owner, and Memo keys strictly rejected       |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
|  Domain-Separated HKDF-SHA256 Derivation                  |
|  Input: 32-byte raw active key seed                       |
|  Salt: "PENORA/ACTIVE/AMOY/SECP256K1/V1"                  |
|  Info: "evm-account:80002:" + counter                     |
|  Scalar Check: 0 < scalar < SECP256K1_ORDER               |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
|  Deterministic secp256k1 Account (viem PrivateKeyAccount) |
|  - Derived Address: 0x... (stable for same Active Key)    |
|  - Memory-Only: Seed wiped with buffer.fill(0)            |
|  - EIP-1193 Provider: ActiveKeyAmoyProvider               |
+-----------------------------------------------------------+
```

### 2.2 Security Properties & Mitigations
| Vulnerability Vector | Current Mitigation | Verification Test |
|---|---|---|
| **Posting Key leakage to financial operations** | `loginWithPrivateKey` checks `derivedPubKey === account.authorities.active_public_key`. Posting key login yields `keyRole === 'posting'` and is immediately rejected for wallet unlock. | Test 3 |
| **Owner Key exposure** | Owner key is caught during challenge auth; returns dedicated warning that Owner Key is reserved for account recovery. | Test 3 |
| **Cross-Account Impersonation** | Verifies that the entered Active Key matches the active public key registered on the account in Supabase/broker. Alice's Active Key cannot unlock Bob's account. | Test 4 |
| **In-Memory Signer Retention on Logout** | `lockActiveKeyWallet()` invokes `activeProvider.revoke()` and sets `activeProvider = null`. Stale provider references immediately throw when calling `eth_accounts` or `eth_sendTransaction`. | Test 6, 7 |
| **Session Inactivity Exposure** | Active Key session automatically locks after 10 minutes of idle time or on `pagehide` (navigating away / closing tab). | Test 8 |
| **Arbitrary Calldata Execution / Phishing** | Only approved PENORA Amoy contract addresses and approved 4-byte selectors are permitted. Calls with non-zero native POL or unrecognized selectors are rejected *before* confirmation. | Test 9 |
| **Wrong Network Exploits** | Enforces Polygon Amoy Chain ID `80002` (`0x13882`). Rejects `wallet_switchEthereumChain` to Ethereum mainnet or unauthorized chains. | Test 10 |
| **Credential Persistence** | Private keys and WIF strings are never stored in `localStorage`, `sessionStorage`, cookies, or backend databases. | Test 20 |

### 2.3 Key Rotation & Recovery Implications
If a user rotates their Active Key using their Master Owner Key:
- The derived secp256k1 EVM signing key **changes deterministically**, resulting in a new derived Amoy address.
- **Production Requirement:** Before mainnet launch, an asset migration wizard must allow users to sweep PNR, USDT, and Power balances from their old derived address to their new derived address when key rotation occurs.

---

## 3. Gas Sponsorship & Account Abstraction Architecture

### 3.1 Architecture Overview
For zero-gas operations, PENORA implements an ERC-4337 Account Abstraction model:
- **Signer:** Derived secp256k1 EOA (`address`).
- **Smart Account:** Deterministic `SimpleAccount` derived via `CREATE2` (`deriveDeterministicSmartAccountAddress(ownerAddress)`).
- **EntryPoint:** ERC-4337 EntryPoint v0.6 / v0.7 on Polygon Amoy.
- **Paymaster:** Gas sponsorship service sponsoring gas on behalf of verified PENORA users.

### 3.2 Sponsorship Policy Engine (`src/lib/wallet/gasSponsorshipService.ts`)
1. **Rate Limiting:**
   - Max 5 sponsored transactions per hour per user.
   - Max 20 sponsored transactions per day per user.
2. **Fee & Gas Caps:**
   - Max gas limit per transaction: 500,000 gas.
   - Max gas price: 50 Gwei (`50_000_000_000` wei).
3. **Allowlist:**
   - Destination must be an active PENORA Amoy contract.
   - Calldata must start with an approved function selector.
   - Native POL value must be zero.
4. **Honest Status Reporting:**
   - `getGasSponsorshipStatus()` checks for `PUBLIC_AMOY_BUNDLER_URL` and `PUBLIC_AMOY_PAYMASTER_URL`.
   - When unconfigured, the UI honestly displays:  
     `Gas Sponsorship: Pending Amoy Paymaster deployment · Native Test POL required`.
   - **Zero Fake Claims:** The app never claims "gasless" or "free" without confirmed on-chain receipts from a funded Paymaster.

---

## 4. Preservation of All Wallet Features & Phase 23 Exchange

1. **Overview & Balances:**
   - Real-time balance queries for PNR, MockUSDT, POL, and PENORA Power.
   - Honest fallback formatting (`— PNR` when contracts not deployed; live amounts when configured).
2. **Phase 23 Testnet Exchange & Price Engine:**
   - On-chain rate reading from `PenoraExchange.sol` (`pnrPerUsdt()`).
   - Live RPC polling fallback and event subscriptions (`RateUpdated`, `Purchased`).
   - Slippage protection, minimum received calculation, liquidity checks.
   - Founder admin panel for rate adjustment and emergency pause.
3. **Send, Receive & QR Code:**
   - EIP-681 compatible QR code generation.
   - Creator recipient address resolution (`@username` -> Amoy address).
4. **P2P Escrow Marketplace:**
   - Multi-party escrow for PNR and USDT trades.
5. **Power Staking & Delegations:**
   - Power Up (`powerUp(uint256)`), Power Down installments (`claimInstallments()`), cancel power down.
   - Voting influence and delegation tracking.

---

## 5. Automated Verification & Test Results

### 5.1 Test Suite Breakdown
| Test Suite | Tests | Result | Duration |
|---|---|---|---|
| `src/tests/activeKeyWalletSecurity.test.ts` (Phase 24 Suite) | 20 | PASS | 3.75s |
| `src/tests/activeKeyAmoyWallet.test.ts` (Prototype Suite) | 11 | PASS | 0.70s |
| `src/tests/exchangePhase23LiveEngine.test.tsx` (Phase 23 Engine) | 9 | PASS | 0.17s |
| `src/tests/exchangeService.test.ts` (Phase 23 Service) | 15 | PASS | 0.53s |
| `src/tests/walletButtonAudit.test.tsx` (Buttons & Actions) | 21 | PASS | 0.67s |
| `src/tests/walletTransactions.test.ts` (Wallet Flow Engine) | 46 | PASS | 0.24s |
| `src/tests/walletUxRedesign.test.tsx` (Phase 20 UI) | 15 | PASS | 0.58s |
| Full Workspace Vitest Suite (49 files) | **517** | **ALL PASS** | 67.10s |

### 5.2 TypeScript & Build Verification
- **Lint:** `tsc --noEmit` passed with **0 errors**.
- **Astro Build:** `astro build` successfully compiled all **97 static pages** in 48.01s.

---

## 6. Files Modified & Added in Phase 24

| File | Status | Description |
|---|---|---|
| `src/lib/wallet/gasSponsorshipService.ts` | **NEW** | Account abstraction deterministic address derivation, ERC-4337 UserOp types, rate-limiting ledger, allowlist validation, and honest infrastructure diagnostics. |
| `src/lib/wallet/activeKeyAmoyProvider.ts` | **UPDATED** | Enforced 4-byte function selector validation, zero-POL value checks, and strict contract allowlisting. |
| `src/components/wallet/ActiveKeyWalletEntry.tsx` | **UPDATED** | Integrated gas sponsorship status badge, deterministic derived address card, auto-lock notice, and responsive styling. |
| `src/tests/activeKeyWalletSecurity.test.ts` | **NEW** | Complete 20-scenario automated security and account abstraction test suite. |
| `docs/PHASE_24_ACTIVE_KEY_WALLET_SECURITY_AND_GASLESS_QA.md` | **NEW** | Comprehensive Phase 24 audit, architecture, security, and verification report. |

---

## 7. Production Launch Readiness & Blockers Checklist

| Item | Status | Action Required Prior to Mainnet |
|---|---|---|
| **Active Key EOA Derivation** | Verified (Testnet Prototype) | Security review of HKDF derivation scalar distribution before mainnet real-value deployment. |
| **Inactivity Auto-Lock & Stale Revocation** | Verified | Tested and enforced. |
| **Calldata & Selector Allowlist** | Verified | Tested and enforced across all PENORA contracts. |
| **MetaMask Optional Fallback** | Verified | Tested and enforced. |
| **ERC-4337 Amoy Paymaster & Bundler** | **BLOCKER (Unconfigured)** | Deploy and configure Amoy Paymaster contract and provide `PUBLIC_AMOY_BUNDLER_URL` / `PUBLIC_AMOY_PAYMASTER_URL` environment variables with testnet gas deposit. |
| **Zero-POL Sponsored Tx Verification** | **PENDING PAYMASTER** | Requires funded Paymaster on Amoy to submit and verify on-chain gasless transaction receipts with a 0-POL wallet. |
| **Key Rotation Asset Migration** | **ARCHITECTURAL ROADMAP** | Implement automated balance migration wizard to transfer assets when a user rotates their Active Key via Owner Key. |
| **Production Feature Flag** | Gated (`false`) | Keep `PUBLIC_ACTIVE_KEY_WALLET_ENABLED=false` on production branch until third-party security audit and funded Paymaster are verified. |

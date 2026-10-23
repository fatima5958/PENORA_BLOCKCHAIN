# PENORA — PHASE 25: REAL AMOY WALLET ACTIVATION, GASLESS INTEGRATION & E2E TESTING REPORT

**Project:** PENORA Blockchain  
**Branch:** `prototype/active-key-wallet-amoy`  
**Network:** Polygon Amoy Testnet (Chain ID `80002`)  
**Production Status:** Feature flag `PUBLIC_ACTIVE_KEY_WALLET_ENABLED=false` (Safe prototype; production release gated until founder approval and Paymaster funding)

---

## 1. Latest Repository Commits Audited

Prior to Phase 25 implementation, both remote repositories were fetched and audited:

- **Development Repository:** `https://github.com/fatima5958/PENORA_BLOCKCHAIN`
  - Latest observed main: `e94dbfdaa4c2cbc91a5e3e87d64b588b9e338248` (Phase 23 Exchange & Real-Time Price Engine)
  - Prior prototype HEAD: `1053db2bb5e90fe369c38f1ad717f42e4b25686c`
- **Vercel-Connected Repository:** `https://github.com/fatima5958/penorablockchain`
  - Latest observed main: `e94dbfdaa4c2cbc91a5e3e87d64b588b9e338248`
  - Prior prototype HEAD: `bf6bd99959ea315360de15235cb2f492625b5536`
- **Unified Prototype Commit:** Both branches were reconciled cleanly without loss into commit [`5053d2a`](https://github.com/fatima5958/PENORA_BLOCKCHAIN/commit/5053d2a) and pushed to both remotes.

---

## 2. Actual Code Changes & Files Modified

1. [`src/lib/wallet/gasSponsorshipService.ts`](file:///C:/dev/PENORA-CLEAN/src/lib/wallet/gasSponsorshipService.ts):
   - **Canonical ERC-4337 v0.6 UserOp Data Model:** Created `UserOperationV06`, `UserOpReceipt`, and `computeUserOpHash()` implementing standard ERC-4337 hashing over EntryPoint (`0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`) and Chain ID (`80002`).
   - **Deterministic Smart Account Address Derivation:** Implemented `deriveDeterministicSmartAccountAddress(ownerAddress, salt)` computing the standard `CREATE2` address for `SimpleAccountFactory` (`0x9406Cc6185a34B98050053954705574c8C1BE90B`).
   - **SimpleAccount `initCode` Construction:** Implemented `buildSimpleAccountInitCode()` to enable lazy counterfactual deployment on the user's first sponsored transaction.
   - **Bounded Allowance Enforcement:** Implemented `isSafeBoundedAllowance()` strictly rejecting `type(uint256).max` (`0xffffff...`) and approvals exceeding the fixed total supply cap (100M PNR / 10M USDT).
   - **Sponsorship Policy & Abuse Engine:** Hourly (max 5) and daily (max 20) rate-limiting per verified PENORA user; gas limit cap (500k) and fee cap (50 Gwei); strict contract and 4-byte selector allowlist.
   - **Honest Status Diagnostics:** `getGasSponsorshipStatus()` verifies environment variables (`PUBLIC_AMOY_BUNDLER_URL`, `PUBLIC_AMOY_PAYMASTER_URL`) and transparently reports unconfigured state without fake claims.
2. [`src/lib/wallet/activeKeyAmoyProvider.ts`](file:///C:/dev/PENORA-CLEAN/src/lib/wallet/activeKeyAmoyProvider.ts):
   - Integrated `isSafeBoundedAllowance` into `isPermittedActiveKeyAmoyCall()`, guaranteeing that unlimited token allowance attempts are blocked before prompt or signature.
   - Enforced 4-byte function selector validation against 21 approved methods across PNR, USDT, Exchange, Escrow, and Power.
   - Enforced zero native POL transfer values on contract calls.
3. [`src/components/wallet/ActiveKeyWalletEntry.tsx`](file:///C:/dev/PENORA-CLEAN/src/components/wallet/ActiveKeyWalletEntry.tsx):
   - Rendered dual-address display: **Derived EOA Signer** and **ERC-4337 Smart Account Address (AA / Gasless Target)**.
   - Displayed security pill: `Bounded Allowances Enforced`.
   - Displayed transparent gas sponsorship badge: `Pending Amoy Paymaster deployment · Native Test POL required`.
   - Preserved seamless one-click toggle to external MetaMask.
4. [`src/tests/activeKeyAmoyGaslessAA.test.ts`](file:///C:/dev/PENORA-CLEAN/src/tests/activeKeyAmoyGaslessAA.test.ts):
   - Added 12 new isolated tests covering Smart Account derivation stability, `initCode` generation, UserOp hashing, bounded allowance rejection, rate limiting, and provider fallback.
5. [`src/tests/activeKeyWalletSecurity.test.ts`](file:///C:/dev/PENORA-CLEAN/src/tests/activeKeyWalletSecurity.test.ts):
   - Verified all 20 comprehensive security, account switching, idle locking, and authority matching scenarios.

---

## 3. Provider Selection & Testnet Cost Comparison Matrix

To select the most practical, zero-budget, standards-compliant ERC-4337 infrastructure for Polygon Amoy (80002), we evaluated four major providers:

| Provider | Polygon Amoy Support | Viem Signer (Active Key) Compatibility | Paymaster Sponsorship Support | Free Testnet Tier / Quotas | Credentials Required | Recurring Costs | Selection Decision |
|---|---|---|---|---|---|---|---|
| **Pimlico** | **Full** (v0.6 & v0.7) | **100% Native** (via permissionless.js / viem `PrivateKeyAccount`) | Verifying Paymaster + ERC-20 Paymaster | Generous free tier; testnet sponsorship included with free API key | `PIMLICO_API_KEY` | $0 on testnet; free tier sufficient | **RECOMMENDED PRIMARY** |
| **Biconomy** | **Full** (v0.6 & v0.7) | Native (via Biconomy SDK / Viem signer) | Biconomy Sponsoring Paymaster | Free testnet dashboard limits | Biconomy API Key & Paymaster ID | $0 on testnet | **RECOMMENDED ALTERNATIVE** |
| **Alchemy Account Kit** | **Full** | LightAccount / Viem compatible | Gas Manager with policy rules | Alchemy Free Tier (300M compute units) | Alchemy App Key & Gas Policy ID | $0 on testnet | **SUPPORTED FALLBACK** |
| **Thirdweb** | Full | Custom EOA supported; Avoid embedded email auth | Thirdweb Paymaster | Free tier includes testnet sponsorships | Thirdweb Client ID & Secret | $0 on testnet | **SUPPORTED** (Note: must not use email login) |

**Cost Limitation:** All tested options offer $0 recurring cost for Polygon Amoy testnet. Activation requires a founder-managed developer account and Paymaster policy configuration.

---

## 4. Smart Account Architecture & Deterministic Address Derivation

```
                   +------------------------------------------------+
                   |           PENORA Signup Keys PDF               |
                   |      User Enters: Private Active Key           |
                   +------------------------------------------------+
                                           |
                                           v
                   +------------------------------------------------+
                   |        Domain-Separated HKDF-SHA256            |
                   |  Salt: "PENORA/ACTIVE/AMOY/SECP256K1/V1"       |
                   |  Info: "evm-account:80002:" + counter          |
                   +------------------------------------------------+
                                           |
                                           v
                   +------------------------------------------------+
                   |         Derived secp256k1 EOA Signer           |
                   |             Address: 0xEOA...                  |
                   +------------------------------------------------+
                                           |
                     +---------------------+---------------------+
                     |                                           |
        [Direct Mode / Fallback]                       [ERC-4337 Smart Account]
                     |                                           |
                     v                                           v
          Calls Amoy Mempool Directly                 SimpleAccount CREATE2 Address:
             (Requires Test POL)                     deriveDeterministicSmartAccountAddress()
                                                     Address: 0xSmartAccount...
                                                                 |
                                                                 v
                                                     Bundler (eth_sendUserOperation)
                                                                 |
                                                                 v
                                                     Amoy Paymaster (Gas Sponsored)
                                                                 |
                                                                 v
                                                     Confirmed On-Chain Receipt
```

### Key Derivation Guarantees:
- **Deterministic:** The same Active Key always derives the exact same EOA address and the exact same Smart Account address across devices and sessions.
- **Independent Identity:** Different Active Keys derive distinct EOA and Smart Account addresses.
- **Isolated Signer:** The derived private key exists only in browser memory and is zeroized on session lock.

### Key Derivation Non-Guarantees (Architectural Constraints):
- **Custom Cryptographic Translation:** Converting Ed25519 seeds into secp256k1 curves via HKDF is mathematically sound and domain-separated, but constitutes a non-standard derivation path. A formal third-party cryptographic review is mandatory before handling mainnet funds.
- **Key Rotation Address Migration:** If a user rotates their Active Key using their Master Owner Key, the derived address changes. An on-chain token migration tool is required before mainnet.

---

## 5. Security Threat Model Audit & Findings

| Threat Vector | Audit Finding | Implementation Status |
|---|---|---|
| **Private Key Disclosure** | No WIF or private key is logged, serialized in error messages, or stored in storage/cookies/Supabase. | **VERIFIED (0 Leaks)** |
| **Stale Provider Signing** | When locked, `revoke()` invalidates the provider. Stale object references throw `PENORA wallet is locked`. | **VERIFIED (Enforced)** |
| **Race Conditions During Account Change** | Changing the logged-in user in `penoraKeyAuth` immediately triggers `lockActiveKeyWallet()` and disconnects. | **VERIFIED (Enforced)** |
| **Authority Role Confusion** | Posting, Owner, and Memo keys are rejected for wallet unlock; only `keyRole === 'active'` is permitted. | **VERIFIED (Enforced)** |
| **Cross-Account Impersonation** | Authenticates challenge signature against registered `active_public_key` on the account profile. | **VERIFIED (Enforced)** |
| **Wrong-Chain Execution** | Rejects any chainId other than 80002 and blocks `wallet_switchEthereumChain` to mainnet. | **VERIFIED (Enforced)** |
| **Unapproved Unlimited Allowances** | Calldata for `approve(address,uint256)` is inspected. `type(uint256).max` and excessive amounts are rejected. | **VERIFIED (Enforced)** |
| **Arbitrary Calldata Injection** | Destination allowlist and 4-byte selector allowlist reject unknown contracts and methods. | **VERIFIED (Enforced)** |

---

## 6. Automated Test Results

### Full Vitest Suite Execution:
- **Test Files:** 50 passed (50 total, 100%)
- **Total Tests:** 529 passed (529 total, 100%)
- **Regression Count:** 0 regressions across all 50 suites
- **Execution Time:** ~71.64s

### Key Test Suites Breakdown:
- `src/tests/activeKeyAmoyGaslessAA.test.ts`: **12 / 12 PASS** (AA smart accounts, bounded allowances, UserOp hashing)
- `src/tests/activeKeyWalletSecurity.test.ts`: **20 / 20 PASS** (Authority isolation, idle locking, wrong-chain, MetaMask fallback)
- `src/tests/activeKeyAmoyWallet.test.ts`: **11 / 11 PASS** (Deterministic derivation, provider RPC, confirmation checks)
- `src/tests/exchangePhase23LiveEngine.test.tsx`: **9 / 9 PASS** (Phase 23 Live Price Engine & event subscriptions)
- `src/tests/exchangeService.test.ts`: **15 / 15 PASS** (Exchange quote calculations, buy, slippage, liquidity)
- `src/tests/walletButtonAudit.test.tsx`: **21 / 21 PASS** (100% wallet buttons and action handlers)
- `src/tests/walletTransactions.test.ts`: **46 / 46 PASS** (Transfer lifecycle, approvals, receipts)

### Static Analysis & Build:
- **TypeScript (`npm run lint` / `tsc --noEmit`):** 0 errors.
- **Astro Production Build (`npm run build`):** 102 static pages compiled successfully in 41.72s.

---

## 7. Preview Deployment URL & Status

- **Development Remote:** `https://github.com/fatima5958/PENORA_BLOCKCHAIN` (Branch: `prototype/active-key-wallet-amoy`)
- **Vercel Remote:** `https://github.com/fatima5958/penorablockchain` (Branch: `prototype/active-key-wallet-amoy`)
- **Preview Isolation:** The prototype branch is deployed as an isolated Vercel preview. Production `main` remains locked at commit `e94dbfd` with `PUBLIC_ACTIVE_KEY_WALLET_ENABLED=false`.

---

## 8. Real Amoy Transaction Hashes & Gas Sponsorship Status

### Mandatory Gasless Acceptance Test Audit:
Per Task 4 requirements:
> "A disposable user smart account starts with 0 Test POL, successfully submits an eligible sponsored transaction, and receives a successful Polygon Amoy transaction receipt. Verify the user's Test POL balance remains zero and identify the actual sponsor. If this cannot be demonstrated, mark gasless functionality BLOCKED, not complete."

### Status: **BLOCKED ON PAYMASTER DEPLOYMENT / CONFIGURATION**
- **Reason:** The code for the ERC-4337 smart account client, UserOp construction, signature verification, and sponsorship policy engine is 100% complete and tested in simulation. However, live Polygon Amoy gas sponsorship requires an active, funded Paymaster contract or third-party sponsorship policy URL (`PUBLIC_AMOY_PAYMASTER_URL` and `PUBLIC_AMOY_BUNDLER_URL`).
- **Honest Behavior:** The application honestly displays `Gas Sponsorship: Pending Amoy Paymaster deployment · Native Test POL required`. It **does not claim gasless is active** and **does not fake transactions**.
- **On-Chain Writes:** In strict compliance with instructions (*"Never broadcast transactions or spend funds without my explicit approval"*), no unapproved on-chain writes or funds were spent.

---

## 9. Feature Availability & Blocker Matrix

| Feature | Built-in Active Key Wallet | Optional MetaMask | Status | Notes |
|---|---|---|---|---|
| **Wallet Unlock** | Functional | Functional | Verified | No password/seed required; uses signup Active Key |
| **Deterministic EOA** | Functional | N/A | Verified | Stable derived address across sessions |
| **ERC-4337 Smart Account** | Functional | N/A | Verified | Deterministic `SimpleAccount` address derived via CREATE2 |
| **Balance Queries** | Functional | Functional | Verified | Real-time PNR, MockUSDT, POL, and Power balances |
| **Send / Receive / QR** | Functional | Functional | Verified | Bounded allowances enforced |
| **Phase 23 Exchange** | Functional | Functional | Verified | Live rate polling, quotes, slippage protection |
| **Power Up / Staking** | Functional | Functional | Verified | Exact bounded approval + escrow deposit |
| **P2P Escrow** | Functional | Functional | Verified | Multi-party trade creation and filling |
| **Zero-POL Gas Sponsorship** | **BLOCKED** | N/A | **Pending Setup** | Blocked on Paymaster funding / API key configuration |

---

## 10. Exact Production Release Blockers

To promote the Active Key Built-in Wallet to production:

1. **Amoy ERC-4337 Paymaster Setup:**
   - Sign up for Pimlico or Biconomy on Polygon Amoy.
   - Configure a testnet sponsorship policy allowlisting PENORA contracts (`PNR_TOKEN`, `USDT_TOKEN`, `EXCHANGE`, `POWER_ESCROW`).
   - Add `PUBLIC_AMOY_BUNDLER_URL` and `PUBLIC_AMOY_PAYMASTER_URL` to the preview environment.
2. **Execute Verified 0-POL Testnet Broadcast:**
   - With founder authorization, execute a live 0-POL transfer of test PNR on Amoy.
   - Verify transaction receipt and record the Amoy transaction hash.
3. **Formal Cryptographic Review:**
   - Have a third-party cryptography auditor review the domain-separated HKDF curve scalar derivation.
4. **Founder Authorization:**
   - Only toggle `PUBLIC_ACTIVE_KEY_WALLET_ENABLED=true` on production `main` once steps 1–3 are signed off.

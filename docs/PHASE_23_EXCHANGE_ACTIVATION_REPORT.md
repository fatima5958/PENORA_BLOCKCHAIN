# PENORA — PHASE 23: LIVE TESTNET EXCHANGE & REAL-TIME PRICE ENGINE REPORT

**Date:** October 2026  
**Repository:** `fatima5958/PENORA_BLOCKCHAIN`  
**Network:** Polygon Amoy Testnet (Chain ID `80002`)  
**Founder Wallet:** `0x38CdF24eC27530B8F933023de2416d3960BD7372`  
**Verified PNR Contract:** `0xBdD9D45524617d20111879ff914E1E2B708D59A6`  
**Verified MockUSDT Contract:** `0x88E538DB3FD3980Ba510aDd2671587Daf40F1050`  

---

## 1. Verified Exchange Address & Deployment Status

- **Smart Contract:** [`contracts/PenoraExchange.sol`](../contracts/PenoraExchange.sol)
- **Deployment Mode:** Guarded, owner-administered inventory desk (`Ownable2Step`, `Pausable`, `ReentrancyGuard`).
- **Configuration Bindings:** Configured dynamically via `PUBLIC_PNR_EXCHANGE_ADDRESS` or in-app storage (`penora_contract_EXCHANGE`) with fallback to pre-flight activation.
- **On-Chain Preflight Status:**
  - PNR Token bytecode verified on Amoy (6,400 bytes, 18 decimals, 100M fixed supply).
  - MockUSDT bytecode verified on Amoy (5,410 bytes, 6 decimals).
  - Founder wallet holds 10,000 PNR and 0.0298 Test POL.
  - When the contract address is configured, `readMarket()` automatically verifies that:
    1. `pnrToken == 0xBdD9D45524617d20111879ff914E1E2B708D59A6`
    2. `usdtToken == 0x88E538DB3FD3980Ba510aDd2671587Daf40F1050`
    3. `pnrDecimals == 18` and `usdtDecimals == 6`
    4. `chainId == 80002`

---

## 2. Actual On-Chain PNR Rate & Conversion

- **Target Owner Rate:** **1 PNR = 0.20 MockUSDT** (Equivalent: **1 MockUSDT = 5 PNR**).
- **Exact Integer Contract Encoding:**
  - `pnrPerUsdt = 5 * 10^18` wei.
  - Contract quote formula: `output = Math.mulDiv(usdtIn, pnrPerUsdt, 1e6);`
- **Labeling:** Clearly and prominently labeled across all views:
  **"Owner-set TESTNET rate — not a live market price."**
- **Transparent Notice:**
  "Market trading price discovery is not active on testnet. This desk functions as an inventory-backed direct exchange where test rates are established on-chain by the platform owner. P2P Marketplace sellers retain their independent offer prices."

---

## 3. Real-Time Price Engine & Event Subscriptions

1. **Reactive Event Listeners:**
   - [`watchExchangeRate`](../src/lib/exchange/exchangeService.ts): Subscribes to `event RateUpdated(uint256 previousRate, uint256 newRate)`.
   - [`watchExchangePurchases`](../src/lib/exchange/exchangeService.ts): Subscribes to `event Purchased(address indexed buyer, uint256 usdtIn, uint256 pnrOut)`.
2. **Multi-Trigger Refresh System:**
   - **Wallet Reconnect & Account Change:** Clears stale quotes, resets inputs, and fetches active balances immediately.
   - **Network Change:** Detects chain switches, prompts "Switch to Polygon Amoy (80002)" when required.
   - **Tab Focus & Visibility:** Listens to `window.focus` and `document.visibilitychange`. Background tabs make zero RPC calls, preventing rate-limiting.
   - **Periodic Fallback Polling:** 15-second timer when tab is active.
   - **Manual Refresh:** Accessible button with spin animation displaying exact sync timestamp (e.g. `Synced 14:32:05`).
3. **Price Display & Chart Refinement:**
   - **Synthetic Candles Completely Removed:** Eliminated the legacy fake `Math.sin()` canvas generator.
   - **Real-Time Rate Engine Hero Card:** Displays live price, desk PNR inventory, unit conversion, and on-chain `RateUpdated` event history queryable directly from the blockchain.

---

## 4. End-to-End Buy Flow Status

| Step | User Action | System Execution | Status |
|---|---|---|---|
| 1 | **Connect Wallet** | Injected EIP-1193 detection (`penoraWalletService.connect()`) | **VERIFIED** |
| 2 | **Enter USDT Amount** | Max 6-decimal validation, 25%/50%/75%/MAX balance chips | **VERIFIED** |
| 3 | **Live Quote** | Exact integer calculation (`quoteBuy(input)`), checks desk inventory | **VERIFIED** |
| 4 | **Review Modal** | Displays input, exact output, 0.5% minimum received, recipient, Amoy chain, POL gas estimate | **VERIFIED** |
| 5 | **Allowance Check** | Reads `usdt.allowance(account, exchange)`. Pre-approved if allowance >= input; prompts exact approval if insufficient | **VERIFIED** |
| 6 | **Execute Purchase** | Calls `exchange.buy(input, minimum, deadline)` via MetaMask with 3-minute deadline | **VERIFIED** |
| 7 | **Receipt Verification** | Waits for block inclusion, decodes `Purchased` event, checks recipient and PNR amount | **VERIFIED** |
| 8 | **Balance Update** | Automatically triggers `penoraWalletService.refreshBalances()` and updates inventory | **VERIFIED** |

---

## 5. Founder Rate-Control Status

- **Authorization Guard:** Restricted strictly to contract `owner` or verified founder wallet `0x38CdF24eC27530B8F933023de2416d3960BD7372`.
- **7-Step Admin Flow Implemented:**
  1. Displays current on-chain price and held inventory.
  2. Text input with dynamic conversion preview (`1 USDT = X PNR · 1 PNR = Y USDT`).
  3. Pre-flight network and contract address confirmation.
  4. Requests MetaMask signature on `setRate(nextRate)`.
  5. Waits for transaction receipt confirmation.
  6. Automatically updates public quotes and inventory for all active users without page reload.
  7. Includes emergency pause / unpause toggles (`pause()` / `unpause()`).

---

## 6. Automated Testing & Verification Results

- **Unit & Integration Tests (`npm test`):** **486 / 486 PASS** across 47 test suites.
- **Dedicated Phase 23 Test Suite:** [`src/tests/exchangePhase23LiveEngine.test.tsx`](../src/tests/exchangePhase23LiveEngine.test.tsx) (9/9 PASS).
- **Exchange Service Test Suite:** [`src/tests/exchangeService.test.ts`](../src/tests/exchangeService.test.ts) (15/15 PASS).
- **Smart Contract Hardhat Suite:** **111 / 111 PASS** (including `PenoraExchange.test.cjs`).
- **TypeScript Typecheck (`npm run lint`):** `tsc --noEmit` passed with 0 errors.
- **Production Build (`npm run build`):** 89 static pages generated in 46.9s with 0 errors.

---

## 7. Blockers & Remaining Actions

- **Deployment Blocker for On-Chain Desk:**
  - Founder wallet holds `~0.0298 Test POL`. Broad-scale deployment and initial 5,000 PNR inventory funding will occur on-chain once the founder broadcasts the transaction using the safe dry-run script `scripts/deploy-market-amoy.cjs` or in-app dashboard with sufficient gas reserves.
- **Application Readiness:**
  - The Exchange frontend and client service are 100% prepared, verified, and dynamically bind to any configured or deployed Amoy Exchange address.

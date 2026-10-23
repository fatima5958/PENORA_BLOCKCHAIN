# PENORA — PHASE 20: COMPLETE WALLET UX REDESIGN PLAN

**Workspace:** `C:\dev\PENORA-CLEAN`  
**Branch:** `main`  
**Network:** Polygon Amoy Testnet (Chain ID `80002`)

---

## 1. Comprehensive Audit of Existing Wallet (`WalletView.tsx` & Related Files)

### Files Inspected
- `src/components/wallet/WalletView.tsx` (2,232 lines)
- `src/components/wallet/MobileWalletOverview.tsx` (77 lines)
- `src/components/wallet/WalletSection.tsx` (15 lines)
- `src/components/wallet/CreatorEarningsCard.tsx` (698 lines)
- `src/components/wallet/PowerDelegationCard.tsx` (464 lines)
- `src/components/wallet/RewardWalletLink.tsx` (40 lines)
- `src/components/wallet/CreatorRecipientPicker.tsx` (43 lines)
- `src/components/wallet/CreatorEconomyGuide.tsx` (239 lines)
- `src/components/exchange/ExchangeView.tsx` & `P2PMarketplaceView.tsx`
- `src/styles/wallet.css` (115 lines) & `src/styles/wallet-mobile.css` (69 lines)
- `src/tests/mobileWalletOverview.test.tsx`, `src/tests/walletTransactions.test.ts`, `src/tests/walletState.test.ts`, `src/tests/walletHybridV1.test.ts`

### 10 Core UX & Engineering Problems Identified

1. **Massive Duplication on Overview:**
   - Desktop `Overview` renders the 4-card balance grid, Web3 connection card, Voting Mana gauge, 3-step Testnet Faucet guide, 13-Week Power Down schedule, Key Architecture explanation, the **entire 700-line `CreatorEarningsCard`**, the **entire 240-line `CreatorEconomyGuide`**, `RewardWalletLink`, and an Exchange link banner simultaneously.
   - `CreatorEarningsCard` and `CreatorEconomyGuide` are rendered both on `Overview` AND on the `Earnings` tab.
   - Meanwhile, `Overview` on desktop lacks a **Recent Activity** preview, forcing users to hunt for the 9th tab (`Transaction History`).

2. **Misplaced Power Controls:**
   - The `power_system` ("Power") tab only displays three static informational boxes ("Instant Power Up", "13-Week Power Down", "5-Day Mana Recovery") while the actual **Power Up / Power Down actions**, **Voting Mana gauge**, and **13-Week Power Down Schedule & installment claim controls** were stranded on `Overview`/`details`.

3. **Excessive Cards, Gradients & Visual Clutter:**
   - Giant blurred background orbs (`500px` / `600px`), heavy multi-stop gradients on buttons and badges, and deeply nested cards inside cards create visual noise and scroll fatigue (>3,500px height on desktop Overview).

4. **Overloaded & Fragmented Navigation:**
   - Desktop uses a 9-tab horizontal pill bar (`Overview`, `Send / Withdraw`, `Receive`, `Deposit`, `Earnings`, `PNR Power`, `Delegation`, `Trade PNR`, `Transaction History`) that overflows on medium screens.
   - Mobile uses a separate DOM tree (`MobileWalletNavigation` + `MobileWalletOverview`) hidden via CSS media queries.

5. **Conflicting Responsive Breakpoints (`639px` vs `767px`):**
   - `wallet.css` applies mobile rules at `@media (max-width: 639px)`, while `wallet-mobile.css` hides `.wallet-page-heading`, `.wallet-tabs`, and `.wallet-full-overview` at `@media (max-width: 767px)`. Between `640px` and `767px`, rules conflict; below `360px`, the 5-item mobile nav bar cramps button text.

6. **Inconsistent Typography:**
   - Four font families (`Playfair Display` / serif, `Sora`, `Michroma`, `Inter`, plus `font-mono`) compete across desktop and mobile views.

7. **Redundant Disclaimers & Verbose Copy:**
   - Four separate testnet warning banners appear on the same screen. Long paragraphs of static protocol prose push actionable controls below the fold.

8. **Monolithic Component Architecture:**
   - `WalletView.tsx` is 2,232 lines long, mixing state subscriptions, gas estimation, QR generation, modal dialogs, and 9 tab layouts in one file.

9. **Dark Mode Contrast & Hardcoded Light Utilities:**
   - Several status banners and inputs use hardcoded light classes (`bg-slate-100`, `border-slate-200`, `bg-amber-50`) without dark theme surface tokens (`var(--wallet-inset)`, `var(--wallet-border)`).

10. **Dialog & Keyboard Accessibility Gaps:**
    - Transaction modals (`Send Confirm`, `Power Up`, `Power Down`) need Escape-key closing, backdrop click handling, scroll lock, and clean mobile bottom-sheet presentation.

---

## 2. Design Principles & Brand System

- **Aesthetic:** Minimal, high-trust fintech crypto wallet (clean surfaces, subtle 1px borders, tabular numerals, calm hierarchy).
- **Brand Palette:**
  - Deep Navy: `#0A2540` (Primary balance card surface & dark mode anchor)
  - Primary Teal: `#007C8B` (Interactive actions, active states, primary links)
  - Accent Cyan: `#00E5F4` (Subtle highlights on dark navy card & focus indicators)
  - Light Mode Surfaces: Background `#F4F7F9`, Card Surface `#FFFFFF`, Inset `#EEF3F6`, Text `#0A2540`, Muted `#52677D`, Border `rgba(10, 37, 64, 0.10)`
  - Dark Mode Surfaces: Background `#061522`, Card Surface `#0D2233`, Inset `#091926`, Text `#E8F3FA`, Muted `#94B0C5`, Border `rgba(148, 176, 197, 0.16)`
- **Typography:**
  - Coherent sans-serif UI (`Inter` / system sans) for headings, labels, and navigation, paired with `tabular-nums` / monospace for token quantities, addresses, and transaction hashes.

---

## 3. Information Architecture & 5-Item Navigation

Both Desktop and Mobile use a unified **5-item primary navigation**:

1. **Overview** (`overview`)
   - **Desktop Two-Column Layout:**
     - **Left / Main Column (7 cols):**
       1. **Primary Balance Card (`WalletBalanceCard`):** Available Liquid PNR, explicit `TESTNET · AMOY (80002)` badge, connected status/address bar, and 4 primary quick actions (**Send**, **Receive**, **Trade**, **Power Up**).
       2. **Your Assets List (`WalletAssetList`):** Clean vertical list with token icon, name, symbol, and actual on-chain balance for:
          - Liquid PNR (`PNR`)
          - PENORA Power (`PP`)
          - MockUSDT (`USDT`)
          - Test POL Gas (`POL`)
          - *(Zero fabricated USD/fiat prices).*
       3. **Recent Activity Preview (`WalletActivityPreview`):** Up to 3 recent transactions (Pending, Confirmed, Failed, or clean empty state) with a **"View all"** action linking to `Activity`.
     - **Right / Secondary Column (5 cols):**
       1. **Wallet Connection & Status Panel (`WalletConnectionPanel`):** Connect/Disconnect MetaMask, Switch to Polygon Amoy button when on wrong network, full/short address with Copy & PolygonScan link, and Test POL gas readiness.
       2. **PENORA Power & Mana Summary:** Staked PP, Voting Mana progress bar (5-day regeneration), active Power Down indicator, and quick link to `Power`.
       3. **Creator Earnings Summary:** Compact summary of claimable/pending PNR rewards and Verified Creator Wallet status with quick link to `Earnings`.
   - **Mobile Overview Layout (`< 768px`):**
     - **A. Compact Header:** "My Wallet" title, Amoy Testnet pill badge, and Light/Dark theme button (44×44px).
     - **B. Main Balance Card:** Available PNR, `TESTNET` badge, compact connected wallet address + copy + refresh button (or Connect / Switch Network CTA).
     - **C. Four Quick Actions:** **Send**, **Receive**, **Trade**, **More** (minimum 44×44px touch targets).
     - **D. Your Assets:** Vertical list of Liquid PNR, PENORA Power, MockUSDT, and Test POL gas balance.
     - **E. Recent Activity:** Up to 3 recent transactions with status pills and **"View all"** button.

2. **Activity** (`history`)
   - Full on-chain & locally tracked transaction history (USDT transfers, PNR transfers, Power Up, Power Down, installment claims, cancellations), status badges (`confirmed`, `pending`, `failed`), timestamps, PolygonScan explorer links, and refresh control.

3. **Earnings** (`earnings`)
   - Complete `CreatorEarningsCard` (Overview, Article Rewards, Curation, Comments, Beneficiaries, History, Economics + on-chain Liquid Claim & 100% Power Up Claim) and `RewardWalletLink` (Verify connected creator wallet).

4. **Power** (`power_system`)
   - Dedicated staking & governance center:
     - Staked PENORA Power balance & Liquid PNR available
     - **Power Up** and **Power Down** primary action buttons
     - **Voting Mana** gauge & regeneration details
     - **13-Week Power Down Schedule** tracker, **Claim Matured Installments** button, and **Cancel Remaining Schedule** button
     - Concise Power rules & embedded access to **Power Delegation** (`PowerDelegationCard`).

5. **More** (`details` / menu)
   - Direct access hub to all specialized workflows and guides:
     - **Send / Withdraw** (`send`)
     - **Receive & QR Code** (`receive`)
     - **Deposit & Live Transfer Monitor** (`deposit`)
     - **Trade PNR (Exchange & P2P Marketplace)** (`trade_pnr` + `/exchange`)
     - **Power Delegation** (`delegation`)
     - **Verified Creator Wallet Link** (`RewardWalletLink`)
     - **Testnet Faucet & Setup Guide** (Polygon Official Faucet, `/deploy-testnet`)
     - **Key Architecture & Creator Economy Guide** (`CreatorEconomyGuide`)

*(Note: All existing `WalletTab` values — `'overview' | 'deposit' | 'send' | 'receive' | 'history' | 'power_system' | 'delegation' | 'earnings' | 'trade_pnr' | 'details'` — remain 100% supported so any direct navigation or test callback continues to work seamlessly.)*

---

## 4. Complete Feature-Preservation Mapping

| Feature / Workflow | Original Location | Redesigned Location | Preserved 100%? |
|---|---|---|---|
| MetaMask Connect / Disconnect | `WalletView` right col & `MobileWalletOverview` | `WalletConnectionPanel` & `WalletBalanceCard` | ✅ Yes |
| Wrong Network Detection & Switch (`80002`) | `WalletView` & `MobileWalletOverview` | Header badge, `WalletBalanceCard`, `WalletConnectionPanel`, Send/Deposit views | ✅ Yes |
| Copy Address & PolygonScan Link | `WalletView` | `WalletBalanceCard`, `WalletConnectionPanel`, `WalletReceiveView` | ✅ Yes |
| Balance Refresh (`refreshAllBalances`) | `WalletView` | `WalletBalanceCard` & `WalletConnectionPanel` & `Activity` | ✅ Yes |
| Liquid PNR, PP, MockUSDT, Test POL Balances | 4-card grid & mobile list | `WalletBalanceCard` + `WalletAssetList` | ✅ Yes |
| Light / Dark Theme Toggle (`localStorage`) | Header button | `WalletHeader` (Desktop & Mobile) | ✅ Yes |
| Send PNR & Send MockUSDT (`asset` selector) | `send` tab | `WalletSendFlow` (`send` tab, reachable from Quick Actions & More) | ✅ Yes |
| Send to Verified Creator (`CreatorRecipientPicker`) | `send` tab | `WalletSendFlow` step 2 | ✅ Yes |
| Gas Estimation & POL Fee Check | `send` tab | `WalletSendFlow` step 4 | ✅ Yes |
| Transfer Review & Confirmation Modal | `showSendConfirmModal` | `WalletTransactionDialog` (Send Confirm) | ✅ Yes |
| Receive QR Code & Universal Address | `receive` tab | `WalletReceiveView` (`receive` tab, reachable from Quick Actions & More) | ✅ Yes |
| Deposit Monitor (`watchIncomingTransfers`) | `deposit` tab | `WalletReceiveView` / `deposit` tab (reachable from More & Quick Actions) | ✅ Yes |
| Power Up Modal (`executePowerUp`) | `showPowerUpModal` | `WalletPowerView` + `WalletBalanceCard` + `WalletTransactionDialog` | ✅ Yes |
| Power Down Modal & 13-Week Preview | `showPowerDownModal` | `WalletPowerView` + `WalletTransactionDialog` | ✅ Yes |
| Claim Matured Installments & Cancel Schedule | `Overview` / `details` | `WalletPowerView` (`power_system` tab) & `details` | ✅ Yes |
| Voting Mana Gauge | `Overview` right col | `WalletConnectionPanel` (Overview) & `WalletPowerView` (`power_system`) | ✅ Yes |
| Power Delegation (`PowerDelegationCard`) | `delegation` tab | `delegation` tab & `WalletPowerView` & `More` | ✅ Yes |
| Creator Earnings (`CreatorEarningsCard`) | `Overview` + `earnings` tab | `earnings` tab + compact summary on `Overview` | ✅ Yes |
| Verify Creator Reward Wallet (`RewardWalletLink`) | `Overview` | `earnings` tab & `More` (`details`) | ✅ Yes |
| Trade PNR (`P2PMarketplaceView` & `/exchange`) | `trade_pnr` tab + link | Quick Action `Trade`, `trade_pnr` tab, and `/exchange` link | ✅ Yes |
| Transaction History (`historyTransactions`) | `history` tab | `WalletActivityPreview` (3 items on Overview) + `WalletActivityView` (`history` tab) | ✅ Yes |
| Guides (`CreatorEconomyGuide`, Key Sep, Faucets) | `Overview` | `More` (`details` tab) & `Earnings` | ✅ Yes |

---

## 5. Refactored Component Hierarchy

```text
src/components/wallet/
├── WalletView.tsx                # State coordinator & tab router (clean, ~450 lines)
├── WalletHeader.tsx              # Unified responsive header (Title, Amoy badge, Theme toggle)
├── WalletNavigation.tsx          # 5-item primary navigation (Overview, Activity, Earnings, Power, More)
├── WalletBalanceCard.tsx         # Primary PNR balance, TESTNET badge, connection bar
├── WalletQuickActions.tsx        # Send, Receive, Trade, Power/More quick actions (44px+ targets)
├── WalletAssetList.tsx           # Clean 4-asset vertical list (PNR, PP, USDT, POL)
├── WalletActivityPreview.tsx     # 3-item recent transaction preview + "View all"
├── WalletConnectionPanel.tsx     # Desktop right-rail connection, gas, mana & earnings summary
├── WalletActivityView.tsx        # Full transaction history view with filter/refresh
├── WalletSendFlow.tsx            # Token selector, CreatorRecipientPicker, address, amount, gas & review
├── WalletReceiveView.tsx         # Receive QR code & Deposit live monitoring view
├── WalletPowerView.tsx           # Power Up/Down, Mana gauge, 13-week schedule, claims & delegation link
├── WalletMoreView.tsx            # Hub for Deposit, Delegation, RewardWalletLink, Faucet & Economy Guides
├── WalletTransactionDialog.tsx   # Accessible modal / mobile bottom-sheet for Send Confirm, Power Up & Power Down
└── MobileWalletOverview.tsx      # Backward-compatible mobile overview exports for existing unit tests
```

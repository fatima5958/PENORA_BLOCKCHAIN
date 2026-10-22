# PENORA Exchange

A dedicated `/exchange/` route adds an exchange terminal with the existing PENORA identity, a dark navy canvas, mint accents, responsive buy panel, chart display controls, market details, wallet navigation and an onchain receipt link. The wallet, sidebar and mobile/profile menus link to the exchange.

## Market model

This implementation is an **inventory-backed, owner-priced purchase desk**, not an order book, AMM, Binance integration or market listing. It supports buying liquid PNR with six-decimal test USDT. Sell orders, limit orders, live market charts and public order matching are not implemented. The chart is explicitly labelled illustrative/sample data and never supplies a trading quote. No trading volume, gain percentage, live market price, order depth or executed fills are fabricated.

The owner chooses the PNR-per-USDT rate and funds the desk with existing PNR inventory; the contract cannot mint PNR. The owner can change the rate, pause purchases and withdraw proceeds or inventory. Liquidity is therefore neither guaranteed nor locked. The frontend reads the actual rate and token balance onchain at a fixed block snapshot. Refresh bypasses the block-number cache after execution. Displayed desk fees are zero; the wallet charges network gas separately in POL. No price or initial rate is selected for the real deployment by this change.

## Buy flow

1. Connect an EIP-1193 wallet to Polygon Amoy (80002).
2. Enter an exact six-decimal USDT amount or use a balance percentage.
3. Request an onchain quote; verify desk token linkage, token decimals, pause state and available PNR inventory.
4. Review exact input, expected PNR, minimum PNR, recipient and network in the confirmation dialog. Quotes expire in 60 seconds; the minimum permits at most 0.5% adverse price movement.
5. Approve only the exact USDT input. A pre-existing nonzero allowance is reset first when necessary. Account/network checks repeat before every signature and after approval.
6. Simulate and submit `buy` with the reviewed minimum and a three-minute chain deadline. The contract atomically collects USDT and transfers PNR to the signer. Missing inventory, expired quotes, pause, insufficient allowance and low output revert without taking USDT.
7. Display success only after a successful receipt from the configured desk contains `Purchased` with the reviewed buyer/input and at least the minimum output. Pending approvals/purchases are persisted locally and block duplicate retries; `Check transaction status` reconciles them. A receipt without the expected event requires review rather than invented success. The last receipt link is shown for the current session, not a full lifetime trade ledger.

Fee-on-transfer tokens are rejected by contract balance-delta checks. Exact integer math converts USDT (6 decimals) to PNR (18 decimals). Reentrancy protection and two-step owner transfers use the repository's existing OpenZeppelin dependency. This is reviewed local implementation, not an independent security audit.

## Activation boundary

The UI works without configuration and explains that trading is not activated. Existing verified Amoy PNR and test-USDT deployments plus a funded, reviewed `PenoraExchange` deployment are required for actual buying. Set `PUBLIC_PNR_EXCHANGE_ADDRESS`, `PUBLIC_PNR_TOKEN_ADDRESS`, `PUBLIC_USDT_CONTRACT_ADDRESS` and `PUBLIC_AMOY_RPC_URL` at frontend build time. All are public configuration, not signing keys. No contract deployment, liquidity transfer, mainnet enablement or treasury spending was performed in this change. Browser wallet signatures remain user-controlled. External mobile wallet relay/WalletConnect support is not added; an injected wallet or wallet's built-in browser is required.

## Validation

- `npm run lint` and `npm run build` check the implementation and 31 routes.
- `npx hardhat test`: 56 contract checks, including nine purchase-desk tests for exact conversions, atomic delivery, rate changes, deadlines, liquidity, approvals, ownership, pause and token decimals.
- `npx vitest run src/tests/exchangeService.test.ts src/tests/walletState.test.ts src/tests/walletTransactions.test.ts src/tests/walletHybridV1.test.ts src/tests/usdtService.test.ts`: 93 checks, including 12 exchange checks for configuration, precise minimums, malformed amounts, stale quotes, changed accounts, pending persistence, exact approvals and receipt-event verification.
- `PENORA_WALLET_E2E=1 PENORA_EXCHANGE_E2E=1 npx hardhat run scripts/verify-exchange-local.cjs --network hardhat` runs an isolated browser → local RPC → actual Solidity scenario, builds the fixture with local addresses and never connects to Amoy. Playwright must be installed; `PENORA_PLAYWRIGHT_MODULE` and `PENORA_CHROMIUM_EXECUTABLE` can select an external local installation. The fixture buys 40 PNR for 2 test USDT at a **fixture-only** rate, verifies balances/allowance and receipt UI, tests insufficient liquidity without additional signatures, checks chart/details controls and takes screenshots at 360, 390, 768 and 1365 pixels without horizontal overflow or uncaught browser errors. No wallet private key is injected into the app.

During browser verification an SVG icon selector unintentionally enlarged chart controls, and SVG title hydration caused a recoverable React error. Both were fixed before the passing production-build browser run. External font/auth requests are blocked by the isolated fixture; no production auth connectivity is claimed.

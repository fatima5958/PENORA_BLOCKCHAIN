# PENORA embedded wallet — Polygon Amoy prototype

State: opt-in experimental branch. Not a verified live on-chain transaction.

## Architecture
- thirdweb SDK v5 email/Google in-app wallet + ERC-4337 smart account on Amoy chain 80002.
- Thirdweb EIP-1193 adapter into existing PENORA Viem wallet service (Send/Receive/Exchange/Power).
- MetaMask kept optional. PENORA does not collect or store private keys or seed phrases.
- Smart account has a NEW address. Existing MetaMask funds do not transfer automatically.
- thirdweb wallet authentication is separate from PENORA site login; secure identity linking needs future signed proof.
- Sponsored testnet gas must be validated with thirdweb paymaster; it does NOT cover founder contract deployments.

## Required public preview configuration
PUBLIC_EMBEDDED_WALLET_ENABLED=true
PUBLIC_THIRDWEB_CLIENT_ID=<public thirdweb client ID>
PUBLIC_AMOY_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com

Never expose secret API keys in PUBLIC_ variables. Configure allowlisted origins, rate limits and paymaster abuse protections.

## Required verification before release
1. npm install thirdweb (update package-lock), npm ci, npm run lint, npm test, npm run build.
2. Preview: email/Google authentication, refresh persistence, logout, new address.
3. No extension: balances and receive QR; test PNR/MockUSDT send with successful receipt.
4. MetaMask option: preserves separate address, never co-mingles old/new balances.
5. Exchange and Power: real receipts only AFTER Amoy contracts deployed and funded.
6. Sponsored gas: inspect receipt and verify user native Test POL unchanged.
7. Verify 320px mobile and 1366px desktop, no console errors.

Wallet UI is feature gated OFF until the public client ID and flag are set.

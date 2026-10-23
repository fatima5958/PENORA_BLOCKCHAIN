# PENORA — Active Key Built-in Wallet (Polygon Amoy prototype)

## Latest-change audit
Based on both latest main branches at commit f36ca6e: wallet button audit, responsive/mobile Trade shortcut, existing Penora Wallet components preserved. This experimental prototype branches from that state and does NOT overwrite main or activate production.

## Exact identity model
- PENORA's signup PDF already contains a **Private Active Key** in WIF encoding. The underlying authority uses Ed25519; this cannot directly sign secp256k1 Polygon EOA transactions.
- With the user's explicit entry of their existing Active Key, the browser verifies username + registered Active authority via the PENORA challenge login. Posting, Memo and Owner keys are rejected for wallet unlock.
- A domain-separated HKDF-SHA256 process deterministically derives a distinct **secp256k1 EVM signing key** in browser memory from the existing 32-byte Active Key seed. The derived key/address stays stable for an unchanged Active Key. It **is a new derived signing secret**, not a new download or separately user-managed signup key.
- The transaction signature is produced in browser memory; PENORA never sends the Active WIF/private key to the backend and does not persist it in localStorage or Supabase. On refresh/signout the user must unlock again.
- Explicit user confirmation is required for each transaction. Polygon Amoy only (80002). Legacy MetaMask remains available if the feature flag is off.
- EIP-1193 adapter reuses existing PENORA Send/Receive/Exchange/P2P/Power Viem interfaces. Never claim receipt success without on-chain verification.

## Security/release restrictions
**DO NOT switch production flag on without a third-party cryptography/security review.** An Active Key also controls important PENORA account permissions. If it is compromised, both account and derived EVM funds are at risk. Key rotation creates a different derived EVM address: plan migration/recovery *before* real funds. Browser XSS can attack in-memory signers; full CSP, wallet signing prompts and phishing mitigations are needed.

**No testnet gas sponsorship is implemented yet.** A derived EOA pays native Test POL on Amoy. To reach zero gas cost to users, implement a real sponsored ERC-4337 bundler/paymaster using this EVM signer (with quotas and abuse limits), then verify transactions and costs. The thirdweb email-based wallet prototype is deliberately NOT activated: it would create a second user-managed login contrary to the product requirement.

## Feature configuration
\`PUBLIC_ACTIVE_KEY_WALLET_ENABLED=false\` by default; only set to true on an isolated preview. Never put a WIF/seed/private key in Vercel env vars or repository.

## Verification checklist
- [ ] CI: npm ci / lint / vitest / Astro build
- [ ] Active WIF valid for current PENORA account; reject Posting/Owner/Memo
- [ ] Same Active WIF yields same EVM address; different WIF yields different
- [ ] Logout clears signer; explicit confirmation and wrong-chain rejection
- [ ] Browser test with no MetaMask, real wallet address and token balances (Amoy)
- [ ] Real PNR and MockUSDT transfer confirmed by block explorer
- [ ] Exchange and P2P deployed, funded and verified
- [ ] Real gas sponsorship integrated; 0 Test POL transfer tested
- [ ] Key rotation/recovery tested before mainnet

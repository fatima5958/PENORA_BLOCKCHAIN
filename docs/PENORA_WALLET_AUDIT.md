# Wallet audit checkpoint — 22 October 2026

Status: LOCAL_REVIEW_READY

This status applies to the completed local review/test scope only. Actual Amoy and authenticated backend verification remain outstanding; production readiness is not claimed.

Deployment is paused until the founder has tested and reviewed the changes. No pricing, market or new trading feature is included. A mobile home-screen web-app manifest and installation guide were added at the founder’s request.

## Fixed and verified locally

- Power actions validate the reviewed account before requesting a signature; account/network changes invalidate old UI confirmations, errors, modal timers and refresh responses.
- Exact uint256 amount limits, balance comparisons and 13-week withdrawal previews replace floating-point decisions. The final installment includes the remainder.
- Native POL reads retain full precision. Independent token balances remain available if only the native balance RPC fails; unverifiable balances are cleared and a refresh message appears.
- Network addition explicitly selects Amoy and resynchronizes providers that omit chainChanged. Provider disconnect clears wallet state.
- Real escrow events populate Power Up, Power Down, installment claim and cancellation history, alongside PNR/test-USDT transfers.
- Recent history queries use bounded 1,000-block pages across a 10,000-block window. Multiple logs in a transaction are preserved; self-transfer duplicate logs are collapsed by event identity.
- Failed history reads display an unavailable message instead of implying an empty onchain history. Incoming deposit timestamps use mined block time.
- Staking validates PNR decimals and escrow token linkage and refuses paused contracts, unavailable balance or insufficient available stake before a signature. Confirmations require the corresponding action event, not just EVM success.
- Pending power approvals/actions survive page reloads, retain replacement hashes, reconcile from receipts and block duplicate retries until the outcome is known.
- Gas estimation checks that native POL covers the estimated fee and no longer substitutes an invented fallback price; unavailable token balance is not described as zero.

## Validation

- TypeScript passed; the normal static production build generated all 30 routes successfully.
- 81 wallet regression/unit tests passed across four suites.
- All 41 Solidity tests passed on the isolated Hardhat chain, including full 13-week maturity/remainder, cancellation, solvency, voting replay, rewards/proofs and test-USDT transfers.
- Final combined local regression selection: all 192 checks passed across 14 suites, including the 81 wallet checks and 11 editor checks. Fixed Vitest discovery so `.test.tsx` files are included.
- The authentication broker test setup originally timed out because a local cryptography/migration-assertion suite called the real Supabase client. Isolated its remote dependency explicitly and renamed the suite to state its local scope. All 13 checks then passed; this establishes local broker behavior, not deployed database RLS. Other remote database/email integration suites were not rerun.
- Responsive browser checks passed at 360, 390, 768 and 1365 px in light and dark, with no horizontal overflow or uncaught browser errors. Theme persistence and wrong-network → Amoy switch → disconnect passed. Editor, feed, communities and own-profile routes rendered; this does not verify their authenticated backend behavior.
- Connected browser → local RPC → actual Solidity contracts passed: exact PNR/test-USDT transfers, approval plus 26-PNR Power Up, 13-PNR Power Down, week-one installment, cancellation and restored PP, incoming deposit and all four escrow history types. No uncaught browser errors. Switching accounts during an actual allowance approval prevented the subsequent staking signature and suppressed stale confirmation; disconnect cleared the connection. The first new race-test attempt exposed a fixture-only deadlock: the local chain did not produce another empty block after releasing a held receipt. Advancing the local head fixed the harness, and the complete scenario passed. Fixture production build passed as part of that harness.
- This validation used only an isolated local chain with chain ID 80002. It does not verify live Amoy deployment or production configuration.

## Remaining boundaries

- Confirm actual Amoy token, escrow and influence deployments, runtime addresses and funded test wallet before declaring live operation complete. No remote contracts were deployed or funded here.
- Recent event history is not a full lifetime indexer. A dropped transaction without a receipt remains unknown; the wallet does not invent success/failure. Replacement hashes seen while waiting are retained; replacements performed while the page is closed require chain/indexer reconciliation beyond the original-hash lookup.
- Reward settlement/proof provisioning and the authenticated PENORA-key-to-database session bridge require separate backend verification; local tests do not establish their production readiness.
- Community creation remains the approved one-time 30-PNR treasury policy, deferred pending verified wallet/treasury configuration.
- PNR market value and test buy/sell are later features; neither is activated by this patch.

## Founder review checklist

1. Check the wallet in light/dark mode and on mobile; switch between PNR and test USDT.
2. Connect a controlled Amoy wallet and confirm the account/network and actual contract addresses. If addresses are missing, unavailable controls must explain why; do not use mainnet funds.
3. Review a small token send: recipient, amount and fee. Rejecting a signature must never display success. A confirmed send must have the expected token transfer receipt.
4. Power Up a small PNR amount, then check approval, PP balance and separate history entries. Switching accounts during approval must not submit staking from another account.
5. Start Power Down and check the exact weekly/final installments and next unlock. Early claims stay unavailable; claims and cancellation update balances and history after confirmation.
6. Review pending actions and explorer links. A timeout is pending, not success, and a duplicate power submission must be blocked while its previous result is unknown.
7. Disconnect/switch account and verify no old balances or confirmation messages remain. A failed RPC lookup must show unavailable data rather than a fabricated zero.

The local browser regression covers actual contract execution with an isolated chain. Full 13-week time progression is exercised using local chain time controls, not by pretending that a live week elapsed. Real Amoy review requires the actual approved deployments and configuration above. No production branch push or Vercel deployment is part of this audit checkpoint.

## Mobile app-style link

Added `/manifest.webmanifest`, 192/512-pixel PNG icons derived from the existing SVG logo, an Apple home-screen icon and metadata, and an `/install/` guide. The app requests standalone display and launches `/wallet/`. No offline balance/transaction cache or service worker was introduced. This is a web-app installation setup, not an App Store/Play Store binary.

The new installation page is local until deployment. The existing published web wallet is https://penorablockchain.vercel.app/wallet/; it must not be presented as containing these unpublished changes. Mobile transaction signing currently requires an injected Web3 provider, such as the wallet’s built-in browser. A home-screen install by itself does not create a MetaMask connection; external mobile wallet relay/SDK integration has not been added.

Final mobile-install browser check: PASS. The rendered page links the manifest; standalone start URL and scope match; 192/512 PNG icons are served with the declared dimensions; the 360px installation guide has no overflow; Chromium reports no manifest errors or uncaught page errors. Actual installation on a physical Android/iOS device and external mobile wallet signing were not exercised.

No unresolved failures remain in the local checks listed above. Changes are prepared locally; no production push or deployment has been performed.

## Production release preparation

The founder subsequently authorized production deployment. Before pushing, both remote main branches were checked at `81c17f91e8ec16a7d22c8664f7427457c954dd07`, which adds the branded key-certificate PDF. Preserved that change and its jsPDF dependency. The combined build passed; all 196 selected local checks across 15 suites passed. Fixed the new PDF test fixture’s missing KeyPair role/public-byte fields so the combined TypeScript check can pass. Deployment permission covers the frontend release; no remote contracts or treasury transfers are included.

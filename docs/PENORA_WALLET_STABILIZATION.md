# Wallet and platform stabilization — 21 October 2026

## Release status

Code has been validated locally. **This is not a mainnet wallet release or a verified live-money deposit/withdrawal service.** No remote smart contracts, migrations, token allocations or treasury payments were deployed by this work.

The existing financial architecture remains provisional. This change preserves the Amoy-only target, voluntary Power Up, 13-week Power Down implementation, and unavailable PNR/USDT valuation shown as `— USDT`.

## Changes

- Shared ERC-20 flow for PNR and test USDT deposits, receiving addresses, gas review, sends and history, with separate asset histories.
- Exact integer amount parsing: excessive decimals, exponents, negative/zero amounts and separators are rejected instead of rounded.
- Transfers check the reviewed account, current account/network, configured contract, recipient, token balance and native gas balance before signing. Duplicate submissions are blocked.
- Confirmed token sends require the corresponding ERC-20 Transfer event. A receipt with no token movement is not labelled successful.
- RPC receipt timeouts remain pending. Cancelled/replaced actions cannot become false successes; repriced sends use their confirmed replacement hash.
- Power Up waits for confirmed allowance approval and rechecks the allowance/account/network before staking. Power Down claims and cancellations wait for confirmation.
- Available PP excludes stake already committed to Power Down. Missing voting-mana data is shown as unavailable, not a fabricated 100%.
- Deposit history is associated with the receiving wallet and uses mined block timestamps when queried. Local histories are scoped by chain, token contract, asset and account. Pending sends are reconciled on refresh.
- Account/network switching clears old balances and transaction forms; stale asynchronous results cannot repopulate a disconnected wallet. The initial React render is deterministic even when a wallet was already connected.
- Wallet light/dark preference persists; small-screen text, controls, modal scrolling and keyboard focus styling have been improved while retaining PENORA typography and palette.
- Voting now requires a matching authenticated Supabase user, respects database errors, and uses database counts. Upvote/downvote switching, toggling, duplicate-click handling and error rollback are shared across feed cards, the reader and creator profiles. Local-only votes are no longer misrepresented as saved votes.
- Community membership changes roll back when saving fails and do not carry join state across accounts.
- Removed the invented 1,200 followers / 320 following defaults from the user's profile. Profile loads now ignore responses from a previous account.
- Fixed missing icon imports and synchronized the dependency lockfile with the existing Markdown dependencies.

## Validation evidence

| Check | Result | Scope |
| --- | --- | --- |
| TypeScript | Passed | `npm run lint` |
| Static production build | Passed | 29 generated pages |
| App tests | 155 passed across 13 suites | Unit/mocked tests for wallet, voting, amounts, keys, email/OTP, persistence, drafts and security assertions. The full selected suite passed with 153 tests; the two added wallet-state regressions subsequently passed in the affected suite. |
| Solidity tests | 41 passed | Real Solidity 0.8.28 compilation and execution on an in-process Hardhat chain, including 13-week maturity, remainder, cancellation, solvency, vote replay, reward proofs and test USDT transfers. |
| Wallet browser layout | Passed | 360, 390, 768 and 1365 px in both light and dark; no horizontal overflow. |
| Browser flows | Passed | Theme persistence, missing-provider handling, token selection, disabled unavailable actions, wrong-network → Amoy switch → disconnect. No transaction signatures requested. |
| Other page rendering | Passed | Editor, feed, communities and own-profile routes rendered locally with no uncaught React errors. This is not authenticated backend verification. |

Browser verification blocked external HTTP calls and used an injected provider fixture for the network-switch scenario. It does not establish live RPC, authenticated Supabase RLS or deployed-contract correctness.

The repository-wide suite also contains tests that contact the remote Supabase project. The initial full run encountered timeouts and was interrupted by a cancelled network approval. Those checks are not reported as passing. Existing tests that simulate RLS predicates do not establish actual cross-user database isolation.

## Remaining external verification

1. Verify the deployed Amoy PNR, escrow, influence and test-USDT addresses and runtime configuration. No addresses are invented or populated by this change.
2. Exercise deposits/sends, failed/pending receipts, Power Up and a Power Down lifecycle with a controlled test wallet against those actual contracts. No mainnet transfers are enabled.
3. Validate the authenticated database session bridge for PENORA key login. A local key identity alone cannot bypass Supabase RLS; voting now reports that a session is required rather than pretending to save.
4. Run distinct authenticated User A/User B and anonymous integration tests against an approved database environment. Missing schema/session infrastructure must be fixed and verified before a platform-wide readiness claim.
5. Verify the production Vercel commit, build and live wallet after deployment. Project-detail access returned 403, and the separate live-page access request was rejected. Live verification therefore remains unavailable in this session.
6. Preserve the approved community-creation policy: **one-time 30 PNR to the project treasury**. Creation/payment activation remains deferred until the wallet and treasury configuration are confirmed; no fee is charged here.

The wallet targets Polygon Amoy chain 80002. The default public RPC was aligned with [Polygon's current network documentation](https://docs.polygon.technology/pos/reference/rpc-endpoints) and can be overridden using the public `PUBLIC_AMOY_RPC_URL` setting. Never place private service credentials in a `PUBLIC_` variable.

Transaction history currently combines recent ERC-20 logs with local send records. Complete historical indexing and all staking event history still need an indexer or a dedicated contract-event reader. Public testnet history lookup failures fall back to local records; this fallback is not proof of an empty onchain history.

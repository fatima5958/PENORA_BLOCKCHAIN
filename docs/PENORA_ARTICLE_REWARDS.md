# Article reward implementation — seven-day maturity

The founder's seven-day-per-blog requirement supersedes the old day-9 weekly review proposal for new article payouts. This implementation prepares the calculation, authoritative clock, Merkle allocations, contract enforcement and reader schedule. It does not activate live payouts.

## Publication and eligibility

Apply `supabase/migrations/0004_article_publication_clock.sql` to introduce server-controlled `published_at` and `payout_at`. The clock starts at first publication, not draft creation. Once published, the timestamp, article ID and author cannot be changed through updates. Editing/unpublishing/republishing does not reset the clock. Existing published posts with unknown first-publication timestamps remain unscheduled; no historical date is guessed.

The deadline is exactly 604,800 seconds. Reward votes at the exact deadline or later are excluded. A blog posted at 18:00 on October 22 is eligible from 18:00 on October 29, in the same fixed UTC offset. Eligibility is never reported as an already completed transfer.

## Calculation

`calculateArticleRewards` in `src/lib/rewards/articleRewards.ts` accepts a reserved funded batch budget in PNR base units and matured articles with verified onchain vote events.

1. Ignore self-votes and votes outside the publication window. Reject duplicate article IDs, duplicate event identities, duplicate eligible voter wallets, invalid addresses, negative influence and invalid amounts.
2. Net article weight = max(0, positive influence minus negative influence). Influence is the verified contract event's stake/mana-weighted value, not a simple count of likes.
3. Allocate 70% of the batch budget to authors and 20% to curators, weighted across the batch by each article's net influence.
4. Divide each article's curator portion among its eligible non-self positive voters, weighted by their recorded influence. Downvotes reduce payout but do not earn curation rewards.
5. Retain at least 10%, all rounding dust, and unused allocations in reserve. All token math uses integers; no fabricated USD price or fixed vote-to-dollar formula is used.

Example: with a funded 100 PNR batch and one positively weighted article with one eligible curator, author = 70 PNR, curator = 20 PNR, reserve = 10 PNR. This is an illustration of allocation, not a guaranteed payment per blog.

## Funding and actual payout

Deploy the NEW `PenoraArticleRewards` contract for this policy. Do not point the feature at the legacy `PenoraRewardDistributor`, which retains its old 48-hour epoch review for compatibility.

The trusted publication operator registers `articleContentId(post.id)`, the verified author's linked wallet, and the database's original publication timestamp. The operator is an explicit trust boundary: the contract cannot independently read Supabase or identify a blog's author. Wallet linkage must be verified by the backend before registration.

After maturity, use `buildArticleRewardProofs` for the actual deployed chain ID and distributor address. It creates domain-bound, double-hashed Merkle leaves containing chain ID, distributor, article ID, beneficiary and exact amount. Approve the allocated total PNR and call `settleArticle`. The contract pulls the exact funding, fixes the root permanently, and prevents repeated settlement of the same article. A zero-reward settlement uses zero root/budget and no token transfer.

The operator/relayer or beneficiary calls `claimArticleReward` for each proof. Anyone may relay, but tokens always transfer to the committed beneficiary. The contract enforces day-seven maturity, per-recipient single claim, per-article budget isolation, and total outstanding liabilities. Confirmed `ArticleRewardPaid` events are the payment source of truth. No browser timer, database-only status, or successful simulation proves an actual payout.

## Integration still required before real payments

- Apply the SQL migration through the connected database administrator. It is committed for review; it has not been applied to the user's database here.
- Deploy and verify `PenoraArticleRewards` on the intended testnet. No remote contract is deployed by this change.
- Configure the approved budget cadence and a deterministic complete settlement cohort. Reserve each batch budget once, persist its membership/idempotency key, and exclude previously settled articles. Splitting a cohort to reuse the same budget is invalid. Budget cadence is an operational policy still to be wired to the worker.
- Run a trusted indexer over canonical confirmed events from the approved voting contract, using each mined block's timestamp and a chainId:transactionHash:logIndex identity. Browser/local social votes must never enter the money calculation. The current social voting flow alone does not establish reward eligibility.
- Register verified publication times/wallets, fund roots and run a scheduled settlement/claim relayer. Actual transactions require gas and operational credentials/approvals; the frontend does not custody those keys.
- Expose verified allocations/proofs and confirmed payment history to the wallet, with explicit pending/failed states. The reader currently shows the payout window and honest awaiting-settlement status, without inventing a token amount.
- Reward timing is per article. There is no extra automatic 48-hour delay in the new contract. Indexer finality, funding or processing delays can delay an actual payment beyond the earliest eligibility time.

## Validation

- 15 calculation/proof tests: exact seven-day boundary, timezone equivalence, invalid dates, 70/20/10 splits, downvotes, self/late votes, zero budgets, rounding, duplicate prevention, large integers and odd-sized Merkle trees.
- 6 new local-chain tests exercise the actual production TypeScript proof builder against Solidity: early/at-deadline settlement, actual token transfers, relaying, single-claim enforcement, recipient/amount/article proof tampering, budget isolation, owner permissions, funding rollback, zero rewards and pause controls.
- Full existing and new Solidity regression: 47 passing.
- The publication trigger is also exercised in isolated PostgreSQL (PGlite): draft creation, direct publication, first publication, date/identity tampering, republish, legacy unknown dates and repeat migration.
- Live Amoy transactions, production database migration, real reward-pool funding and an automatic payout worker remain unverified/unconfigured. This implementation must not be presented as live automated payout capability.

## Durable preparation backend (22 October 2026)

The database publication clock, settlement ledger and wallet challenge migrations have been applied to the existing PENORA-Dev project (`ssjdirzophcveisnubwj`). The clock starts on first publication and cannot be reset by editing or republishing. Existing published posts with unknown publication dates remain unscheduled. A transaction that created and republished a temporary post was rolled back after verifying the live trigger.

Three standalone Vercel Node functions accompany the static Astro site:

- `POST /api/rewards/wallet`: validates the Supabase Auth token with `getUser`, issues an account-bound five-minute challenge, checks the EOA wallet signature and atomically consumes the nonce. A signature does not send tokens. Key-only local sessions cannot impersonate a Supabase account. Contract-wallet signatures are not yet supported.
- `GET /api/rewards/process` (also POST): requires the server `CRON_SECRET` bearer token. It selects a closed, matured cohort, reserves its budget once and indexes finalized canonical influence events. A lease and durable cursor let later invocations resume a long range. Provider errors or changed block hashes block the batch for operator review. It prepares deterministic allocation/proof records; it does not sign or broadcast transactions.
- `GET /api/rewards/article?id=<uuid>`: returns a summary for a currently published post. Prepared allocations explicitly have `paymentConfirmed: false`. Drafts are not exposed.

All five internal reward tables use RLS with no client policies and revoked browser grants. All six privileged reward RPCs deny `anon`/`authenticated` execution and allow only the service role. The service key belongs exclusively in the server environment. A missing-wallet cohort waits as a whole, while later verified cohorts may proceed; no author is silently removed from a cohort. Wallet changes affect future reservations, never an existing snapshot.

### Budget policy implemented by the preparation worker

The operator must explicitly configure a daily PNR cap. There is no default cap and configuration does not create or fund tokens. Each UTC day has 1,440 fixed minute slots: a slot receives `floor(dailyCap / 1440)` base units, with integer remainder assigned to 23:59 UTC. Articles maturing in that minute share its budget according to eligible net influence and the 70/20/10 split. Empty slots are not carried over. Once any slot is reserved, that day's cap is fixed. Retries retain the original cohort, budget, block anchor and vote source; they cannot allocate it again. This minute-slot policy is explicit and should be reviewed before financial activation.

### Server configuration and activation

Set the following as server-only environment variables, never `PUBLIC_*`:

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET                       # at least 32 characters
REWARDS_RPC_URL                   # HTTPS Amoy RPC with finalized/history/log support
REWARDS_ARTICLE_CONTRACT          # deployed PenoraArticleRewards, not legacy weekly distributor
REWARDS_INFLUENCE_CONTRACT        # verified PenoraVotingInfluence deployment
REWARDS_INFLUENCE_START_BLOCK      # its actual deployment block
REWARDS_DAILY_BUDGET_PNR           # explicit positive decimal PNR amount, at most 18 decimals
```

No scheduler has been enabled and no production environment values have been supplied by this change. The local environment has none of these configured. Activation requires a verified Amoy deployment, a funded reward pool, server configuration, a scheduler appropriate to the hosting plan, and an authenticated end-to-end run. The worker relies on a trusted archival RPC for complete logs. It processes up to 10,000 blocks per invocation and can need multiple invocations for a seven-day window. Eligibility starts after seven days; processing and chain confirmation can finish later.

**Prepared is not paid.** A funded settlement operator still has to register each immutable publication on the new distributor, submit its immutable root/budget after maturity, and relay claims to the committed recipients. There is currently no automatic transaction signer/relayer or confirmed-payment reconciliation worker. Do not enable a UI `Paid` status or promise automatic transfers from this preparation endpoint.

### Verification

`npx vitest run src/tests/articleRewards.test.ts src/tests/rewardWorker.test.ts src/tests/rewardWalletApi.test.ts` checks calculation boundaries, canonical log handling, configuration, request authentication, durable progress and actual EOA signatures (including wrong signer, changed message, expired/used nonce and consume races).

For isolated PostgreSQL verification install `@electric-sql/pglite@0.3.14` outside the repository, then run:

```
PGLITE_MODULE_PATH=/absolute/path/node_modules/@electric-sql/pglite node scripts/check-reward-ledger.cjs
```

The 27 PostgreSQL assertions exercise publication immutability, wallet expiry/replay/rate limits, cohort selection without starvation, exact large-integer budgets, concurrent lease rejection, cursor resumption, immutable plans and browser privilege denial. Live role-grant checks also confirm the six RPCs deny browser access.

The Supabase advisor reports INFO notices for the five deliberately service-only RLS tables without client policies. Existing warnings for unrelated trigger-function grants and password settings predate these migrations; these are recorded here rather than expanding this reward change into an authentication migration. Advisor guidance: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy and https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable .

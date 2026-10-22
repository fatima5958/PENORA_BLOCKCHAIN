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

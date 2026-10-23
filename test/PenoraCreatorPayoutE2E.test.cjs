const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Compile the production Merkle and reward calculation modules so tests verify real TS code
function loadTsModule(relativePath) {
  const filename = path.resolve(__dirname, relativePath);
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = module.paths;
  const raw = fs.readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(raw, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  m._compile(transpiled, filename);
  return m.exports;
}

const { articleContentId, buildArticleRewardProofs } = loadTsModule('../src/lib/rewards/merkle.ts');
const { calculateArticleRewards } = loadTsModule('../src/lib/rewards/articleRewards.ts');

describe('PENORA Phase 3: First End-to-End Verified Creator Payout Pipeline', function () {
  let token, rewards, owner, creator, curator1, curator2, attacker;
  const SEVEN_DAYS = 7 * 86400;

  beforeEach(async () => {
    [owner, creator, curator1, curator2, attacker] = await ethers.getSigners();

    // 1. Deploy Model A PNR Token (100M Genesis, owner receives total supply for distribution)
    const PenoraToken = await ethers.getContractFactory('PenoraToken');
    token = await PenoraToken.deploy(owner.address, ethers.ZeroAddress, 0);

    // 2. Deploy PenoraArticleRewards contract
    const PenoraArticleRewards = await ethers.getContractFactory('PenoraArticleRewards');
    rewards = await PenoraArticleRewards.deploy(await token.getAddress(), owner.address);

    // Initial check: creator and curators start with 0 PNR
    expect(await token.balanceOf(creator.address)).to.equal(0n);
    expect(await token.balanceOf(curator1.address)).to.equal(0n);
  });

  it('executes complete 7-step creator reward lifecycle with accelerated time travel', async () => {
    // ── STEP 1: Creator publishes an article ─────────────────────────────────
    const articleRawId = 'article-steemit-payout-001';
    const articleIdBytes = articleContentId(articleRawId);
    const publishedAt = await time.latest();

    await rewards.registerArticle(articleIdBytes, creator.address, publishedAt);
    expect(await rewards.payoutAt(articleIdBytes)).to.equal(publishedAt + SEVEN_DAYS);

    // ── STEP 2: Verified test wallets cast curation upvotes ──────────────────
    const publishedIso = new Date(publishedAt * 1000).toISOString();
    const voteTimeMs = (publishedAt + 3600) * 1000; // 1 hour into 7-day window

    const articleData = {
      id: articleRawId,
      author: creator.address,
      publishedAt: publishedIso,
      votes: [
        {
          eventId: '80002:0xabc1:0',
          voter: curator1.address,
          direction: 1,
          effectiveInfluence: 50_000n, // Stake-weighted influence
          timestampMs: voteTimeMs,
        },
        {
          eventId: '80002:0xabc2:1',
          voter: curator2.address,
          direction: 1,
          effectiveInfluence: 50_000n,
          timestampMs: voteTimeMs + 1000,
        },
      ],
    };

    // ── STEP 3: Seven-day maturation requirement ─────────────────────────────
    const network = await ethers.provider.getNetwork();
    const chainId = network.chainId;
    const rewardsAddress = await rewards.getAddress();
    const batchBudget = ethers.parseEther('1000'); // 1,000 PNR total settlement budget

    // Attempting settlement before 7 days must strictly revert
    await time.setNextBlockTimestamp(publishedAt + SEVEN_DAYS - 10);
    const earlyCalculation = calculateArticleRewards([articleData], batchBudget, (publishedAt + SEVEN_DAYS) * 1000);
    const earlyProofs = buildArticleRewardProofs(earlyCalculation.allocations[0], chainId, rewardsAddress);

    await token.approve(rewardsAddress, batchBudget);
    await expect(
      rewards.settleArticle(articleIdBytes, earlyProofs.root, earlyProofs.budget)
    ).to.be.revertedWithCustomError(rewards, 'RewardWindowActive');

    // ── STEP 4: Backend calculates verified 70/20/10 split ────────────────────
    // Fast-forward time to exactly 7 days + 1 second
    await time.increaseTo(publishedAt + SEVEN_DAYS + 1);
    const maturityTimestampMs = (publishedAt + SEVEN_DAYS + 1) * 1000;

    const calculation = calculateArticleRewards([articleData], batchBudget, maturityTimestampMs);

    // 70% author ($700 PNR), 20% curators ($200 PNR divided equally), 10% reserve ($100 PNR retained)
    expect(calculation.allocations[0].authorAmount).to.equal(ethers.parseEther('700'));
    expect(calculation.allocations[0].curatorAmount).to.equal(ethers.parseEther('200'));
    expect(calculation.reserve).to.equal(ethers.parseEther('100'));

    // ── STEP 5: Merkle proof generation & funded settlement ──────────────────
    const tree = buildArticleRewardProofs(calculation.allocations[0], chainId, rewardsAddress);
    expect(tree.claims).to.have.lengthOf(3); // Creator + Curator1 + Curator2

    // Operator settles article and funds contract
    const settleTx = await rewards.settleArticle(articleIdBytes, tree.root, tree.budget);
    await expect(settleTx)
      .to.emit(rewards, 'ArticleSettled')
      .withArgs(articleIdBytes, tree.root, tree.budget);

    expect(await rewards.totalOutstanding()).to.equal(tree.budget);
    expect(await token.balanceOf(rewardsAddress)).to.equal(tree.budget);

    // ── STEP 6: Creator claims 70% PNR reward ────────────────────────────────
    const creatorClaim = tree.claims.find(c => c.account.toLowerCase() === creator.address.toLowerCase());
    expect(creatorClaim).to.not.be.undefined;
    expect(creatorClaim.amount).to.equal(ethers.parseEther('700'));

    const claimTx = await rewards.connect(creator).claimArticleReward(
      articleIdBytes,
      creatorClaim.account,
      creatorClaim.amount,
      creatorClaim.proof
    );

    // ── STEP 7: Confirm onchain token receipt & transaction receipt ──────────
    const receipt = await claimTx.wait();
    expect(receipt.status).to.equal(1); // Confirmed on blockchain

    await expect(claimTx)
      .to.emit(rewards, 'ArticleRewardPaid')
      .withArgs(articleIdBytes, creator.address, ethers.parseEther('700'));

    // Creator balance increased by exactly 700 PNR
    expect(await token.balanceOf(creator.address)).to.equal(ethers.parseEther('700'));

    // ── Curators claim their 10% shares (100 PNR each) ───────────────────────
    for (const curator of [curator1, curator2]) {
      const claim = tree.claims.find(c => c.account.toLowerCase() === curator.address.toLowerCase());
      await rewards.connect(curator).claimArticleReward(articleIdBytes, claim.account, claim.amount, claim.proof);
      expect(await token.balanceOf(curator.address)).to.equal(ethers.parseEther('100'));
    }

    // Total outstanding liability in rewards contract is now 0
    expect(await rewards.totalOutstanding()).to.equal(0n);

    // ── Security Invariant: Duplicate claims must strictly revert ────────────
    await expect(
      rewards.connect(creator).claimArticleReward(articleIdBytes, creatorClaim.account, creatorClaim.amount, creatorClaim.proof)
    ).to.be.revertedWithCustomError(rewards, 'AlreadyClaimed');

    // ── Security Invariant: Attacker forged claim must strictly revert ────────
    await expect(
      rewards.connect(attacker).claimArticleReward(articleIdBytes, attacker.address, creatorClaim.amount, creatorClaim.proof)
    ).to.be.revertedWithCustomError(rewards, 'InvalidAllocation');
  });
});

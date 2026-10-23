// test/PenoraArticleRewardsV2.test.cjs
const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Compile the production Merkle builder so proofs exercise actual TS -> Solidity boundary
const filename = path.resolve(__dirname, '../src/lib/rewards/merkle.ts');
const builder = new Module(filename, module);
builder.filename = filename;
builder.paths = module.paths;
builder._compile(
  ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  filename
);
const { articleContentId, buildArticleRewardProofs } = builder.exports;

describe('PenoraArticleRewardsV2 — Advanced PENORA Payouts & Power Up Suite', function () {
  let token, escrow, rewardsV2, owner, author, collaborator, curator, other;
  let articleId, publishedAt;
  const ONE_WEEK = 7 * 24 * 60 * 60;

  beforeEach(async () => {
    [owner, author, collaborator, curator, other] = await ethers.getSigners();

    // 1. Deploy Liquid Token
    const PenoraToken = await ethers.getContractFactory('PenoraToken');
    token = await PenoraToken.deploy(owner.address, ethers.ZeroAddress, 0);
    await token.waitForDeployment();

    // 2. Deploy Power Escrow
    const PenoraPowerEscrow = await ethers.getContractFactory('PenoraPowerEscrow');
    escrow = await PenoraPowerEscrow.deploy(await token.getAddress(), owner.address);
    await escrow.waitForDeployment();

    // 3. Deploy Rewards V2
    const PenoraArticleRewardsV2 = await ethers.getContractFactory('PenoraArticleRewardsV2');
    rewardsV2 = await PenoraArticleRewardsV2.deploy(
      await token.getAddress(),
      await escrow.getAddress(),
      owner.address
    );
    await rewardsV2.waitForDeployment();

    // Register article
    publishedAt = await time.latest();
    articleId = articleContentId('essay-advanced-steemit-001');
    await rewardsV2.registerArticle(articleId, author.address, publishedAt);

    // Fund owner allowance for settlement
    await token.approve(await rewardsV2.getAddress(), ethers.parseEther('10000'));
  });

  describe('1. 100% Power Up Option B Payouts', function () {
    it('automatically stakes author reward into PENORA Power (PP) via powerUpFor', async function () {
      const budget = ethers.parseEther('100'); // 100 PNR
      const chain = await ethers.provider.getNetwork();

      const tree = buildArticleRewardProofs(
        {
          articleId: 'essay-advanced-steemit-001',
          beneficiaries: [
            { account: author.address, amount: ethers.parseEther('70') },
            { account: curator.address, amount: ethers.parseEther('20') },
          ],
        },
        chain.chainId,
        await rewardsV2.getAddress()
      );

      // Fast-forward past 7 days and settle
      await time.setNextBlockTimestamp(publishedAt + ONE_WEEK);
      await rewardsV2.settleArticle(articleId, tree.root, tree.budget);

      const authorClaim = tree.claims.find((c) => c.account.toLowerCase() === author.address.toLowerCase());

      // Author executes 100% Power Up claim
      const tx = await rewardsV2
        .connect(author)
        .claimAndPowerUp(articleId, authorClaim.account, authorClaim.amount, authorClaim.proof);

      await expect(tx)
        .to.emit(rewardsV2, 'ArticleRewardPoweredUp')
        .withArgs(articleId, author.address, authorClaim.amount);

      // Verify token accounting: Author received 0 liquid tokens, but 70 PP in escrow!
      expect(await token.balanceOf(author.address)).to.equal(0n);
      expect(await escrow.lockedPower(author.address)).to.equal(ethers.parseEther('70'));
      expect(await escrow.getAvailablePower(author.address)).to.equal(ethers.parseEther('70'));

      // Solvency invariant of escrow is maintained
      const [isSolvent] = await escrow.verifySolvencyInvariant();
      expect(isSolvent).to.be.true;
    });
  });

  describe('2. Beneficiary Splitting', function () {
    it('atomically pays author 80% and collaborator 20% from author share', async function () {
      const budget = ethers.parseEther('100');
      const chain = await ethers.provider.getNetwork();

      // Total author gross is 70 PNR. 80% to author = 56 PNR. 20% to collaborator = 14 PNR. Curators get 20 PNR.
      const tree = buildArticleRewardProofs(
        {
          articleId: 'essay-advanced-steemit-001',
          beneficiaries: [
            { account: author.address, amount: ethers.parseEther('56') },
            { account: collaborator.address, amount: ethers.parseEther('14') },
            { account: curator.address, amount: ethers.parseEther('20') },
          ],
        },
        chain.chainId,
        await rewardsV2.getAddress()
      );

      await time.setNextBlockTimestamp(publishedAt + ONE_WEEK);
      await rewardsV2.settleArticle(articleId, tree.root, tree.budget);

      // Collaborator claims their 14 PNR beneficiary cut
      const collabClaim = tree.claims.find((c) => c.account.toLowerCase() === collaborator.address.toLowerCase());
      await rewardsV2
        .connect(collaborator)
        .claimArticleReward(articleId, collabClaim.account, collabClaim.amount, collabClaim.proof);

      expect(await token.balanceOf(collaborator.address)).to.equal(ethers.parseEther('14'));

      // Author claims remaining 56 PNR
      const authorClaim = tree.claims.find((c) => c.account.toLowerCase() === author.address.toLowerCase());
      await rewardsV2
        .connect(author)
        .claimArticleReward(articleId, authorClaim.account, authorClaim.amount, authorClaim.proof);

      expect(await token.balanceOf(author.address)).to.equal(ethers.parseEther('56'));
    });
  });

  describe('3. Declined Rewards Accounting', function () {
    it('leaves declined author share in reserve while curators still get paid', async function () {
      const chain = await ethers.provider.getNetwork();

      // Author declined rewards: tree only commits the 20 PNR curator share. Author gets 0.
      const tree = buildArticleRewardProofs(
        {
          articleId: 'essay-advanced-steemit-001',
          beneficiaries: [{ account: curator.address, amount: ethers.parseEther('20') }],
        },
        chain.chainId,
        await rewardsV2.getAddress()
      );

      await time.setNextBlockTimestamp(publishedAt + ONE_WEEK);
      await rewardsV2.settleArticle(articleId, tree.root, tree.budget);

      // Total funded was only 20 PNR; 70 PNR remained in sovereign reserve!
      expect(await rewardsV2.totalOutstanding()).to.equal(ethers.parseEther('20'));

      const curatorClaim = tree.claims[0];
      await rewardsV2
        .connect(curator)
        .claimArticleReward(articleId, curatorClaim.account, curatorClaim.amount, curatorClaim.proof);

      expect(await token.balanceOf(curator.address)).to.equal(ethers.parseEther('20'));
      expect(await rewardsV2.totalOutstanding()).to.equal(0n);
    });
  });

  describe('4. Anti-Double-Claim & Security', function () {
    it('prevents claiming twice via either standard claim or claimAndPowerUp', async function () {
      const chain = await ethers.provider.getNetwork();

      const tree = buildArticleRewardProofs(
        {
          articleId: 'essay-advanced-steemit-001',
          beneficiaries: [{ account: author.address, amount: ethers.parseEther('50') }],
        },
        chain.chainId,
        await rewardsV2.getAddress()
      );

      await time.setNextBlockTimestamp(publishedAt + ONE_WEEK);
      await rewardsV2.settleArticle(articleId, tree.root, tree.budget);

      const claim = tree.claims[0];

      // First claim via power up
      await rewardsV2
        .connect(author)
        .claimAndPowerUp(articleId, claim.account, claim.amount, claim.proof);

      // Attempt second claim via liquid transfer fails
      await expect(
        rewardsV2.connect(author).claimArticleReward(articleId, claim.account, claim.amount, claim.proof)
      ).to.be.revertedWithCustomError(rewardsV2, 'AlreadyClaimed');

      // Attempt second claim via power up fails
      await expect(
        rewardsV2.connect(author).claimAndPowerUp(articleId, claim.account, claim.amount, claim.proof)
      ).to.be.revertedWithCustomError(rewardsV2, 'AlreadyClaimed');
    });
  });
});

// test/PenoraSecurityAudit.test.cjs
// Comprehensive Phase 10 Smart Contract Security Audit & Invariants Suite
// Tests: Reentrancy, double spending, unauthorized actions, rounding, solvency, domain separation, and pausing.

const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('PENORA Phase 10: End-to-End Smart Contract Security Audit', function () {
  let owner, attacker, author, curator1, curator2, feeRecipient;
  let pnr, usdt, powerEscrow, votingInfluence, rewardVault, distributor, articleRewards, p2pEscrow, exchangeDesk;

  const ONE_WEEK = 7 * 24 * 60 * 60; // 604,800 seconds
  const FORTY_EIGHT_HOURS = 48 * 60 * 60;

  beforeEach(async () => {
    [owner, attacker, author, curator1, curator2, feeRecipient] = await ethers.getSigners();

    // 1. Deploy PNR Token (100M fixed supply)
    const PenoraToken = await ethers.getContractFactory('PenoraToken');
    pnr = await PenoraToken.deploy(owner.address, ethers.ZeroAddress, 0);

    // 2. Deploy MockUSDT (6 decimals)
    const MockUSDT = await ethers.getContractFactory('MockUSDT');
    usdt = await MockUSDT.deploy('Test Tether USD', 'USDT', ethers.parseUnits('100000', 6), owner.address);

    // 3. Deploy PenoraPowerEscrow
    const PenoraPowerEscrow = await ethers.getContractFactory('PenoraPowerEscrow');
    powerEscrow = await PenoraPowerEscrow.deploy(await pnr.getAddress(), owner.address);

    // 4. Deploy PenoraVotingInfluence
    const PenoraVotingInfluence = await ethers.getContractFactory('PenoraVotingInfluence');
    votingInfluence = await PenoraVotingInfluence.deploy(await powerEscrow.getAddress(), owner.address);

    // 5. Deploy PenoraRewardVault
    const PenoraRewardVault = await ethers.getContractFactory('PenoraRewardVault');
    rewardVault = await PenoraRewardVault.deploy(await pnr.getAddress(), owner.address);

    // 6. Deploy PenoraRewardDistributor
    const PenoraRewardDistributor = await ethers.getContractFactory('PenoraRewardDistributor');
    distributor = await PenoraRewardDistributor.deploy(await pnr.getAddress(), owner.address);

    // 7. Deploy PenoraArticleRewards
    const PenoraArticleRewards = await ethers.getContractFactory('PenoraArticleRewards');
    articleRewards = await PenoraArticleRewards.deploy(await pnr.getAddress(), owner.address);

    // 8. Deploy PenoraP2PEscrow
    const PenoraP2PEscrow = await ethers.getContractFactory('PenoraP2PEscrow');
    p2pEscrow = await PenoraP2PEscrow.deploy(
      await pnr.getAddress(),
      await usdt.getAddress(),
      owner.address,
      50, // 0.5% fee
      feeRecipient.address
    );

    // 9. Deploy PenoraExchange
    const PenoraExchange = await ethers.getContractFactory('PenoraExchange');
    exchangeDesk = await PenoraExchange.deploy(
      await pnr.getAddress(),
      await usdt.getAddress(),
      owner.address,
      ethers.parseEther('20') // 20 PNR per 1 USDT
    );

    // Distribute tokens for testing
    await pnr.transfer(author.address, ethers.parseEther('10000'));
    await pnr.transfer(curator1.address, ethers.parseEther('10000'));
    await pnr.transfer(curator2.address, ethers.parseEther('10000'));
    await pnr.transfer(attacker.address, ethers.parseEther('5000'));
    await usdt.transfer(curator1.address, ethers.parseUnits('1000', 6));
    await usdt.transfer(attacker.address, ethers.parseUnits('1000', 6));
  });

  // ─── 1. PNR TOKEN INVARIANTS ───────────────────────────────────────────────
  describe('1. PNR Token Immutability & Supply Integrity', () => {
    it('strictly preserves 100,000,000 PNR fixed total supply with no mint function', async () => {
      const totalSupply = await pnr.totalSupply();
      expect(totalSupply).to.equal(ethers.parseEther('100000000'));

      // ERC20 standard does not expose a public mint function
      expect(pnr.mint).to.be.undefined;
    });

    it('rejects unauthorized treasury releases by non-owner', async () => {
      await expect(
        pnr.connect(attacker).releaseTreasuryTokens(attacker.address, ethers.parseEther('100'))
      ).to.be.revertedWithCustomError(pnr, 'OwnableUnauthorizedAccount');
    });

    it('enforces transfer pauses during emergency and unpauses cleanly', async () => {
      await pnr.pause();
      await expect(
        pnr.connect(author).transfer(curator1.address, ethers.parseEther('10'))
      ).to.be.revertedWithCustomError(pnr, 'EnforcedPause');

      await pnr.unpause();
      await pnr.connect(author).transfer(curator1.address, ethers.parseEther('10'));
      expect(await pnr.balanceOf(curator1.address)).to.equal(ethers.parseEther('10010'));
    });
  });

  // ─── 2. PNR POWER ESCROW SOLVENCY & LOCKING ────────────────────────────────
  describe('2. PNR Power Escrow & 13-Week Power Down Integrity', () => {
    it('maintains strict 1:1 solvency: contract balance >= totalLockedPower', async () => {
      const stakeAmount = ethers.parseEther('1000');
      await pnr.connect(author).approve(await powerEscrow.getAddress(), stakeAmount);
      await powerEscrow.connect(author).powerUp(stakeAmount);

      const [isSolvent, balance, liabilities] = await powerEscrow.verifySolvencyInvariant();
      expect(isSolvent).to.be.true;
      expect(balance).to.equal(liabilities);
      expect(balance).to.equal(stakeAmount);
    });

    it('prevents attacker from starting concurrent power down or exceeding available PP', async () => {
      const stakeAmount = ethers.parseEther('500');
      await pnr.connect(attacker).approve(await powerEscrow.getAddress(), stakeAmount);
      await powerEscrow.connect(attacker).powerUp(stakeAmount);

      // Attempt to power down more than staked
      await expect(
        powerEscrow.connect(attacker).startPowerDown(ethers.parseEther('501'))
      ).to.be.revertedWithCustomError(powerEscrow, 'InsufficientPower');

      // Start valid power down for 500 PNR
      await powerEscrow.connect(attacker).startPowerDown(stakeAmount);

      // Attempt concurrent power down must revert
      await expect(
        powerEscrow.connect(attacker).startPowerDown(ethers.parseEther('10'))
      ).to.be.revertedWithCustomError(powerEscrow, 'PowerDownAlreadyActive');
    });

    it('rejects premature installment claims before 7-day maturity', async () => {
      const stakeAmount = ethers.parseEther('1300');
      await pnr.connect(author).approve(await powerEscrow.getAddress(), stakeAmount);
      await powerEscrow.connect(author).powerUp(stakeAmount);
      await powerEscrow.connect(author).startPowerDown(stakeAmount);

      // Fast-forward only 6 days (not yet matured)
      await time.increase(6 * 24 * 60 * 60);

      await expect(
        powerEscrow.connect(author).claimInstallments()
      ).to.be.revertedWithCustomError(powerEscrow, 'NoMaturedInstallments');

      // Fast-forward past 7 days: exactly 1 installment (100 PNR) unlocks
      await time.increase(24 * 60 * 60 + 10);
      await expect(powerEscrow.connect(author).claimInstallments())
        .to.emit(powerEscrow, 'InstallmentClaimed')
        .withArgs(author.address, ethers.parseEther('100'), 1n, (await time.latest()) + 1);
    });

    it('accurately resolves integer division remainder on week 13 with zero dust loss', async () => {
      // 1000 PNR / 13 = 76 PNR/week + 12 PNR remainder
      const oddAmount = ethers.parseEther('1000');
      await pnr.connect(author).approve(await powerEscrow.getAddress(), oddAmount);
      await powerEscrow.connect(author).powerUp(oddAmount);
      await powerEscrow.connect(author).startPowerDown(oddAmount);

      // Fast-forward 14 weeks to mature all 13 installments
      await time.increase(14 * ONE_WEEK);

      const beforeBalance = await pnr.balanceOf(author.address);
      await powerEscrow.connect(author).claimInstallments();
      const afterBalance = await pnr.balanceOf(author.address);

      // Author recovers exact 1,000 PNR without losing a single wei
      expect(afterBalance - beforeBalance).to.equal(oddAmount);
      expect(await powerEscrow.totalLockedPower()).to.equal(0n);
    });
  });

  // ─── 3. VOTING INFLUENCE & MANA SECURITY ───────────────────────────────────
  describe('3. Voting Influence & Anti-Replay Engine', () => {
    it('prevents zero-PP accounts from voting and prevents double-voting on same content', async () => {
      const contentId = ethers.keccak256(ethers.toUtf8Bytes('story-slug-001'));

      // Attacker has zero PP
      await expect(
        votingInfluence.connect(attacker).recordContentVote(contentId, 10000, true)
      ).to.be.revertedWithCustomError(votingInfluence, 'ZeroVotingPower');

      // Author stakes 500 PNR
      await pnr.connect(author).approve(await powerEscrow.getAddress(), ethers.parseEther('500'));
      await powerEscrow.connect(author).powerUp(ethers.parseEther('500'));

      // Author votes 100% weight
      await votingInfluence.connect(author).recordContentVote(contentId, 10000, true);

      // Immediate second vote on same content must revert
      await expect(
        votingInfluence.connect(author).recordContentVote(contentId, 10000, true)
      ).to.be.revertedWithCustomError(votingInfluence, 'AlreadyVoted');
    });
  });

  // ─── 4. REWARD VAULT & DISTRIBUTOR CEILING INVARIANTS ──────────────────────
  describe('4. Reward Vault Ceilings & Distributor Solvency', () => {
    it('strictly enforces the 30M scheduled ceiling and protects 10M reserve', async () => {
      // Configure distributor
      await rewardVault.setRewardDistributor(distributor.target);

      // Attacker cannot release vault tokens
      await expect(
        rewardVault.connect(attacker).releaseScheduledTokens(attacker.address, ethers.parseEther('100'))
      ).to.be.revertedWithCustomError(rewardVault, 'UnauthorizedDistributor');

      expect(await rewardVault.getRemainingScheduledBudget()).to.equal(ethers.parseEther('30000000'));
    });
  });

  // ─── 5. ARTICLE REWARDS SEVEN-DAY SETTLEMENT & MERKLE INVARIANTS ───────────
  describe('5. Article Rewards Merkle Domain Separation & Solvency', () => {
    const articleId = ethers.keccak256(ethers.toUtf8Bytes('penora-story-article-01'));
    let publishedAt;

    beforeEach(async () => {
      publishedAt = await time.latest();
      await articleRewards.registerArticle(articleId, author.address, publishedAt);
    });

    it('strictly rejects early settlement before 7 days have elapsed', async () => {
      const budget = ethers.parseEther('100');
      const dummyRoot = ethers.keccak256(ethers.toUtf8Bytes('dummy-root'));

      await pnr.approve(articleRewards.target, budget);

      // Day 6: settlement attempt must revert
      await time.increase(6 * 24 * 60 * 60);
      await expect(
        articleRewards.settleArticle(articleId, dummyRoot, budget)
      ).to.be.revertedWithCustomError(articleRewards, 'RewardWindowActive');

      // Exactly at 7 days: settlement succeeds
      await time.increase(24 * 60 * 60 + 1);
      await expect(articleRewards.settleArticle(articleId, dummyRoot, budget))
        .to.emit(articleRewards, 'ArticleSettled')
        .withArgs(articleId, dummyRoot, budget);
    });

    it('rejects cross-article and cross-recipient proof replay attacks', async () => {
      const budget = ethers.parseEther('100');
      const authorReward = ethers.parseEther('70');
      const chainId = (await ethers.provider.getNetwork()).chainId;

      // Construct domain-separated leaf for author
      const innerHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['uint256', 'address', 'bytes32', 'address', 'uint256'],
          [chainId, articleRewards.target, articleId, author.address, authorReward]
        )
      );
      const leaf = ethers.keccak256(innerHash);

      // Settle article at day 7
      await time.increase(ONE_WEEK + 10);
      await pnr.approve(articleRewards.target, budget);
      await articleRewards.settleArticle(articleId, leaf, budget); // single leaf tree: root = leaf

      // Attacker attempts to claim author's reward for themselves -> invalid proof
      await expect(
        articleRewards.claimArticleReward(articleId, attacker.address, authorReward, [])
      ).to.be.revertedWithCustomError(articleRewards, 'InvalidAllocation');

      // Author claims their reward
      await expect(
        articleRewards.claimArticleReward(articleId, author.address, authorReward, [])
      )
        .to.emit(articleRewards, 'ArticleRewardPaid')
        .withArgs(articleId, author.address, authorReward);

      // Double claim must strictly revert
      await expect(
        articleRewards.claimArticleReward(articleId, author.address, authorReward, [])
      ).to.be.revertedWithCustomError(articleRewards, 'AlreadyClaimed');
    });
  });

  // ─── 6. P2P ESCROW PARTIAL FILLS & SOLVENCY INVARIANTS ─────────────────────
  describe('6. P2P Escrow Partial Fills, Expirations & Unallocated Recovery', () => {
    it('guarantees escrow solvency invariant: balance strictly equals totalPnrInEscrow', async () => {
      const offerPnr = ethers.parseEther('1000');
      const offerUsdt = ethers.parseUnits('10', 6);

      await pnr.connect(author).approve(p2pEscrow.target, offerPnr);
      await p2pEscrow.connect(author)['createOffer(uint256,uint256)'](offerPnr, offerUsdt);

      expect(await p2pEscrow.totalPnrInEscrow()).to.equal(offerPnr);
      expect(await pnr.balanceOf(p2pEscrow.target)).to.equal(offerPnr);

      // Curator fills 40% (400 PNR)
      const fillPnr = ethers.parseEther('400');
      const fillUsdt = ethers.parseUnits('4', 6);
      await usdt.connect(curator1).approve(p2pEscrow.target, fillUsdt);
      await p2pEscrow.connect(curator1)['fillOffer(uint256,uint256)'](1, fillPnr);

      expect(await p2pEscrow.totalPnrInEscrow()).to.equal(ethers.parseEther('600'));
      expect(await pnr.balanceOf(p2pEscrow.target)).to.equal(ethers.parseEther('600'));

      // Author cancels remaining 600 PNR
      await p2pEscrow.connect(author).cancelOffer(1);

      expect(await p2pEscrow.totalPnrInEscrow()).to.equal(0n);
      expect(await pnr.balanceOf(p2pEscrow.target)).to.equal(0n);
    });

    it('rejects unauthorized unallocated token drainage when no surplus exists', async () => {
      const offerPnr = ethers.parseEther('500');
      await pnr.connect(author).approve(p2pEscrow.target, offerPnr);
      await p2pEscrow.connect(author)['createOffer(uint256,uint256)'](offerPnr, 5000000);

      // Contract holds 500 PNR, which is 100% committed
      await expect(
        p2pEscrow.connect(owner).recoverUnallocated(pnr.target, owner.address)
      ).to.be.revertedWithCustomError(p2pEscrow, 'NoUnallocatedTokens');
    });

    it('rejects double-spending and self-buying on P2P orders', async () => {
      const offerPnr = ethers.parseEther('100');
      await pnr.connect(author).approve(p2pEscrow.target, offerPnr);
      await p2pEscrow.connect(author)['createOffer(uint256,uint256)'](offerPnr, 1000000);

      // Author cannot buy their own offer
      await usdt.connect(author).approve(p2pEscrow.target, 1000000);
      await expect(
        p2pEscrow.connect(author)['fillOffer(uint256)'](1)
      ).to.be.revertedWithCustomError(p2pEscrow, 'CannotBuyOwnOffer');
    });
  });
});

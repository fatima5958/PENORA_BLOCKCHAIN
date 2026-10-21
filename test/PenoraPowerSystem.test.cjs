// test/PenoraPowerSystem.test.cjs
// PENORA Blockchain — Solidity Unit & Invariant Test Suite
// Rigorous verification of PenoraToken (PNR), PenoraPowerEscrow (PP), PenoraVotingInfluence,
// PenoraRewardVault, and PenoraRewardDistributor (48-hour review settlement).

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PENORA Power Up / Power Down & Financial Integration Suite", function () {
  let pnrToken;
  let escrow;
  let influence;
  let vault;
  let distributor;
  let owner;
  let creator1;
  let creator2;
  let attacker;

  const FIXED_TOTAL_SUPPLY = ethers.parseEther("100000000"); // 100 Million PNR
  const ONE_WEEK = 7 * 24 * 60 * 60; // 604,800 seconds
  const FIVE_DAYS = 5 * 24 * 60 * 60; // 432,000 seconds
  const FORTY_EIGHT_HOURS = 48 * 60 * 60; // 172,800 seconds

  // Helper to construct standard OpenZeppelin double-hash Merkle leaf
  function hashLeaf(account, amount) {
    const inner = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [account, amount])
    );
    return ethers.keccak256(inner);
  }

  // Helper to compute 2-leaf Merkle root and proofs
  function buildTwoLeafMerkle(leafA, leafB) {
    let sorted;
    let proofA;
    let proofB;

    if (leafA.toLowerCase() < leafB.toLowerCase()) {
      sorted = ethers.concat([leafA, leafB]);
      proofA = [leafB];
      proofB = [leafA];
    } else {
      sorted = ethers.concat([leafB, leafA]);
      proofA = [leafB];
      proofB = [leafA];
    }
    const root = ethers.keccak256(sorted);
    return { root, proofA, proofB };
  }

  beforeEach(async function () {
    [owner, creator1, creator2, attacker] = await ethers.getSigners();

    // 1. Deploy Liquid PenoraToken (Model A: 100M fixed supply minted at genesis)
    const PenoraTokenFactory = await ethers.getContractFactory("PenoraToken");
    pnrToken = await PenoraTokenFactory.deploy(owner.address);
    await pnrToken.waitForDeployment();

    // 2. Deploy PenoraPowerEscrow
    const PenoraPowerEscrowFactory = await ethers.getContractFactory("PenoraPowerEscrow");
    escrow = await PenoraPowerEscrowFactory.deploy(await pnrToken.getAddress(), owner.address);
    await escrow.waitForDeployment();

    // 3. Deploy PenoraVotingInfluence
    const PenoraVotingInfluenceFactory = await ethers.getContractFactory("PenoraVotingInfluence");
    influence = await PenoraVotingInfluenceFactory.deploy(await escrow.getAddress(), owner.address);
    await influence.waitForDeployment();

    // 4. Deploy PenoraRewardVault (40M Creator Pool)
    const PenoraRewardVaultFactory = await ethers.getContractFactory("PenoraRewardVault");
    vault = await PenoraRewardVaultFactory.deploy(await pnrToken.getAddress(), owner.address);
    await vault.waitForDeployment();

    // 5. Deploy PenoraRewardDistributor (Weekly Epochs & 48h Review)
    const PenoraRewardDistributorFactory = await ethers.getContractFactory("PenoraRewardDistributor");
    distributor = await PenoraRewardDistributorFactory.deploy(await pnrToken.getAddress(), owner.address);
    await distributor.waitForDeployment();

    // Configure vault distributor
    await vault.setRewardDistributor(await distributor.getAddress());

    // Distribute initial PNR to test creators & fund vault with 40M PNR
    await pnrToken.transfer(creator1.address, ethers.parseEther("10000"));
    await pnrToken.transfer(creator2.address, ethers.parseEther("5000"));
    await pnrToken.transfer(await vault.getAddress(), ethers.parseEther("40000000"));
  });

  describe("1. Model A Token Architecture & Fixed 100M Supply", function () {
    it("mints exactly 100M PNR at genesis with 18 decimals and no ongoing mint function", async function () {
      expect(await pnrToken.name()).to.equal("PENORA Token");
      expect(await pnrToken.symbol()).to.equal("PNR");
      expect(await pnrToken.decimals()).to.equal(18);
      expect(await pnrToken.TOTAL_FIXED_SUPPLY()).to.equal(FIXED_TOTAL_SUPPLY);
      expect(await pnrToken.totalSupply()).to.equal(FIXED_TOTAL_SUPPLY);

      // Verify no mint function exists on the contract interface
      expect(pnrToken.mint).to.be.undefined;
    });

    it("supports voluntary burning of liquid PNR tokens", async function () {
      const burnAmount = ethers.parseEther("1000");
      await pnrToken.connect(creator1).burn(burnAmount);
      expect(await pnrToken.balanceOf(creator1.address)).to.equal(ethers.parseEther("9000"));
      expect(await pnrToken.totalSupply()).to.equal(FIXED_TOTAL_SUPPLY - burnAmount);
    });
  });

  describe("2. Power Up (Staking PNR -> PP)", function () {
    it("allows a creator to Power Up liquid PNR into 1:1 PENORA Power (PP)", async function () {
      const stakeAmount = ethers.parseEther("1300");
      await pnrToken.connect(creator1).approve(await escrow.getAddress(), stakeAmount);

      await expect(escrow.connect(creator1).powerUp(stakeAmount)).to.emit(escrow, "PowerUp");

      expect(await pnrToken.balanceOf(creator1.address)).to.equal(ethers.parseEther("8700"));
      expect(await escrow.lockedPower(creator1.address)).to.equal(stakeAmount);
      expect(await escrow.getAvailablePower(creator1.address)).to.equal(stakeAmount);
      expect(await escrow.totalLockedPower()).to.equal(stakeAmount);
      expect(await pnrToken.balanceOf(await escrow.getAddress())).to.equal(stakeAmount);
    });

    it("allows Power Up on behalf of another creator (powerUpFor)", async function () {
      const giftAmount = ethers.parseEther("500");
      await pnrToken.connect(creator1).approve(await escrow.getAddress(), giftAmount);

      await expect(escrow.connect(creator1).powerUpFor(creator2.address, giftAmount)).to.emit(
        escrow,
        "PowerUp"
      );

      expect(await escrow.lockedPower(creator2.address)).to.equal(giftAmount);
      expect(await escrow.lockedPower(creator1.address)).to.equal(0);
    });

    it("reverts Power Up with zero amount or insufficient allowance", async function () {
      await expect(escrow.connect(creator1).powerUp(0)).to.be.revertedWithCustomError(
        escrow,
        "ZeroAmount"
      );

      await expect(
        escrow.connect(creator1).powerUp(ethers.parseEther("500"))
      ).to.be.revertedWithCustomError(pnrToken, "ERC20InsufficientAllowance");
    });
  });

  describe("3. Power Down (13-Week Schedule & Claiming)", function () {
    beforeEach(async function () {
      const stakeAmount = ethers.parseEther("1300");
      await pnrToken.connect(creator1).approve(await escrow.getAddress(), stakeAmount);
      await escrow.connect(creator1).powerUp(stakeAmount);
    });

    it("initiates a 13-week Power Down schedule and immediately reduces available voting power", async function () {
      const powerDownAmount = ethers.parseEther("1300");

      await expect(escrow.connect(creator1).startPowerDown(powerDownAmount)).to.emit(
        escrow,
        "PowerDownStarted"
      );

      const schedule = await escrow.powerDownSchedules(creator1.address);
      expect(schedule.active).to.be.true;
      expect(schedule.totalAmount).to.equal(powerDownAmount);
      expect(schedule.weeklyInstallment).to.equal(ethers.parseEther("100"));
      expect(schedule.remainder).to.equal(0);
      expect(schedule.weeksClaimed).to.equal(0);

      expect(await escrow.getAvailablePower(creator1.address)).to.equal(0);
      expect(await escrow.lockedPower(creator1.address)).to.equal(powerDownAmount);
    });

    it("correctly handles remainder on division edge cases (e.g., 1000 PNR / 13)", async function () {
      const stakeAmount = ethers.parseEther("1000");
      await pnrToken.connect(creator2).approve(await escrow.getAddress(), stakeAmount);
      await escrow.connect(creator2).powerUp(stakeAmount);

      await escrow.connect(creator2).startPowerDown(stakeAmount);
      const schedule = await escrow.powerDownSchedules(creator2.address);

      const expectedWeekly = stakeAmount / 13n;
      const expectedRemainder = stakeAmount % 13n;

      expect(schedule.weeklyInstallment).to.equal(expectedWeekly);
      expect(schedule.remainder).to.equal(expectedRemainder);
      expect(expectedWeekly * 13n + expectedRemainder).to.equal(stakeAmount);
    });

    it("prevents overlapping / concurrent power downs for the same account", async function () {
      await escrow.connect(creator1).startPowerDown(ethers.parseEther("500"));

      await expect(
        escrow.connect(creator1).startPowerDown(ethers.parseEther("500"))
      ).to.be.revertedWithCustomError(escrow, "PowerDownAlreadyActive");
    });

    it("reverts claim before first 7-day maturity period", async function () {
      await escrow.connect(creator1).startPowerDown(ethers.parseEther("1300"));
      await time.increase(6 * 24 * 60 * 60);

      await expect(escrow.connect(creator1).claimInstallments()).to.be.revertedWithCustomError(
        escrow,
        "NoMaturedInstallments"
      );
    });

    it("permits claiming week 1 installment after 7 days", async function () {
      await escrow.connect(creator1).startPowerDown(ethers.parseEther("1300"));
      await time.increase(ONE_WEEK);

      const balBefore = await pnrToken.balanceOf(creator1.address);
      await expect(escrow.connect(creator1).claimInstallments())
        .to.emit(escrow, "InstallmentClaimed")
        .withArgs(creator1.address, ethers.parseEther("100"), 1, (await time.latest()) + 1);

      const balAfter = await pnrToken.balanceOf(creator1.address);
      expect(balAfter - balBefore).to.equal(ethers.parseEther("100"));

      const schedule = await escrow.powerDownSchedules(creator1.address);
      expect(schedule.weeksClaimed).to.equal(1);
      expect(schedule.active).to.be.true;
    });

    it("correctly claims multiple accumulated installments if user waits several weeks", async function () {
      await escrow.connect(creator1).startPowerDown(ethers.parseEther("1300"));
      await time.increase(5 * ONE_WEEK);

      const balBefore = await pnrToken.balanceOf(creator1.address);
      await escrow.connect(creator1).claimInstallments();
      const balAfter = await pnrToken.balanceOf(creator1.address);

      expect(balAfter - balBefore).to.equal(ethers.parseEther("500"));
      const schedule = await escrow.powerDownSchedules(creator1.address);
      expect(schedule.weeksClaimed).to.equal(5);
    });

    it("completes full 13-week lifecycle including remainder and deactivates schedule", async function () {
      const stakeAmount = ethers.parseEther("1000");
      await pnrToken.connect(creator2).approve(await escrow.getAddress(), stakeAmount);
      await escrow.connect(creator2).powerUp(stakeAmount);
      await escrow.connect(creator2).startPowerDown(stakeAmount);

      await time.increase(14 * ONE_WEEK);

      const balBefore = await pnrToken.balanceOf(creator2.address);
      await escrow.connect(creator2).claimInstallments();
      const balAfter = await pnrToken.balanceOf(creator2.address);

      expect(balAfter - balBefore).to.equal(stakeAmount);

      const schedule = await escrow.powerDownSchedules(creator2.address);
      expect(schedule.weeksClaimed).to.equal(13);
      expect(schedule.active).to.be.false;
      expect(await escrow.lockedPower(creator2.address)).to.equal(0);
    });
  });

  describe("4. Cancellation of Power Down", function () {
    beforeEach(async function () {
      const stakeAmount = ethers.parseEther("1300");
      await pnrToken.connect(creator1).approve(await escrow.getAddress(), stakeAmount);
      await escrow.connect(creator1).powerUp(stakeAmount);
      await escrow.connect(creator1).startPowerDown(stakeAmount);
    });

    it("restores all unvested installments to active PENORA Power upon cancellation", async function () {
      await time.increase(3 * ONE_WEEK);
      const balBefore = await pnrToken.balanceOf(creator1.address);

      await expect(escrow.connect(creator1).cancelPowerDown())
        .to.emit(escrow, "PowerDownCancelled")
        .withArgs(
          creator1.address,
          ethers.parseEther("1000"),
          ethers.parseEther("300"),
          (await time.latest()) + 1
        );

      const balAfter = await pnrToken.balanceOf(creator1.address);
      expect(balAfter - balBefore).to.equal(ethers.parseEther("300"));

      expect(await escrow.getAvailablePower(creator1.address)).to.equal(ethers.parseEther("1000"));
      expect(await escrow.lockedPower(creator1.address)).to.equal(ethers.parseEther("1000"));

      const schedule = await escrow.powerDownSchedules(creator1.address);
      expect(schedule.active).to.be.false;
    });

    it("reverts cancel if no active schedule exists", async function () {
      await expect(escrow.connect(creator2).cancelPowerDown()).to.be.revertedWithCustomError(
        escrow,
        "NoActivePowerDown"
      );
    });
  });

  describe("5. System Solvency Invariant & Security", function () {
    it("guarantees contract-held PNR strictly backs all locked liabilities at all times", async function () {
      await pnrToken.connect(creator1).approve(await escrow.getAddress(), ethers.parseEther("1300"));
      await escrow.connect(creator1).powerUp(ethers.parseEther("1300"));

      await pnrToken.connect(creator2).approve(await escrow.getAddress(), ethers.parseEther("2600"));
      await escrow.connect(creator2).powerUp(ethers.parseEther("2600"));

      await escrow.connect(creator1).startPowerDown(ethers.parseEther("1300"));

      let [isSolvent, balance, liabilities] = await escrow.verifySolvencyInvariant();
      expect(isSolvent).to.be.true;
      expect(balance).to.equal(liabilities);
      expect(balance).to.equal(ethers.parseEther("3900"));

      await time.increase(4 * ONE_WEEK);
      await escrow.connect(creator1).claimInstallments();

      [isSolvent, balance, liabilities] = await escrow.verifySolvencyInvariant();
      expect(isSolvent).to.be.true;
      expect(balance).to.equal(liabilities);
      expect(balance).to.equal(ethers.parseEther("3500"));
    });

    it("prevents arbitrary withdrawal or fund drainage by contract owner", async function () {
      expect(escrow.drainFunds).to.be.undefined;
      expect(escrow.emergencyWithdraw).to.be.undefined;
    });

    it("pauses and unpauses state transitions under emergency without risking funds", async function () {
      await escrow.pause();

      await pnrToken.connect(creator1).approve(await escrow.getAddress(), ethers.parseEther("100"));
      await expect(
        escrow.connect(creator1).powerUp(ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");

      await escrow.unpause();

      await expect(escrow.connect(creator1).powerUp(ethers.parseEther("100"))).to.emit(
        escrow,
        "PowerUp"
      );
    });
  });

  describe("6. Voting Mana & Influence Engine", function () {
    beforeEach(async function () {
      await pnrToken.connect(creator1).approve(await escrow.getAddress(), ethers.parseEther("5000"));
      await escrow.connect(creator1).powerUp(ethers.parseEther("5000"));
    });

    it("initializes fresh accounts at 100% mana (10,000 basis points)", async function () {
      const mana = await influence.getCurrentMana(creator1.address);
      expect(mana).to.equal(10000);
    });

    it("calculates stake-weighted influence and consumes 2% mana on a 100% weight vote", async function () {
      const contentId = ethers.keccak256(ethers.toUtf8Bytes("essay-sustainable-curation-001"));
      const [previewInfluence, postMana] = await influence.previewVoteInfluence(
        creator1.address,
        10000
      );

      expect(previewInfluence).to.equal(ethers.parseEther("5000"));
      expect(postMana).to.equal(9800);

      await expect(influence.connect(creator1).recordContentVote(contentId, 10000, true))
        .to.emit(influence, "VoteInfluenceCast")
        .withArgs(contentId, creator1.address, 10000, 9800, ethers.parseEther("5000"), 1);

      expect(await influence.getCurrentMana(creator1.address)).to.equal(9800);
    });

    it("regenerates mana linearly to 100% over 5 days (432,000 seconds)", async function () {
      const contentId = ethers.keccak256(ethers.toUtf8Bytes("essay-regenerating-mana-002"));
      await influence.connect(creator1).recordContentVote(contentId, 10000, true);

      await time.increase(4320);
      expect(await influence.getCurrentMana(creator1.address)).to.equal(9900);

      await time.increase(4320);
      expect(await influence.getCurrentMana(creator1.address)).to.equal(10000);

      await time.increase(FIVE_DAYS);
      expect(await influence.getCurrentMana(creator1.address)).to.equal(10000);
    });

    it("prevents double voting / replay on the same content piece", async function () {
      const contentId = ethers.keccak256(ethers.toUtf8Bytes("essay-anti-replay-003"));
      await influence.connect(creator1).recordContentVote(contentId, 10000, true);

      await expect(
        influence.connect(creator1).recordContentVote(contentId, 10000, true)
      ).to.be.revertedWithCustomError(influence, "AlreadyVoted");
    });

    it("reverts vote attempt if creator has zero available PENORA Power", async function () {
      const contentId = ethers.keccak256(ethers.toUtf8Bytes("essay-zero-power-004"));
      await expect(
        influence.connect(creator2).recordContentVote(contentId, 10000, true)
      ).to.be.revertedWithCustomError(influence, "ZeroVotingPower");
    });
  });

  describe("7. PenoraRewardVault (40M Creator Reserve & 5-Year Plan)", function () {
    it("initializes with 30M scheduled budget and 10M protected reserve", async function () {
      expect(await vault.TOTAL_SCHEDULED_BUDGET()).to.equal(ethers.parseEther("30000000"));
      expect(await vault.PROTECTED_RESERVE()).to.equal(ethers.parseEther("10000000"));
      expect(await vault.totalScheduledReleased()).to.equal(0);
      expect(await vault.protectedReserveUnlocked()).to.be.false;

      const [isSolvent, balance, required] = await vault.verifyVaultSolvency();
      expect(isSolvent).to.be.true;
      expect(balance).to.equal(ethers.parseEther("40000000"));
      expect(required).to.equal(ethers.parseEther("40000000"));
    });

    it("permits release of scheduled tokens to authorized distributor", async function () {
      const epochTranche = ethers.parseEther("115384"); // ~1 week flat budget
      await vault.releaseScheduledTokens(await distributor.getAddress(), epochTranche);

      expect(await vault.totalScheduledReleased()).to.equal(epochTranche);
      expect(await pnrToken.balanceOf(await distributor.getAddress())).to.equal(epochTranche);
    });

    it("prevents release exceeding the 30M scheduled ceiling", async function () {
      const overCeiling = ethers.parseEther("30000001");
      await expect(
        vault.releaseScheduledTokens(await distributor.getAddress(), overCeiling)
      ).to.be.revertedWithCustomError(vault, "ScheduledBudgetExceeded");
    });

    it("prevents unauthorized accounts from releasing vault tokens", async function () {
      await expect(
        vault.connect(attacker).releaseScheduledTokens(attacker.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(vault, "UnauthorizedDistributor");
    });
  });

  describe("8. PenoraRewardDistributor (Weekly Settlement & 48-Hour Review)", function () {
    let leaf1;
    let leaf2;
    let merkleRoot;
    let proofCreator1;
    let proofCreator2;
    const epochId = 1;
    const reward1 = ethers.parseEther("700"); // 70% author reward
    const reward2 = ethers.parseEther("200"); // 20% curator reward
    const totalBudget = ethers.parseEther("1000"); // 100 PNR to unallocated reserve

    beforeEach(async function () {
      leaf1 = hashLeaf(creator1.address, reward1);
      leaf2 = hashLeaf(creator2.address, reward2);

      const tree = buildTwoLeafMerkle(leaf1, leaf2);
      merkleRoot = tree.root;
      proofCreator1 = tree.proofA;
      proofCreator2 = tree.proofB;

      // Approve distributor to pull totalBudget from owner
      await pnrToken.approve(await distributor.getAddress(), totalBudget);
      await distributor.publishEpochRoot(epochId, merkleRoot, totalBudget);
    });

    it("publishes epoch root and enters 48-hour review state", async function () {
      const [exists, isUnderReview, claimableAt, isDisputed, budget, claimed] =
        await distributor.getEpochStatus(epochId);

      expect(exists).to.be.true;
      expect(isUnderReview).to.be.true;
      expect(isDisputed).to.be.false;
      expect(budget).to.equal(totalBudget);
      expect(claimed).to.equal(0);
    });

    it("enforces 48-hour review window: strictly rejects claims before 48 hours", async function () {
      // Advance 24 hours (still under review)
      await time.increase(24 * 60 * 60);

      await expect(
        distributor.claimCreatorReward(epochId, creator1.address, reward1, proofCreator1)
      ).to.be.revertedWithCustomError(distributor, "EpochUnderReview");
    });

    it("permits 100% liquid PNR claim once the 48-hour review window has elapsed", async function () {
      // Advance beyond 48 hours
      await time.increase(FORTY_EIGHT_HOURS + 1);

      const balBefore = await pnrToken.balanceOf(creator1.address);
      await expect(
        distributor.claimCreatorReward(epochId, creator1.address, reward1, proofCreator1)
      )
        .to.emit(distributor, "RewardClaimed")
        .withArgs(epochId, creator1.address, reward1, (await time.latest()) + 1);

      const balAfter = await pnrToken.balanceOf(creator1.address);
      expect(balAfter - balBefore).to.equal(reward1); // 100% Liquid PNR

      expect(await distributor.hasClaimed(epochId, creator1.address)).to.be.true;
    });

    it("strictly prevents double claims by the same creator in an epoch", async function () {
      await time.increase(FORTY_EIGHT_HOURS + 1);
      await distributor.claimCreatorReward(epochId, creator1.address, reward1, proofCreator1);

      // Attempting to claim again in the same epoch
      await expect(
        distributor.claimCreatorReward(epochId, creator1.address, reward1, proofCreator1)
      ).to.be.revertedWithCustomError(distributor, "AlreadyClaimed");
    });

    it("rejects forged or invalid Merkle proofs", async function () {
      await time.increase(FORTY_EIGHT_HOURS + 1);

      const forgedProof = [ethers.keccak256(ethers.toUtf8Bytes("fake-sibling-hash"))];
      await expect(
        distributor.claimCreatorReward(epochId, creator1.address, reward1, forgedProof)
      ).to.be.revertedWithCustomError(distributor, "InvalidProof");

      // Attacker trying to claim someone else's proof
      await expect(
        distributor.claimCreatorReward(epochId, attacker.address, reward1, proofCreator1)
      ).to.be.revertedWithCustomError(distributor, "InvalidProof");
    });

    it("blocks claims if epoch is disputed during the 48-hour review window", async function () {
      // Dispute epoch at hour 20
      await time.increase(20 * 60 * 60);
      await expect(distributor.disputeEpoch(epochId, "Investigating sybil voting ring"))
        .to.emit(distributor, "EpochDisputed")
        .withArgs(epochId, "Investigating sybil voting ring", (await time.latest()) + 1);

      // Advance past 48 hours: claims must still be blocked while disputed
      await time.increase(48 * 60 * 60);
      await expect(
        distributor.claimCreatorReward(epochId, creator1.address, reward1, proofCreator1)
      ).to.be.revertedWithCustomError(distributor, "EpochDisputedError");
    });
  });
});

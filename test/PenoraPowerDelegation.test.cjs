// test/PenoraPowerDelegation.test.cjs
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PenoraPowerDelegation — PENORA Power Delegation Suite", function () {
  let token, escrow, delegation, votingV2;
  let owner, userA, userB, userC, userD;

  const INITIAL_MINT = ethers.parseEther("1000000"); // 1M PNR
  const ONE_WEEK = 7 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, userA, userB, userC, userD] = await ethers.getSigners();

    // 1. Deploy PNR Token
    const PenoraToken = await ethers.getContractFactory("PenoraToken");
    token = await PenoraToken.deploy(owner.address, ethers.ZeroAddress, 0);
    await token.waitForDeployment();

    // 2. Deploy PenoraPowerEscrow
    const PenoraPowerEscrow = await ethers.getContractFactory("PenoraPowerEscrow");
    escrow = await PenoraPowerEscrow.deploy(await token.getAddress(), owner.address);
    await escrow.waitForDeployment();

    // 3. Deploy PenoraPowerDelegation
    const PenoraPowerDelegation = await ethers.getContractFactory("PenoraPowerDelegation");
    delegation = await PenoraPowerDelegation.deploy(await escrow.getAddress(), owner.address);
    await delegation.waitForDeployment();

    // 4. Deploy PenoraVotingInfluenceV2
    const PenoraVotingInfluenceV2 = await ethers.getContractFactory("PenoraVotingInfluenceV2");
    votingV2 = await PenoraVotingInfluenceV2.deploy(
      await escrow.getAddress(),
      await delegation.getAddress(),
      owner.address
    );
    await votingV2.waitForDeployment();

    // Fund userA and userB with liquid PNR and Power Up into Escrow
    const stakeA = ethers.parseEther("10000"); // 10,000 PNR
    const stakeB = ethers.parseEther("5000");  // 5,000 PNR

    await token.transfer(userA.address, stakeA);
    await token.transfer(userB.address, stakeB);

    await token.connect(userA).approve(await escrow.getAddress(), stakeA);
    await escrow.connect(userA).powerUp(stakeA);

    await token.connect(userB).approve(await escrow.getAddress(), stakeB);
    await escrow.connect(userB).powerUp(stakeB);
  });

  describe("1. Initial States & Token Conservation", function () {
    it("delegation contract holds 0 tokens and verifies token conservation", async function () {
      const [isConserved, contractBalance] = await delegation.verifyTokenConservation();
      expect(isConserved).to.be.true;
      expect(contractBalance).to.equal(0n);
      expect(await token.balanceOf(await delegation.getAddress())).to.equal(0n);
    });

    it("reports correct initial delegable and effective voting power", async function () {
      expect(await delegation.getAvailableToDelegate(userA.address)).to.equal(ethers.parseEther("10000"));
      expect(await delegation.getEffectiveVotingPower(userA.address)).to.equal(ethers.parseEther("10000"));
      expect(await delegation.getEffectiveVotingPower(userC.address)).to.equal(0n);
    });
  });

  describe("2. Delegation Execution & Validation", function () {
    it("successfully delegates power to another creator without transferring tokens", async function () {
      const delegateAmount = ethers.parseEther("3000");

      const tx = await delegation.connect(userA).delegatePower(userC.address, delegateAmount);
      await expect(tx)
        .to.emit(delegation, "PowerDelegated")
        .withArgs(userA.address, userC.address, delegateAmount, (val) => val > 0);

      // Verify balances
      expect(await delegation.delegations(userA.address, userC.address)).to.equal(delegateAmount);
      expect(await delegation.totalDelegatedOut(userA.address)).to.equal(delegateAmount);
      expect(await delegation.totalReceivedPower(userC.address)).to.equal(delegateAmount);

      // User A available to delegate is reduced
      expect(await delegation.getAvailableToDelegate(userA.address)).to.equal(ethers.parseEther("7000"));
      // User A effective voting power is reduced to 7,000
      expect(await delegation.getEffectiveVotingPower(userA.address)).to.equal(ethers.parseEther("7000"));
      // User C effective voting power increased to 3,000
      expect(await delegation.getEffectiveVotingPower(userC.address)).to.equal(delegateAmount);

      // Verify underlying tokens still live 100% in Escrow, 0 in Delegation
      expect(await token.balanceOf(await delegation.getAddress())).to.equal(0n);
      expect(await escrow.lockedPower(userA.address)).to.equal(ethers.parseEther("10000"));
    });

    it("reverts if attempting to self-delegate", async function () {
      await expect(
        delegation.connect(userA).delegatePower(userA.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(delegation, "CannotDelegateToSelf");
    });

    it("reverts if delegating to zero address or with zero amount", async function () {
      await expect(
        delegation.connect(userA).delegatePower(ethers.ZeroAddress, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(delegation, "ZeroAddress");

      await expect(
        delegation.connect(userA).delegatePower(userC.address, 0)
      ).to.be.revertedWithCustomError(delegation, "ZeroAmount");
    });

    it("reverts if delegation exceeds available staked power", async function () {
      const excessive = ethers.parseEther("10001");
      await expect(
        delegation.connect(userA).delegatePower(userC.address, excessive)
      ).to.be.revertedWithCustomError(delegation, "ExceedsAvailablePower");
    });
  });

  describe("3. Multiple Recipients & Anti-Double-Counting", function () {
    it("supports delegating to multiple recipients while strictly bounding total liabilities", async function () {
      await delegation.connect(userA).delegatePower(userC.address, ethers.parseEther("4000"));
      await delegation.connect(userA).delegatePower(userD.address, ethers.parseEther("5000"));

      expect(await delegation.totalDelegatedOut(userA.address)).to.equal(ethers.parseEther("9000"));
      expect(await delegation.getAvailableToDelegate(userA.address)).to.equal(ethers.parseEther("1000"));
      expect(await delegation.getEffectiveVotingPower(userA.address)).to.equal(ethers.parseEther("1000"));
      expect(await delegation.getEffectiveVotingPower(userC.address)).to.equal(ethers.parseEther("4000"));
      expect(await delegation.getEffectiveVotingPower(userD.address)).to.equal(ethers.parseEther("5000"));

      // Active delegations list for User A contains both
      const activeA = await delegation.getActiveDelegations(userA.address);
      expect(activeA.length).to.equal(2);
      expect(activeA[0].delegatee).to.equal(userC.address);
      expect(activeA[1].delegatee).to.equal(userD.address);

      // Attempting to delegate 1,001 more should fail
      await expect(
        delegation.connect(userA).delegatePower(userB.address, ethers.parseEther("1001"))
      ).to.be.revertedWithCustomError(delegation, "ExceedsAvailablePower");
    });
  });

  describe("4. Recursive Delegation Exploits Strictly Prohibited", function () {
    it("prevents recipient from re-delegating received power (no circular/daisy-chain exploits)", async function () {
      // User A delegates 5,000 PP to User C (who has 0 staked PP of their own)
      await delegation.connect(userA).delegatePower(userC.address, ethers.parseEther("5000"));

      expect(await delegation.getEffectiveVotingPower(userC.address)).to.equal(ethers.parseEther("5000"));
      expect(await delegation.getAvailableToDelegate(userC.address)).to.equal(0n);

      // User C attempts to delegate 1,000 PP to User D
      await expect(
        delegation.connect(userC).delegatePower(userD.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(delegation, "ExceedsAvailablePower");
    });
  });

  describe("5. Delegation Modification & Revocation", function () {
    beforeEach(async function () {
      await delegation.connect(userA).delegatePower(userC.address, ethers.parseEther("4000"));
    });

    it("allows increasing an existing delegation", async function () {
      await delegation.connect(userA).modifyDelegation(userC.address, ethers.parseEther("6000"));

      expect(await delegation.delegations(userA.address, userC.address)).to.equal(ethers.parseEther("6000"));
      expect(await delegation.totalDelegatedOut(userA.address)).to.equal(ethers.parseEther("6000"));
      expect(await delegation.getEffectiveVotingPower(userC.address)).to.equal(ethers.parseEther("6000"));
      expect(await delegation.getEffectiveVotingPower(userA.address)).to.equal(ethers.parseEther("4000"));
    });

    it("allows reducing an existing delegation", async function () {
      await delegation.connect(userA).modifyDelegation(userC.address, ethers.parseEther("1500"));

      expect(await delegation.delegations(userA.address, userC.address)).to.equal(ethers.parseEther("1500"));
      expect(await delegation.totalDelegatedOut(userA.address)).to.equal(ethers.parseEther("1500"));
      expect(await delegation.getEffectiveVotingPower(userC.address)).to.equal(ethers.parseEther("1500"));
      expect(await delegation.getEffectiveVotingPower(userA.address)).to.equal(ethers.parseEther("8500"));
    });

    it("completely revokes delegation and restores full delegator voting power", async function () {
      const tx = await delegation.connect(userA).revokeDelegation(userC.address);
      await expect(tx)
        .to.emit(delegation, "DelegationRevoked")
        .withArgs(userA.address, userC.address, ethers.parseEther("4000"), (val) => val > 0);

      expect(await delegation.delegations(userA.address, userC.address)).to.equal(0n);
      expect(await delegation.totalDelegatedOut(userA.address)).to.equal(0n);
      expect(await delegation.totalReceivedPower(userC.address)).to.equal(0n);
      expect(await delegation.getEffectiveVotingPower(userC.address)).to.equal(0n);
      expect(await delegation.getEffectiveVotingPower(userA.address)).to.equal(ethers.parseEther("10000"));

      const active = await delegation.getActiveDelegations(userA.address);
      expect(active.length).to.equal(0);
    });

    it("reverts revoke if no active delegation exists", async function () {
      await expect(
        delegation.connect(userA).revokeDelegation(userD.address)
      ).to.be.revertedWithCustomError(delegation, "NoActiveDelegation");
    });
  });

  describe("6. Interaction with 13-Week Power Down", function () {
    it("power down schedule reduces delegable capacity correctly", async function () {
      // User A starts a power down of 6,000 PP
      await escrow.connect(userA).startPowerDown(ethers.parseEther("6000"));

      // Available in escrow is 4,000 PP
      expect(await escrow.getAvailablePower(userA.address)).to.equal(ethers.parseEther("4000"));
      expect(await delegation.getAvailableToDelegate(userA.address)).to.equal(ethers.parseEther("4000"));

      // User A can delegate up to 4,000 PP
      await delegation.connect(userA).delegatePower(userC.address, ethers.parseEther("4000"));
      expect(await delegation.getAvailableToDelegate(userA.address)).to.equal(0n);

      // Attempting to delegate more fails
      await expect(
        delegation.connect(userA).delegatePower(userD.address, ethers.parseEther("1"))
      ).to.be.revertedWithCustomError(delegation, "ExceedsAvailablePower");
    });
  });

  describe("7. Voting Influence V2 Integration with Delegated Power", function () {
    it("recipient uses received power to cast stake-weighted votes", async function () {
      // User A delegates 5,000 PP to User C (who has 0 staked PP)
      await delegation.connect(userA).delegatePower(userC.address, ethers.parseEther("5000"));

      const contentId = ethers.keccak256(ethers.toUtf8Bytes("essay-steemit-delegation-001"));

      // User C previews vote influence at 100% weight (10,000 bps)
      const [previewInfluence, postMana] = await votingV2.previewVoteInfluence(userC.address, 10000);
      expect(previewInfluence).to.equal(ethers.parseEther("5000")); // (5000 * 10000 * 10000) / (10000^2)
      expect(postMana).to.equal(9800n); // Consumes 2% (200 bps)

      // User C casts vote
      await votingV2.connect(userC).recordContentVote(contentId, 10000, true);

      // Cannot vote twice on same content
      await expect(
        votingV2.connect(userC).recordContentVote(contentId, 10000, true)
      ).to.be.revertedWithCustomError(votingV2, "AlreadyVoted");
    });

    it("delegator's vote influence uses their retained power after delegation", async function () {
      await delegation.connect(userA).delegatePower(userC.address, ethers.parseEther("7000"));

      const contentId = ethers.keccak256(ethers.toUtf8Bytes("essay-steemit-delegation-002"));

      // User A retained 3,000 PP
      const [previewInfluence] = await votingV2.previewVoteInfluence(userA.address, 10000);
      expect(previewInfluence).to.equal(ethers.parseEther("3000"));
    });
  });

  describe("8. Emergency Controls & Safety", function () {
    it("owner can pause and unpause delegation operations", async function () {
      await delegation.connect(owner).pause();

      await expect(
        delegation.connect(userA).delegatePower(userC.address, ethers.parseEther("1000"))
      ).to.be.revertedWithCustomError(delegation, "EnforcedPause");

      await delegation.connect(owner).unpause();

      await expect(
        delegation.connect(userA).delegatePower(userC.address, ethers.parseEther("1000"))
      ).to.not.be.reverted;
    });

    it("non-owner cannot pause or unpause", async function () {
      await expect(
        delegation.connect(userA).pause()
      ).to.be.revertedWithCustomError(delegation, "OwnableUnauthorizedAccount");
    });
  });
});

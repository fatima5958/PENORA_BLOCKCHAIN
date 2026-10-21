// test/PenoraUsdtSystem.test.cjs
// Hardhat Test Suite for PENORA USDT Integration (Polygon Amoy / Local EVM)

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PENORA USDT Integration & Precision Verification", function () {
  let MockUSDT;
  let usdt;
  let owner;
  let user1;
  let user2;

  const INITIAL_SUPPLY = ethers.parseUnits("1000000", 6); // 1,000,000 USDT (6 decimals)

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const MockUSDTFactory = await ethers.getContractFactory("MockUSDT");
    usdt = await MockUSDTFactory.deploy(
      "Tether USD",
      "USDT",
      INITIAL_SUPPLY,
      owner.address
    );
    await usdt.waitForDeployment();
  });

  describe("1. Contract Properties & Decimals", function () {
    it("should have exactly 6 decimals (not 18)", async function () {
      const decimals = await usdt.decimals();
      expect(decimals).to.equal(6);
    });

    it("should report symbol USDT and correct name", async function () {
      expect(await usdt.symbol()).to.equal("USDT");
      expect(await usdt.name()).to.equal("Tether USD");
    });

    it("should credit the initial 1M supply with 6 decimals to owner", async function () {
      const ownerBal = await usdt.balanceOf(owner.address);
      expect(ownerBal).to.equal(INITIAL_SUPPLY);
      expect(ethers.formatUnits(ownerBal, 6)).to.equal("1000000.0");
    });
  });

  describe("2. Real ERC-20 Transfers & Precision Arithmetic", function () {
    it("should transfer exact amounts without precision loss", async function () {
      const transferAmount = ethers.parseUnits("125.5", 6); // 125.500000 USDT
      await usdt.transfer(user1.address, transferAmount);

      const u1Bal = await usdt.balanceOf(user1.address);
      expect(u1Bal).to.equal(transferAmount);
      expect(ethers.formatUnits(u1Bal, 6)).to.equal("125.5");
    });

    it("should emit Transfer event with exact parameters", async function () {
      const transferAmount = ethers.parseUnits("50", 6);
      await expect(usdt.transfer(user1.address, transferAmount))
        .to.emit(usdt, "Transfer")
        .withArgs(owner.address, user1.address, transferAmount);
    });

    it("should revert if sender has insufficient balance", async function () {
      const hugeAmount = ethers.parseUnits("2000000", 6); // More than 1M
      await expect(
        usdt.connect(user1).transfer(user2.address, hugeAmount)
      ).to.be.revertedWithCustomError(usdt, "ERC20InsufficientBalance");
    });

    it("should revert on transfer to zero address", async function () {
      const amount = ethers.parseUnits("10", 6);
      await expect(
        usdt.transfer(ethers.ZeroAddress, amount)
      ).to.be.revertedWithCustomError(usdt, "ERC20InvalidReceiver");
    });
  });

  describe("3. Faucet & Multi-User Flow", function () {
    it("should allow faucet minting within allowed limits", async function () {
      const faucetAmount = ethers.parseUnits("1000", 6);
      await usdt.faucetMint(user2.address, faucetAmount);

      expect(await usdt.balanceOf(user2.address)).to.equal(faucetAmount);
    });

    it("should reject faucet requests exceeding max limit", async function () {
      const excessiveAmount = ethers.parseUnits("50000", 6); // Exceeds 10,000 limit
      await expect(
        usdt.faucetMint(user2.address, excessiveAmount)
      ).to.be.revertedWith("Exceeds faucet max limit");
    });
  });
});

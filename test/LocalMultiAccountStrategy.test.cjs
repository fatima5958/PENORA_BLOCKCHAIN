const { expect } = require("chai");
const hre = require("hardhat");

describe("PENORA — Multi-Account Free Local Testing Suite", function () {
  let signers;
  let pnr, usdt, escrow, influence, p2pEscrow, exchange;

  before(async function () {
    signers = await hre.ethers.getSigners();
    expect(signers.length).to.be.at.least(50);

    const deployer = signers[0];

    // Deploy core contracts locally with zero Amoy gas cost
    const PNRFactory = await hre.ethers.getContractFactory("PenoraToken");
    pnr = await PNRFactory.deploy(deployer.address, hre.ethers.ZeroAddress, 0);

    const USDTFactory = await hre.ethers.getContractFactory("MockUSDT");
    // Mint 1,000,000 whole MockUSDT (6 decimals) to deployer
    usdt = await USDTFactory.deploy(
      "Tether USD",
      "USDT",
      hre.ethers.parseUnits("1000000", 6),
      deployer.address
    );

    const EscrowFactory = await hre.ethers.getContractFactory("PenoraPowerEscrow");
    escrow = await EscrowFactory.deploy(pnr.target, deployer.address);

    const InfluenceFactory = await hre.ethers.getContractFactory("PenoraVotingInfluence");
    influence = await InfluenceFactory.deploy(escrow.target, deployer.address);

    const P2PFactory = await hre.ethers.getContractFactory("PenoraP2PEscrow");
    p2pEscrow = await P2PFactory.deploy(pnr.target, usdt.target, deployer.address, 50, deployer.address);

    const ExchangeFactory = await hre.ethers.getContractFactory("PenoraExchange");
    exchange = await ExchangeFactory.deploy(pnr.target, usdt.target, deployer.address, hre.ethers.parseEther("5"));

    // Fund the exchange desk with 10,000 PNR
    await pnr.transfer(exchange.target, hre.ethers.parseEther("10000"));
  });

  it("1. Distributes test tokens across 30 local accounts for high-throughput testing", async function () {
    const deployer = signers[0];
    const pnrAmount = hre.ethers.parseEther("100");
    const usdtAmount = hre.ethers.parseUnits("500", 6);

    for (let i = 1; i <= 30; i++) {
      await pnr.connect(deployer).transfer(signers[i].address, pnrAmount);
      await usdt.connect(deployer).transfer(signers[i].address, usdtAmount);
      expect(await pnr.balanceOf(signers[i].address)).to.equal(pnrAmount);
      expect(await usdt.balanceOf(signers[i].address)).to.equal(usdtAmount);
    }
  });

  it("2. Executes concurrent Power Up across 10 distinct local accounts", async function () {
    const stakeAmount = hre.ethers.parseEther("50");

    for (let i = 1; i <= 10; i++) {
      const user = signers[i];
      await pnr.connect(user).approve(escrow.target, stakeAmount);
      await escrow.connect(user).powerUp(stakeAmount);
      expect(await escrow.getAvailablePower(user.address)).to.equal(stakeAmount);
    }
  });

  it("3. Executes Mana consumption and stake-weighted voting across 10 creators", async function () {
    for (let i = 1; i <= 10; i++) {
      const user = signers[i];
      const manaBefore = await influence.getCurrentMana(user.address);
      expect(manaBefore).to.equal(10000n); // 100% mana

      const contentId = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(`article-${i}`));
      await influence.connect(user).recordContentVote(contentId, 10000, true);

      const manaAfter = await influence.getCurrentMana(user.address);
      expect(manaAfter).to.equal(9800n); // 200 bps mana consumed
    }
  });

  it("4. Simulates P2P Marketplace offer creation and atomic fill between local accounts", async function () {
    const seller = signers[11];
    const buyer = signers[12];
    const pnrOffer = hre.ethers.parseEther("20");
    const usdtPrice = hre.ethers.parseUnits("4", 6); // 0.20 USDT/PNR (4 USDT for 20 PNR)

    await pnr.connect(seller).approve(p2pEscrow.target, pnrOffer);
    await p2pEscrow.connect(seller)["createOffer(uint256,uint256)"](pnrOffer, usdtPrice);

    // Buyer approves USDT and fills offer 1
    await usdt.connect(buyer).approve(p2pEscrow.target, hre.ethers.parseUnits("10", 6));
    await p2pEscrow.connect(buyer)["fillOffer(uint256)"](1);

    expect(await pnr.balanceOf(buyer.address)).to.be.at.least(pnrOffer);
  });

  it("5. Simulates instant Exchange purchase desk swap between local accounts", async function () {
    const buyer = signers[15];
    const usdtIn = hre.ethers.parseUnits("10", 6); // 10 USDT
    const expectedPnr = hre.ethers.parseEther("50"); // at 5 PNR/USDT = 50 PNR

    await usdt.connect(buyer).approve(exchange.target, usdtIn);
    const deadline = (await hre.ethers.provider.getBlock("latest")).timestamp + 300;
    await exchange.connect(buyer).buy(usdtIn, expectedPnr, deadline);

    expect(await pnr.balanceOf(buyer.address)).to.be.at.least(expectedPnr);
  });
});

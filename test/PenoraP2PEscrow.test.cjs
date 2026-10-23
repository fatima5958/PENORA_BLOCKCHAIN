const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('PenoraP2PEscrow — Peer-to-Peer PNR/USDT Marketplace', function () {
  let owner, seller, buyer, buyer2, feeCollector, other;
  let pnr, usdt, escrow;

  const initialFeeBps = 50n; // 0.5% fee

  beforeEach(async () => {
    [owner, seller, buyer, buyer2, feeCollector, other] = await ethers.getSigners();

    // 1. Deploy PNR Token (18 decimals)
    const PenoraToken = await ethers.getContractFactory('PenoraToken');
    pnr = await PenoraToken.deploy(owner.address, ethers.ZeroAddress, 0);

    // 2. Deploy MockUSDT (6 decimals)
    const MockUSDT = await ethers.getContractFactory('MockUSDT');
    usdt = await MockUSDT.deploy('Test Tether USD', 'USDT', ethers.parseUnits('100000', 6), owner.address);

    // 3. Deploy PenoraP2PEscrow
    const PenoraP2PEscrow = await ethers.getContractFactory('PenoraP2PEscrow');
    escrow = await PenoraP2PEscrow.deploy(
      await pnr.getAddress(),
      await usdt.getAddress(),
      owner.address,
      initialFeeBps,
      feeCollector.address
    );

    // 4. Fund seller with 10,000 PNR and buyers with 1,000 USDT each
    await pnr.transfer(seller.address, ethers.parseEther('10000'));
    await usdt.transfer(buyer.address, ethers.parseUnits('1000', 6));
    await usdt.transfer(buyer2.address, ethers.parseUnits('1000', 6));
  });

  it('correctly initializes with verified token decimals and fee cap', async () => {
    expect(await escrow.pnrToken()).to.equal(await pnr.getAddress());
    expect(await escrow.usdtToken()).to.equal(await usdt.getAddress());
    expect(await escrow.feeBps()).to.equal(50n);
    expect(await escrow.feeRecipient()).to.equal(feeCollector.address);
    expect(await escrow.MAX_FEE_BPS()).to.equal(100n);
    expect(await escrow.totalPnrInEscrow()).to.equal(0n);
  });

  it('rejects deployment with invalid decimals or fee exceeding 100 bps', async () => {
    const PenoraP2PEscrow = await ethers.getContractFactory('PenoraP2PEscrow');
    // Reversed tokens (USDT 6 dec as PNR) must revert
    await expect(
      PenoraP2PEscrow.deploy(await usdt.getAddress(), await pnr.getAddress(), owner.address, 50, feeCollector.address)
    ).to.be.revertedWithCustomError(escrow, 'InvalidConfiguration');

    // Fee > 100 bps (1%) must revert
    await expect(
      PenoraP2PEscrow.deploy(await pnr.getAddress(), await usdt.getAddress(), owner.address, 101, feeCollector.address)
    ).to.be.revertedWithCustomError(escrow, 'FeeTooHigh');
  });

  it('creates an offer and securely locks seller PNR in escrow', async () => {
    const pnrAmount = ethers.parseEther('1000');
    const usdtPrice = ethers.parseUnits('10', 6); // 10 USDT for 1,000 PNR ($0.01/PNR)

    await pnr.connect(seller).approve(await escrow.getAddress(), pnrAmount);

    const tx = await escrow.connect(seller)['createOffer(uint256,uint256)'](pnrAmount, usdtPrice);
    await expect(tx)
      .to.emit(escrow, 'OfferCreated')
      .withArgs(1n, seller.address, pnrAmount, usdtPrice, 0n, 0n);

    expect(await pnr.balanceOf(await escrow.getAddress())).to.equal(pnrAmount);
    expect(await pnr.balanceOf(seller.address)).to.equal(ethers.parseEther('9000'));
    expect(await escrow.totalPnrInEscrow()).to.equal(pnrAmount);

    const offer = await escrow.offers(1);
    expect(offer.id).to.equal(1n);
    expect(offer.seller).to.equal(seller.address);
    expect(offer.pnrAmount).to.equal(pnrAmount);
    expect(offer.pnrRemaining).to.equal(pnrAmount);
    expect(offer.usdtPriceTotal).to.equal(usdtPrice);
    expect(offer.cancelled).to.equal(false);
    expect(await escrow.isOfferActive(1)).to.equal(true);
  });

  it('atomically fills an offer fully: buyer gets PNR, seller gets USDT, platform collects fee', async () => {
    const pnrAmount = ethers.parseEther('1000');
    const usdtPrice = ethers.parseUnits('10', 6); // 10 USDT total

    await pnr.connect(seller).approve(await escrow.getAddress(), pnrAmount);
    await escrow.connect(seller)['createOffer(uint256,uint256)'](pnrAmount, usdtPrice);

    await usdt.connect(buyer).approve(await escrow.getAddress(), usdtPrice);

    const feeExpected = (usdtPrice * 50n) / 10000n; // 0.05 USDT (50,000 micro-USDT)
    const netSellerExpected = usdtPrice - feeExpected; // 9.95 USDT

    const fillTx = await escrow.connect(buyer)['fillOffer(uint256)'](1);
    await expect(fillTx)
      .to.emit(escrow, 'OfferFilled')
      .withArgs(1n, buyer.address, seller.address, pnrAmount, 0n, usdtPrice, feeExpected);

    // Balances verification
    expect(await pnr.balanceOf(buyer.address)).to.equal(pnrAmount);
    expect(await pnr.balanceOf(await escrow.getAddress())).to.equal(0n);
    expect(await escrow.totalPnrInEscrow()).to.equal(0n);
    expect(await usdt.balanceOf(seller.address)).to.equal(netSellerExpected);
    expect(await usdt.balanceOf(feeCollector.address)).to.equal(feeExpected);

    expect(await escrow.isOfferActive(1)).to.equal(false);

    // Attempting double fill must strictly revert
    await expect(escrow.connect(buyer)['fillOffer(uint256)'](1)).to.be.revertedWithCustomError(escrow, 'OfferNotActive');
  });

  it('supports partial fills across multiple buyers with precise rounding', async () => {
    const pnrTotal = ethers.parseEther('1000');
    const usdtTotal = ethers.parseUnits('10', 6); // $0.01 per PNR

    await pnr.connect(seller).approve(await escrow.getAddress(), pnrTotal);
    await escrow.connect(seller)['createOffer(uint256,uint256)'](pnrTotal, usdtTotal);

    // Fill 1: Buyer purchases 300 PNR (30%)
    const pnrFill1 = ethers.parseEther('300');
    const usdtExpected1 = ethers.parseUnits('3', 6);
    const fee1 = (usdtExpected1 * 50n) / 10000n; // 0.015 USDT
    await usdt.connect(buyer).approve(await escrow.getAddress(), usdtExpected1);

    await expect(escrow.connect(buyer)['fillOffer(uint256,uint256)'](1, pnrFill1))
      .to.emit(escrow, 'OfferFilled')
      .withArgs(1n, buyer.address, seller.address, pnrFill1, ethers.parseEther('700'), usdtExpected1, fee1);

    expect(await pnr.balanceOf(buyer.address)).to.equal(pnrFill1);
    expect(await escrow.totalPnrInEscrow()).to.equal(ethers.parseEther('700'));
    expect(await escrow.isOfferActive(1)).to.equal(true);

    // Fill 2: Buyer2 purchases remaining 700 PNR (70%)
    const pnrFill2 = ethers.parseEther('700');
    const usdtExpected2 = ethers.parseUnits('7', 6);
    const fee2 = (usdtExpected2 * 50n) / 10000n;
    await usdt.connect(buyer2).approve(await escrow.getAddress(), usdtExpected2);

    await expect(escrow.connect(buyer2)['fillOffer(uint256,uint256)'](1, pnrFill2))
      .to.emit(escrow, 'OfferFilled')
      .withArgs(1n, buyer2.address, seller.address, pnrFill2, 0n, usdtExpected2, fee2);

    expect(await pnr.balanceOf(buyer2.address)).to.equal(pnrFill2);
    expect(await escrow.totalPnrInEscrow()).to.equal(0n);
    expect(await escrow.isOfferActive(1)).to.equal(false);

    // Total seller received: 9.95 USDT net
    expect(await usdt.balanceOf(seller.address)).to.equal(usdtTotal - (fee1 + fee2));
  });

  it('enforces minimum fill threshold while permitting final dust clearance', async () => {
    const pnrTotal = ethers.parseEther('1000');
    const usdtTotal = ethers.parseUnits('20', 6);
    const minFill = ethers.parseEther('200'); // Minimum 200 PNR per fill

    await pnr.connect(seller).approve(await escrow.getAddress(), pnrTotal);
    // Create offer with minPnrFill = 200 PNR, no expiration (0)
    await escrow.connect(seller)['createOffer(uint256,uint256,uint256,uint256)'](pnrTotal, usdtTotal, minFill, 0);

    await usdt.connect(buyer).approve(await escrow.getAddress(), usdtTotal);

    // Fill below minimum (150 PNR) must revert
    await expect(
      escrow.connect(buyer)['fillOffer(uint256,uint256)'](1, ethers.parseEther('150'))
    ).to.be.revertedWithCustomError(escrow, 'FillBelowMinimum');

    // Fill 850 PNR (leaving 150 PNR remaining)
    await escrow.connect(buyer)['fillOffer(uint256,uint256)'](1, ethers.parseEther('850'));

    const offer = await escrow.offers(1);
    expect(offer.pnrRemaining).to.equal(ethers.parseEther('150'));

    // Remaining (150 PNR) is below minFill (200 PNR).
    // Attempting to buy 50 PNR should revert
    await expect(
      escrow.connect(buyer2)['fillOffer(uint256,uint256)'](1, ethers.parseEther('50'))
    ).to.be.revertedWithCustomError(escrow, 'FillBelowMinimum');

    // But taking ALL remaining 150 PNR must succeed to prevent dust deadlock
    await usdt.connect(buyer2).approve(await escrow.getAddress(), usdtTotal);
    await expect(
      escrow.connect(buyer2)['fillOffer(uint256,uint256)'](1, ethers.parseEther('150'))
    ).to.emit(escrow, 'OfferFilled');

    expect(await escrow.totalPnrInEscrow()).to.equal(0n);
  });

  it('handles expired orders and permits cancellation by seller or keeper', async () => {
    const pnrAmount = ethers.parseEther('500');
    const usdtPrice = ethers.parseUnits('5', 6);
    const duration = 3600; // 1 hour

    await pnr.connect(seller).approve(await escrow.getAddress(), pnrAmount);
    await escrow.connect(seller)['createOffer(uint256,uint256,uint256,uint256)'](pnrAmount, usdtPrice, 0, duration);

    expect(await escrow.isOfferActive(1)).to.equal(true);

    // Fast-forward past expiry
    await time.increase(duration + 10);

    expect(await escrow.isOfferActive(1)).to.equal(false);

    // Attempting to fill expired offer must revert
    await usdt.connect(buyer).approve(await escrow.getAddress(), usdtPrice);
    await expect(escrow.connect(buyer)['fillOffer(uint256)'](1)).to.be.revertedWithCustomError(escrow, 'OfferExpired');

    // Keeper / third party can trigger cancellation of expired order to return funds to seller
    await expect(escrow.connect(other).cancelOffer(1))
      .to.emit(escrow, 'OfferCancelled')
      .withArgs(1n, seller.address, pnrAmount);

    expect(await pnr.balanceOf(seller.address)).to.equal(ethers.parseEther('10000'));
    expect(await escrow.totalPnrInEscrow()).to.equal(0n);
  });

  it('allows seller to cancel partially filled offer and recovers remaining escrow', async () => {
    const pnrAmount = ethers.parseEther('1000');
    const usdtPrice = ethers.parseUnits('10', 6);

    await pnr.connect(seller).approve(await escrow.getAddress(), pnrAmount);
    await escrow.connect(seller)['createOffer(uint256,uint256)'](pnrAmount, usdtPrice);

    // Buyer fills 400 PNR
    await usdt.connect(buyer).approve(await escrow.getAddress(), ethers.parseUnits('4', 6));
    await escrow.connect(buyer)['fillOffer(uint256,uint256)'](1, ethers.parseEther('400'));

    expect(await escrow.totalPnrInEscrow()).to.equal(ethers.parseEther('600'));

    // Seller cancels remaining 600 PNR
    await expect(escrow.connect(seller).cancelOffer(1))
      .to.emit(escrow, 'OfferCancelled')
      .withArgs(1n, seller.address, ethers.parseEther('600'));

    // Seller now has initial 9000 + 600 refunded = 9600 PNR
    expect(await pnr.balanceOf(seller.address)).to.equal(ethers.parseEther('9600'));
    expect(await escrow.totalPnrInEscrow()).to.equal(0n);
  });

  it('strictly enforces the escrow solvency invariant during unallocated token recovery', async () => {
    const pnrAmount = ethers.parseEther('1000');
    const usdtPrice = ethers.parseUnits('10', 6);

    await pnr.connect(seller).approve(await escrow.getAddress(), pnrAmount);
    await escrow.connect(seller)['createOffer(uint256,uint256)'](pnrAmount, usdtPrice);

    // Contract holds exactly 1,000 PNR, which is 100% committed to order #1
    expect(await pnr.balanceOf(await escrow.getAddress())).to.equal(pnrAmount);
    expect(await escrow.totalPnrInEscrow()).to.equal(pnrAmount);

    // Owner cannot sweep when there is no surplus
    await expect(
      escrow.connect(owner).recoverUnallocated(await pnr.getAddress(), owner.address)
    ).to.be.revertedWithCustomError(escrow, 'NoUnallocatedTokens');

    // Someone accidentally sends 50 PNR directly to the escrow contract
    const accidentalPnr = ethers.parseEther('50');
    await pnr.transfer(await escrow.getAddress(), accidentalPnr);

    expect(await pnr.balanceOf(await escrow.getAddress())).to.equal(ethers.parseEther('1050'));
    expect(await escrow.totalPnrInEscrow()).to.equal(ethers.parseEther('1000'));

    // Owner sweeps the surplus 50 PNR
    const ownerInitialPnr = await pnr.balanceOf(owner.address);
    await expect(escrow.connect(owner).recoverUnallocated(await pnr.getAddress(), owner.address))
      .to.emit(escrow, 'UnallocatedRecovered')
      .withArgs(await pnr.getAddress(), owner.address, accidentalPnr);

    // Exactly 50 PNR recovered, active order remains 100% solvent
    expect(await pnr.balanceOf(owner.address)).to.equal(ownerInitialPnr + accidentalPnr);
    expect(await pnr.balanceOf(await escrow.getAddress())).to.equal(ethers.parseEther('1000'));
    expect(await escrow.totalPnrInEscrow()).to.equal(ethers.parseEther('1000'));

    // Buyer fills the order with zero issue
    await usdt.connect(buyer).approve(await escrow.getAddress(), usdtPrice);
    await escrow.connect(buyer)['fillOffer(uint256)'](1);
    expect(await pnr.balanceOf(buyer.address)).to.equal(pnrAmount);
  });

  it('prevents seller from buying their own offer', async () => {
    const pnrAmount = ethers.parseEther('100');
    const usdtPrice = ethers.parseUnits('5', 6);

    await pnr.connect(seller).approve(await escrow.getAddress(), pnrAmount);
    await escrow.connect(seller)['createOffer(uint256,uint256)'](pnrAmount, usdtPrice);

    await usdt.connect(seller).approve(await escrow.getAddress(), usdtPrice);
    await expect(escrow.connect(seller)['fillOffer(uint256)'](1)).to.be.revertedWithCustomError(escrow, 'CannotBuyOwnOffer');
  });

  it('enforces emergency pause on offer creation and filling', async () => {
    await escrow.pause();

    await pnr.connect(seller).approve(await escrow.getAddress(), ethers.parseEther('100'));
    await expect(escrow.connect(seller)['createOffer(uint256,uint256)'](ethers.parseEther('100'), 1000)).to.be.reverted;

    await escrow.unpause();
    await escrow.connect(seller)['createOffer(uint256,uint256)'](ethers.parseEther('100'), 1000);

    await escrow.pause();
    await usdt.connect(buyer).approve(await escrow.getAddress(), 1000);
    await expect(escrow.connect(buyer)['fillOffer(uint256)'](1)).to.be.reverted;
  });
});

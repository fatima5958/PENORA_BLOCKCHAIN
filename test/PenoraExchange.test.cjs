const {expect}=require('chai');
const {ethers}=require('hardhat');
const {time}=require('@nomicfoundation/hardhat-network-helpers');

describe('Penora inventory-backed exchange',function(){
 let owner,buyer,other,pnr,usdt,desk;
 // Initial rate: 1 PNR = 0.20 MockUSDT -> 1 MockUSDT = 5 PNR -> pnrPerUsdt = 5 * 10^18
 const rate=ethers.parseEther('5');

 beforeEach(async()=>{
  [owner,buyer,other]=await ethers.getSigners();
  pnr=await (await ethers.getContractFactory('PenoraToken')).deploy(owner.address, ethers.ZeroAddress, 0);
  usdt=await (await ethers.getContractFactory('MockUSDT')).deploy('Test USDT','USDT',ethers.parseUnits('10000',6),owner.address);
  desk=await (await ethers.getContractFactory('PenoraExchange')).deploy(pnr.target,usdt.target,owner.address,rate);
  await pnr.transfer(desk.target,ethers.parseEther('1000'));
  await usdt.transfer(buyer.address,ethers.parseUnits('100',6));
  await usdt.connect(buyer).approve(desk.target,ethers.parseUnits('100',6));
 });

 it('quotes exact 6-to-18 decimal conversion including a single micro-USDT (5 PNR/USDT = 0.20 USDT/PNR)',async()=>{
  // 2.0 USDT = 10 PNR
  expect(await desk.quoteBuy(ethers.parseUnits('2',6))).to.equal(ethers.parseEther('10'));
  // 1 micro-USDT = 5 * 10^12 wei PNR
  expect(await desk.quoteBuy(1)).to.equal(5000000000000n);
 });

 it('atomically receives USDT and delivers PNR to the signing buyer at 5 PNR/USDT',async()=>{
  const input=ethers.parseUnits('2',6),out=ethers.parseEther('10');
  await expect(desk.connect(buyer).buy(input,out,(await time.latest())+100)).to.emit(desk,'Purchased').withArgs(buyer.address,input,out);
  expect(await pnr.balanceOf(buyer.address)).to.equal(out);
  expect(await usdt.balanceOf(desk.target)).to.equal(input);
 });

 it('rejects a changed owner rate below the reviewed minimum without taking USDT',async()=>{
  await desk.setRate(ethers.parseEther('4'));
  await expect(desk.connect(buyer).buy(1000000,ethers.parseEther('4.9'),(await time.latest())+100)).to.be.revertedWithCustomError(desk,'MinimumOutput');
  expect(await usdt.balanceOf(desk.target)).to.equal(0);
 });

 it('honors better rates at execution',async()=>{
  await desk.setRate(ethers.parseEther('6'));
  await desk.connect(buyer).buy(1000000,ethers.parseEther('4.9'),(await time.latest())+100);
  expect(await pnr.balanceOf(buyer.address)).to.equal(ethers.parseEther('6'));
 });

 it('rejects expired quotes',async()=>{
  await expect(desk.connect(buyer).buy(1000000,1,(await time.latest())-1)).to.be.revertedWithCustomError(desk,'QuoteExpired');
 });

 it('cannot collect USDT when PNR inventory is insufficient',async()=>{
  // Trying to buy with 250 USDT at 5 PNR/USDT = 1,250 PNR (desk has only 1,000 PNR)
  await expect(desk.connect(buyer).buy(ethers.parseUnits('250',6),1,(await time.latest())+100)).to.be.revertedWithCustomError(desk,'InsufficientInventory');
  expect(await usdt.balanceOf(buyer.address)).to.equal(ethers.parseUnits('100',6));
 });

 it('requires allowance and rejects zero input/minimum',async()=>{
  await usdt.connect(buyer).approve(desk.target,0);
  await expect(desk.connect(buyer).buy(1000000,1,(await time.latest())+100)).to.be.reverted;
  await expect(desk.connect(buyer).buy(0,1,(await time.latest())+100)).to.be.revertedWithCustomError(desk,'InvalidAmount');
  await expect(desk.connect(buyer).buy(1,0,(await time.latest())+100)).to.be.revertedWithCustomError(desk,'InvalidAmount');
 });

 it('restricts price/withdrawal/pause to owner and enforces pause',async()=>{
  await expect(desk.connect(other).setRate(1)).to.be.reverted;
  await expect(desk.connect(other).withdraw(pnr.target,other.address,1)).to.be.reverted;
  await expect(desk.connect(other).pause()).to.be.reverted;
  await desk.pause();
  await expect(desk.connect(buyer).buy(1000000,1,(await time.latest())+100)).to.be.revertedWithCustomError(desk,'EnforcedPause');
  await desk.unpause();
  await desk.connect(buyer).buy(1000000,1,(await time.latest())+100);
 });

 it('rejects zero rate and reversed token decimal configuration',async()=>{
  const factory=await ethers.getContractFactory('PenoraExchange');
  await expect(factory.deploy(pnr.target,usdt.target,owner.address,0)).to.be.revertedWithCustomError(factory,'InvalidConfiguration');
  await expect(factory.deploy(usdt.target,pnr.target,owner.address,rate)).to.be.revertedWithCustomError(factory,'InvalidConfiguration');
 });
});

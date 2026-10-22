const {expect}=require('chai');
const {ethers}=require('hardhat');
const {time}=require('@nomicfoundation/hardhat-network-helpers');
describe('Penora inventory-backed exchange',function(){
 let owner,buyer,other,pnr,usdt,desk;const rate=ethers.parseEther('20');
 beforeEach(async()=>{
  [owner,buyer,other]=await ethers.getSigners();
  pnr=await (await ethers.getContractFactory('PenoraToken')).deploy(owner.address);
  usdt=await (await ethers.getContractFactory('MockUSDT')).deploy('Test USDT','USDT',ethers.parseUnits('10000',6),owner.address);
  desk=await (await ethers.getContractFactory('PenoraExchange')).deploy(pnr.target,usdt.target,owner.address,rate);
  await pnr.transfer(desk.target,ethers.parseEther('1000'));
  await usdt.transfer(buyer.address,ethers.parseUnits('100',6));
  await usdt.connect(buyer).approve(desk.target,ethers.parseUnits('100',6));
 });
 it('quotes exact 6-to-18 decimal conversion including a single micro-USDT',async()=>{
  expect(await desk.quoteBuy(ethers.parseUnits('2.123456',6))).to.equal(ethers.parseEther('42.46912'));
  expect(await desk.quoteBuy(1)).to.equal(20000000000000n);
 });
 it('atomically receives USDT and delivers PNR to the signing buyer',async()=>{
  const input=ethers.parseUnits('2.123456',6),out=ethers.parseEther('42.46912');
  await expect(desk.connect(buyer).buy(input,out,(await time.latest())+100)).to.emit(desk,'Purchased').withArgs(buyer.address,input,out);
  expect(await pnr.balanceOf(buyer.address)).to.equal(out);
  expect(await usdt.balanceOf(desk.target)).to.equal(input);
 });
 it('rejects a changed owner rate below the reviewed minimum without taking USDT',async()=>{
  await desk.setRate(ethers.parseEther('10'));
  await expect(desk.connect(buyer).buy(1000000,ethers.parseEther('19.9'),(await time.latest())+100)).to.be.revertedWithCustomError(desk,'MinimumOutput');
  expect(await usdt.balanceOf(desk.target)).to.equal(0);
 });
 it('honors better rates at execution',async()=>{
  await desk.setRate(ethers.parseEther('21'));
  await desk.connect(buyer).buy(1000000,ethers.parseEther('19.9'),(await time.latest())+100);
  expect(await pnr.balanceOf(buyer.address)).to.equal(ethers.parseEther('21'));
 });
 it('rejects expired quotes',async()=>{await expect(desk.connect(buyer).buy(1000000,1,(await time.latest())-1)).to.be.revertedWithCustomError(desk,'QuoteExpired');});
 it('cannot collect USDT when PNR inventory is insufficient',async()=>{
  await expect(desk.connect(buyer).buy(ethers.parseUnits('51',6),1,(await time.latest())+100)).to.be.revertedWithCustomError(desk,'InsufficientInventory');
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
  await desk.unpause();await desk.connect(buyer).buy(1000000,1,(await time.latest())+100);
 });
 it('rejects zero rate and reversed token decimal configuration',async()=>{
  const factory=await ethers.getContractFactory('PenoraExchange');
  await expect(factory.deploy(pnr.target,usdt.target,owner.address,0)).to.be.revertedWithCustomError(factory,'InvalidConfiguration');
  await expect(factory.deploy(usdt.target,pnr.target,owner.address,rate)).to.be.revertedWithCustomError(factory,'InvalidConfiguration');
 });
});

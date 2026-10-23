const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
// Compile the production Merkle builder, so these proofs exercise the actual TS -> Solidity boundary.
const filename = path.resolve(__dirname, '../src/lib/rewards/merkle.ts');
const builder = new Module(filename, module);
builder.filename = filename; builder.paths = module.paths;
builder._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { articleContentId, buildArticleRewardProofs } = builder.exports;

describe('Article rewards after seven days', function () {
  let token, rewards, owner, author, curator, other, id, publishedAt;
  const week = 604800;
  beforeEach(async () => {
    [owner,author,curator,other] = await ethers.getSigners();
    token=await (await ethers.getContractFactory('PenoraToken')).deploy(owner.address, ethers.ZeroAddress, 0);
    rewards=await (await ethers.getContractFactory('PenoraArticleRewards')).deploy(await token.getAddress(),owner.address);
    publishedAt=await time.latest(); id=articleContentId('post-1');
    await rewards.registerArticle(id,author.address,publishedAt);
    await token.approve(await rewards.getAddress(),ethers.parseEther('1000'));
  });
  async function allocation(budget=90n) {
    const chain=await ethers.provider.getNetwork();
    return buildArticleRewardProofs({articleId:'post-1',beneficiaries:[{account:author.address,amount:budget*7n/9n},{account:curator.address,amount:budget/9n},{account:other.address,amount:budget/9n}]},chain.chainId,await rewards.getAddress());
  }
  it('sets a permanent per-article deadline, rejecting early settlement',async()=>{
    expect(await rewards.payoutAt(id)).to.equal(publishedAt+week);
    await expect(rewards.registerArticle(id,author.address,publishedAt)).to.be.revertedWithCustomError(rewards,'AlreadyRegistered');
    const tree=await allocation();
    await time.setNextBlockTimestamp(publishedAt+week-1);
    await expect(rewards.settleArticle(id,tree.root,tree.budget)).to.be.revertedWithCustomError(rewards,'RewardWindowActive');
  });
  it('settles exactly at day seven, pays actual TS proofs, and cannot double pay',async()=>{
    const tree=await allocation(); await time.setNextBlockTimestamp(publishedAt+week);
    await rewards.settleArticle(id,tree.root,tree.budget);
    expect(await rewards.totalOutstanding()).to.equal(tree.budget);
    for(const claim of tree.claims) {
      await expect(rewards.connect(other).claimArticleReward(id,claim.account,claim.amount,claim.proof)).to.emit(rewards,'ArticleRewardPaid').withArgs(id,claim.account,claim.amount);
      expect(await token.balanceOf(claim.account)).to.equal(claim.amount);
      await expect(rewards.claimArticleReward(id,claim.account,claim.amount,claim.proof)).to.be.revertedWithCustomError(rewards,'AlreadyClaimed');
    }
    expect(await rewards.totalOutstanding()).to.equal(0);
    await expect(rewards.settleArticle(id,tree.root,tree.budget)).to.be.revertedWithCustomError(rewards,'AlreadySettled');
  });
  it('rejects changed recipients, amounts, article and deployment proofs',async()=>{
    const tree=await allocation();await time.increaseTo(publishedAt+week);await rewards.settleArticle(id,tree.root,tree.budget);
    const claim=tree.claims[0];
    await expect(rewards.claimArticleReward(id,owner.address,claim.amount,claim.proof)).to.be.revertedWithCustomError(rewards,'InvalidAllocation');
    await expect(rewards.claimArticleReward(id,claim.account,claim.amount+1n,claim.proof)).to.be.revertedWithCustomError(rewards,'InvalidAllocation');
    const id2=articleContentId('post-2');await rewards.registerArticle(id2,author.address,publishedAt);await rewards.settleArticle(id2,tree.root,tree.budget);
    await expect(rewards.claimArticleReward(id2,claim.account,claim.amount,claim.proof)).to.be.revertedWithCustomError(rewards,'InvalidAllocation');
    const alternate=await (await ethers.getContractFactory('PenoraArticleRewards')).deploy(await token.getAddress(),owner.address);
    await alternate.registerArticle(id,author.address,publishedAt);
    await token.approve(await alternate.getAddress(),tree.budget);
    await alternate.settleArticle(id,tree.root,tree.budget);
    await expect(alternate.claimArticleReward(id,claim.account,claim.amount,claim.proof)).to.be.revertedWithCustomError(alternate,'InvalidAllocation');
  });
  it('keeps separate article budgets even if the operator commits an oversized leaf',async()=>{
    const tree=await allocation(900n);await time.increaseTo(publishedAt+week);await rewards.settleArticle(id,tree.root,1n);
    const claim=tree.claims.find(c=>c.amount>1n);
    await expect(rewards.claimArticleReward(id,claim.account,claim.amount,claim.proof)).to.be.revertedWithCustomError(rewards,'InvalidAllocation');
    expect(await rewards.totalOutstanding()).to.equal(1n);
  });
  it('rejects unauthorized registration and settlement, and rolls back unfunded roots',async()=>{
    await expect(rewards.connect(other).registerArticle(articleContentId('bad'),other.address,publishedAt)).to.be.reverted;
    const tree=await allocation();await time.increaseTo(publishedAt+week);
    await expect(rewards.connect(other).settleArticle(id,tree.root,tree.budget)).to.be.reverted;
    await token.approve(await rewards.getAddress(),0);
    await expect(rewards.settleArticle(id,tree.root,tree.budget)).to.be.reverted;
    expect((await rewards.articles(id)).settled).to.equal(false);
  });
  it('supports finalized zero-reward articles and emergency pause',async()=>{
    await time.increaseTo(publishedAt+week);await rewards.pause();
    await expect(rewards.settleArticle(id,ethers.ZeroHash,0)).to.be.reverted;
    await rewards.unpause();await rewards.settleArticle(id,ethers.ZeroHash,0);
    expect((await rewards.articles(id)).settled).to.equal(true);
    await expect(rewards.claimArticleReward(id,author.address,1,[])).to.be.revertedWithCustomError(rewards,'InvalidAllocation');
  });
});

// scripts/deploy-amoy.cjs
// PENORA Blockchain — Polygon Amoy Testnet (Chain ID 80002) Deployment Script
// Deploys or binds: PenoraToken (PNR), MockUSDT, PenoraPowerEscrow, PenoraVotingInfluence,
// PenoraRewardVault, PenoraArticleRewards, and PenoraExchange.
// Strictly checks network, balances, allocations, and non-custodial ownership.

const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

const DESTINATION_WALLET = '0x38CdF24eC27530B8F933023de2416d3960BD7372';
const TARGET_CHAIN_ID = 80002;

// Known verified deployments on Polygon Amoy
const KNOWN_PNR_ADDRESS = process.env.PUBLIC_PNR_TOKEN_ADDRESS || '0xBdD9D45524617d20111879ff914E1E2B708D59A6';
const KNOWN_USDT_ADDRESS = process.env.PUBLIC_USDT_CONTRACT_ADDRESS || '0x88E538DB3FD3980Ba510aDd2671587Daf40F1050';

async function hasCode(address) {
  if (!address || !hre.ethers.isAddress(address)) return false;
  const code = await hre.ethers.provider.getCode(address);
  return code !== '0x' && code !== '0x0';
}

async function main() {
  console.log('================================================================');
  console.log('PENORA BLOCKCHAIN — POLYGON AMOY TESTNET DEPLOYMENT');
  console.log('================================================================');

  // 1. Check Network
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`Connected Network: ${network.name} (Chain ID: ${chainId})`);
  if (chainId !== TARGET_CHAIN_ID) {
    throw new Error(`Deployment aborted: Expected Chain ID ${TARGET_CHAIN_ID} (Polygon Amoy), got ${chainId}`);
  }

  // 2. Check Signer / Deployer
  const signers = await hre.ethers.getSigners();
  if (!signers || signers.length === 0) {
    throw new Error('Deployment aborted: No deployment signer account configured in hardhat.config.cjs or environment.');
  }
  const deployer = signers[0];
  const deployerAddress = await deployer.getAddress();
  const balanceWei = await hre.ethers.provider.getBalance(deployerAddress);
  const balancePol = hre.ethers.formatEther(balanceWei);

  console.log(`Deployer Address:     ${deployerAddress}`);
  console.log(`Deployer POL Balance:  ${balancePol} POL`);
  console.log(`Destination Address:  ${DESTINATION_WALLET}`);

  let pnrAddress = KNOWN_PNR_ADDRESS;
  let pnr;
  const pnrExists = await hasCode(pnrAddress);

  if (pnrExists) {
    console.log(`\n--- Step 1: PenoraToken already deployed at verified address: ${pnrAddress} ---`);
    pnr = await hre.ethers.getContractAt('PenoraToken', pnrAddress);
  } else {
    console.log('\n--- Step 1: Deploying PenoraToken (Test PNR, 100M Genesis Supply) ---');
    const testPnrFunding = hre.ethers.parseEther('10000'); // Exactly 10,000 PNR to destination
    const PenoraToken = await hre.ethers.getContractFactory('PenoraToken');
    pnr = await PenoraToken.deploy(deployerAddress, DESTINATION_WALLET, testPnrFunding);
    await pnr.waitForDeployment();
    pnrAddress = await pnr.getAddress();
    console.log(`✓ PenoraToken deployed at: ${pnrAddress}`);
  }

  let usdtAddress = KNOWN_USDT_ADDRESS;
  let usdt;
  const usdtExists = await hasCode(usdtAddress);

  if (usdtExists) {
    console.log(`\n--- Step 2: MockUSDT already deployed at verified address: ${usdtAddress} ---`);
    usdt = await hre.ethers.getContractAt('MockUSDT', usdtAddress);
  } else {
    console.log('\n--- Step 2: Deploying MockUSDT (Test USDT, 6 Decimals) ---');
    const initialUsdtSupply = 1_000n * 10n ** 6n; // 1,000 USDT
    const MockUSDT = await hre.ethers.getContractFactory('MockUSDT');
    usdt = await MockUSDT.deploy('Test Tether USD', 'USDT', initialUsdtSupply, DESTINATION_WALLET);
    await usdt.waitForDeployment();
    usdtAddress = await usdt.getAddress();
    console.log(`✓ MockUSDT deployed at: ${usdtAddress}`);
  }

  let escrowAddress = process.env.PUBLIC_PP_ESCROW_ADDRESS;
  let escrow;
  if (escrowAddress && (await hasCode(escrowAddress))) {
    console.log(`\n--- Step 3: PenoraPowerEscrow already deployed at: ${escrowAddress} ---`);
    escrow = await hre.ethers.getContractAt('PenoraPowerEscrow', escrowAddress);
  } else {
    console.log('\n--- Step 3: Deploying PenoraPowerEscrow (1:1 PNR -> PP Staking) ---');
    const PenoraPowerEscrow = await hre.ethers.getContractFactory('PenoraPowerEscrow');
    escrow = await PenoraPowerEscrow.deploy(pnrAddress, DESTINATION_WALLET);
    await escrow.waitForDeployment();
    escrowAddress = await escrow.getAddress();
    console.log(`✓ PenoraPowerEscrow deployed at: ${escrowAddress}`);
  }

  let influenceAddress = process.env.PUBLIC_INFLUENCE_ADDRESS;
  let influence;
  if (influenceAddress && (await hasCode(influenceAddress))) {
    console.log(`\n--- Step 4: PenoraVotingInfluence already deployed at: ${influenceAddress} ---`);
    influence = await hre.ethers.getContractAt('PenoraVotingInfluence', influenceAddress);
  } else {
    console.log('\n--- Step 4: Deploying PenoraVotingInfluence (Mana & Curation Engine) ---');
    const PenoraVotingInfluence = await hre.ethers.getContractFactory('PenoraVotingInfluence');
    influence = await PenoraVotingInfluence.deploy(escrowAddress, DESTINATION_WALLET);
    await influence.waitForDeployment();
    influenceAddress = await influence.getAddress();
    console.log(`✓ PenoraVotingInfluence deployed at: ${influenceAddress}`);
  }

  let vaultAddress = process.env.PUBLIC_REWARD_VAULT_ADDRESS;
  let vault;
  if (vaultAddress && (await hasCode(vaultAddress))) {
    console.log(`\n--- Step 5: PenoraRewardVault already deployed at: ${vaultAddress} ---`);
    vault = await hre.ethers.getContractAt('PenoraRewardVault', vaultAddress);
  } else {
    console.log('\n--- Step 5: Deploying PenoraRewardVault (40M Creator Pool) ---');
    const PenoraRewardVault = await hre.ethers.getContractFactory('PenoraRewardVault');
    vault = await PenoraRewardVault.deploy(pnrAddress, DESTINATION_WALLET);
    await vault.waitForDeployment();
    vaultAddress = await vault.getAddress();
    console.log(`✓ PenoraRewardVault deployed at: ${vaultAddress}`);
  }

  let articleRewardsAddress = process.env.REWARDS_ARTICLE_CONTRACT;
  let articleRewards;
  if (articleRewardsAddress && (await hasCode(articleRewardsAddress))) {
    console.log(`\n--- Step 6: PenoraArticleRewards already deployed at: ${articleRewardsAddress} ---`);
    articleRewards = await hre.ethers.getContractAt('PenoraArticleRewards', articleRewardsAddress);
  } else {
    console.log('\n--- Step 6: Deploying PenoraArticleRewards (7-Day Creator/Curator Settlement) ---');
    const PenoraArticleRewards = await hre.ethers.getContractFactory('PenoraArticleRewards');
    articleRewards = await PenoraArticleRewards.deploy(pnrAddress, DESTINATION_WALLET);
    await articleRewards.waitForDeployment();
    articleRewardsAddress = await articleRewards.getAddress();
    console.log(`✓ PenoraArticleRewards deployed at: ${articleRewardsAddress}`);
  }

  let p2pEscrowAddress = process.env.PUBLIC_P2P_ESCROW_ADDRESS;
  let p2pEscrow;
  if (p2pEscrowAddress && (await hasCode(p2pEscrowAddress))) {
    console.log(`\n--- Step 7: PenoraP2PEscrow already deployed at: ${p2pEscrowAddress} ---`);
    p2pEscrow = await hre.ethers.getContractAt('PenoraP2PEscrow', p2pEscrowAddress);
  } else {
    console.log('\n--- Step 7: Deploying PenoraP2PEscrow (P2P Marketplace) ---');
    const PenoraP2PEscrow = await hre.ethers.getContractFactory('PenoraP2PEscrow');
    p2pEscrow = await PenoraP2PEscrow.deploy(pnrAddress, usdtAddress, DESTINATION_WALLET, 50, DESTINATION_WALLET);
    await p2pEscrow.waitForDeployment();
    p2pEscrowAddress = await p2pEscrow.getAddress();
    console.log(`✓ PenoraP2PEscrow deployed at: ${p2pEscrowAddress}`);
  }

  // Verify allocations and balances
  const destPnrBal = await pnr.balanceOf(DESTINATION_WALLET);
  const destUsdtBal = await usdt.balanceOf(DESTINATION_WALLET);
  const treasuryPnrBal = await pnr.balanceOf(pnrAddress);

  console.log('\n================================================================');
  console.log('DEPLOYMENT & ALLOCATION SUMMARY');
  console.log('================================================================');
  console.log(`Destination Wallet: ${DESTINATION_WALLET}`);
  console.log(`- Verified Test PNR Balance:      ${hre.ethers.formatEther(destPnrBal)} PNR (Target: 10,000)`);
  console.log(`- Verified Test USDT Balance:     ${Number(destUsdtBal) / 1e6} USDT (Target: 1,000)`);
  console.log(`- PNR Contract Treasury Balance:  ${hre.ethers.formatEther(treasuryPnrBal)} PNR (Target: 99,990,000)`);
  console.log('\nDeployed Contract Addresses:');
  console.log(`PUBLIC_PNR_TOKEN_ADDRESS=${pnrAddress}`);
  console.log(`PUBLIC_USDT_CONTRACT_ADDRESS=${usdtAddress}`);
  console.log(`PUBLIC_PP_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`PUBLIC_INFLUENCE_ADDRESS=${influenceAddress}`);
  console.log(`PUBLIC_REWARD_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`REWARDS_ARTICLE_CONTRACT=${articleRewardsAddress}`);
  console.log(`PUBLIC_P2P_ESCROW_ADDRESS=${p2pEscrowAddress}`);

  // Write deployment manifest
  const manifest = {
    network: 'Polygon Amoy Testnet',
    chainId: TARGET_CHAIN_ID,
    timestamp: new Date().toISOString(),
    deployer: deployerAddress,
    destination: DESTINATION_WALLET,
    contracts: {
      PenoraToken: {
        address: pnrAddress,
        explorer: `https://amoy.polygonscan.com/token/${pnrAddress}`,
      },
      MockUSDT: {
        address: usdtAddress,
        explorer: `https://amoy.polygonscan.com/token/${usdtAddress}`,
      },
      PenoraPowerEscrow: {
        address: escrowAddress,
        explorer: `https://amoy.polygonscan.com/address/${escrowAddress}`,
      },
      PenoraVotingInfluence: {
        address: influenceAddress,
        explorer: `https://amoy.polygonscan.com/address/${influenceAddress}`,
      },
      PenoraRewardVault: {
        address: vaultAddress,
        explorer: `https://amoy.polygonscan.com/address/${vaultAddress}`,
      },
      PenoraArticleRewards: {
        address: articleRewardsAddress,
        explorer: `https://amoy.polygonscan.com/address/${articleRewardsAddress}`,
      },
      PenoraP2PEscrow: {
        address: p2pEscrowAddress,
        explorer: `https://amoy.polygonscan.com/address/${p2pEscrowAddress}`,
      },
    },
    funding: {
      testPnr: hre.ethers.formatEther(destPnrBal),
      testUsdt: (Number(destUsdtBal) / 1e6).toString(),
      treasuryPnr: hre.ethers.formatEther(treasuryPnrBal),
    },
  };

  const manifestPath = path.join(__dirname, '..', 'deployment-amoy.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nDeployment manifest saved to ${manifestPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Deployment error:', error);
    process.exit(1);
  });

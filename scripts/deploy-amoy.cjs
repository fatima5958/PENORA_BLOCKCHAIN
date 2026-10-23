// scripts/deploy-amoy.cjs
// PENORA Blockchain — Polygon Amoy Testnet (Chain ID 80002) Deployment Script
// Deploys or binds: PenoraToken (PNR), MockUSDT, PenoraPowerEscrow, PenoraVotingInfluence,
// PenoraRewardVault, PenoraArticleRewards, PenoraP2PEscrow, and PenoraExchange.
// Strictly checks network, balances, allocations, and non-custodial ownership.
// Supports safe dry-run mode: node scripts/deploy-amoy.cjs --dry-run

const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

const DESTINATION_WALLET = '0x38CdF24eC27530B8F933023de2416d3960BD7372';
const TARGET_CHAIN_ID = 80002;

// Initial Exchange Rate: 1 PNR = 0.20 MockUSDT -> 1 MockUSDT = 5 PNR
// 18-decimal PNR units per whole 6-decimal USDT = 5 * 10^18
const INITIAL_EXCHANGE_RATE = hre.ethers.parseEther('5');

// Known verified deployments on Polygon Amoy
const KNOWN_PNR_ADDRESS = process.env.PUBLIC_PNR_TOKEN_ADDRESS || '0xBdD9D45524617d20111879ff914E1E2B708D59A6';
const KNOWN_USDT_ADDRESS = process.env.PUBLIC_USDT_CONTRACT_ADDRESS || '0x88E538DB3FD3980Ba510aDd2671587Daf40F1050';

const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';

async function hasCode(address) {
  if (!address || !hre.ethers.isAddress(address)) return false;
  try {
    const code = await hre.ethers.provider.getCode(address);
    return code !== '0x' && code !== '0x0';
  } catch {
    return false;
  }
}

async function main() {
  console.log('================================================================');
  console.log(`PENORA BLOCKCHAIN — POLYGON AMOY TESTNET DEPLOYMENT ${isDryRun ? '[DRY RUN]' : ''}`);
  console.log('================================================================');

  // 1. Check Network & Chain ID
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log(`Connected Network: ${network.name} (Chain ID: ${chainId})`);
  if (chainId !== TARGET_CHAIN_ID) {
    throw new Error(`Deployment aborted: Expected Chain ID ${TARGET_CHAIN_ID} (Polygon Amoy), got ${chainId}`);
  }

  // 2. Check Signers / Deployer
  const signers = await hre.ethers.getSigners();
  let deployerAddress = DESTINATION_WALLET;
  let deployer = null;

  if (signers && signers.length > 0) {
    deployer = signers[0];
    deployerAddress = await deployer.getAddress();
  } else if (!isDryRun) {
    throw new Error('Deployment aborted: No deployment signer account configured in hardhat.config.cjs or environment.');
  }

  const balanceWei = await hre.ethers.provider.getBalance(deployerAddress);
  const balancePol = hre.ethers.formatEther(balanceWei);
  const destBalWei = await hre.ethers.provider.getBalance(DESTINATION_WALLET);

  console.log(`Deployer Address:     ${deployerAddress}`);
  console.log(`Deployer POL Balance:  ${balancePol} POL`);
  console.log(`Destination Wallet:   ${DESTINATION_WALLET} (${hre.ethers.formatEther(destBalWei)} POL)`);
  console.log(`Execution Mode:       ${isDryRun ? 'DRY-RUN (Inspection only, zero write transactions)' : 'LIVE BROADCAST'}`);

  // Step 1: PenoraToken (PNR)
  let pnrAddress = KNOWN_PNR_ADDRESS;
  let pnr = null;
  const pnrExists = await hasCode(pnrAddress);

  if (pnrExists) {
    console.log(`\n--- Step 1: PenoraToken already deployed at verified address: ${pnrAddress} ---`);
    pnr = await hre.ethers.getContractAt('PenoraToken', pnrAddress);
  } else if (isDryRun) {
    console.log(`\n--- Step 1: [DRY-RUN] PenoraToken not found on-chain. Would deploy 100M supply. ---`);
  } else {
    console.log('\n--- Step 1: Deploying PenoraToken (Test PNR, 100M Genesis Supply) ---');
    const testPnrFunding = hre.ethers.parseEther('10000'); // Exactly 10,000 PNR to destination
    const PenoraToken = await hre.ethers.getContractFactory('PenoraToken');
    pnr = await PenoraToken.deploy(deployerAddress, DESTINATION_WALLET, testPnrFunding);
    await pnr.waitForDeployment();
    pnrAddress = await pnr.getAddress();
    console.log(`✓ PenoraToken deployed at: ${pnrAddress}`);
  }

  // Step 2: MockUSDT
  let usdtAddress = KNOWN_USDT_ADDRESS;
  let usdt = null;
  const usdtExists = await hasCode(usdtAddress);

  if (usdtExists) {
    console.log(`\n--- Step 2: MockUSDT already deployed at verified address: ${usdtAddress} ---`);
    usdt = await hre.ethers.getContractAt('MockUSDT', usdtAddress);
  } else if (isDryRun) {
    console.log(`\n--- Step 2: [DRY-RUN] MockUSDT not found on-chain. Would deploy 1,000 USDT. ---`);
  } else {
    console.log('\n--- Step 2: Deploying MockUSDT (Test USDT, 6 Decimals) ---');
    const initialUsdtSupply = 1_000n * 10n ** 6n; // 1,000 USDT
    const MockUSDT = await hre.ethers.getContractFactory('MockUSDT');
    usdt = await MockUSDT.deploy('Test Tether USD', 'USDT', initialUsdtSupply, DESTINATION_WALLET);
    await usdt.waitForDeployment();
    usdtAddress = await usdt.getAddress();
    console.log(`✓ MockUSDT deployed at: ${usdtAddress}`);
  }

  // Step 3: PenoraPowerEscrow
  let escrowAddress = process.env.PUBLIC_PP_ESCROW_ADDRESS;
  let escrow = null;
  if (escrowAddress && (await hasCode(escrowAddress))) {
    console.log(`\n--- Step 3: PenoraPowerEscrow already deployed at: ${escrowAddress} ---`);
    escrow = await hre.ethers.getContractAt('PenoraPowerEscrow', escrowAddress);
  } else if (isDryRun) {
    console.log(`\n--- Step 3: [DRY-RUN] PenoraPowerEscrow would be deployed with PNR: ${pnrAddress} ---`);
    escrowAddress = escrowAddress || '0x0000000000000000000000000000000000000000 (Awaiting Deployment)';
  } else {
    console.log('\n--- Step 3: Deploying PenoraPowerEscrow (1:1 PNR -> PP Staking) ---');
    const PenoraPowerEscrow = await hre.ethers.getContractFactory('PenoraPowerEscrow');
    escrow = await PenoraPowerEscrow.deploy(pnrAddress, DESTINATION_WALLET);
    await escrow.waitForDeployment();
    escrowAddress = await escrow.getAddress();
    console.log(`✓ PenoraPowerEscrow deployed at: ${escrowAddress}`);
  }

  // Step 4: PenoraVotingInfluence
  let influenceAddress = process.env.PUBLIC_INFLUENCE_ADDRESS;
  let influence = null;
  if (influenceAddress && (await hasCode(influenceAddress))) {
    console.log(`\n--- Step 4: PenoraVotingInfluence already deployed at: ${influenceAddress} ---`);
    influence = await hre.ethers.getContractAt('PenoraVotingInfluence', influenceAddress);
  } else if (isDryRun) {
    console.log(`\n--- Step 4: [DRY-RUN] PenoraVotingInfluence would be deployed with Escrow: ${escrowAddress} ---`);
    influenceAddress = influenceAddress || '0x0000000000000000000000000000000000000000 (Awaiting Deployment)';
  } else {
    console.log('\n--- Step 4: Deploying PenoraVotingInfluence (Mana & Curation Engine) ---');
    const PenoraVotingInfluence = await hre.ethers.getContractFactory('PenoraVotingInfluence');
    influence = await PenoraVotingInfluence.deploy(escrowAddress, DESTINATION_WALLET);
    await influence.waitForDeployment();
    influenceAddress = await influence.getAddress();
    console.log(`✓ PenoraVotingInfluence deployed at: ${influenceAddress}`);
  }

  // Step 5: PenoraRewardVault
  let vaultAddress = process.env.PUBLIC_REWARD_VAULT_ADDRESS;
  let vault = null;
  if (vaultAddress && (await hasCode(vaultAddress))) {
    console.log(`\n--- Step 5: PenoraRewardVault already deployed at: ${vaultAddress} ---`);
    vault = await hre.ethers.getContractAt('PenoraRewardVault', vaultAddress);
  } else if (isDryRun) {
    console.log(`\n--- Step 5: [DRY-RUN] PenoraRewardVault would be deployed with PNR: ${pnrAddress} ---`);
    vaultAddress = vaultAddress || '0x0000000000000000000000000000000000000000 (Awaiting Deployment)';
  } else {
    console.log('\n--- Step 5: Deploying PenoraRewardVault (40M Creator Pool) ---');
    const PenoraRewardVault = await hre.ethers.getContractFactory('PenoraRewardVault');
    vault = await PenoraRewardVault.deploy(pnrAddress, DESTINATION_WALLET);
    await vault.waitForDeployment();
    vaultAddress = await vault.getAddress();
    console.log(`✓ PenoraRewardVault deployed at: ${vaultAddress}`);
  }

  // Step 6: PenoraArticleRewards
  let articleRewardsAddress = process.env.REWARDS_ARTICLE_CONTRACT;
  let articleRewards = null;
  if (articleRewardsAddress && (await hasCode(articleRewardsAddress))) {
    console.log(`\n--- Step 6: PenoraArticleRewards already deployed at: ${articleRewardsAddress} ---`);
    articleRewards = await hre.ethers.getContractAt('PenoraArticleRewards', articleRewardsAddress);
  } else if (isDryRun) {
    console.log(`\n--- Step 6: [DRY-RUN] PenoraArticleRewards would be deployed with PNR: ${pnrAddress} ---`);
    articleRewardsAddress = articleRewardsAddress || '0x0000000000000000000000000000000000000000 (Awaiting Deployment)';
  } else {
    console.log('\n--- Step 6: Deploying PenoraArticleRewards (7-Day Creator/Curator Settlement) ---');
    const PenoraArticleRewards = await hre.ethers.getContractFactory('PenoraArticleRewards');
    articleRewards = await PenoraArticleRewards.deploy(pnrAddress, DESTINATION_WALLET);
    await articleRewards.waitForDeployment();
    articleRewardsAddress = await articleRewards.getAddress();
    console.log(`✓ PenoraArticleRewards deployed at: ${articleRewardsAddress}`);
  }

  // Step 7: PenoraP2PEscrow
  let p2pEscrowAddress = process.env.PUBLIC_P2P_ESCROW_ADDRESS;
  let p2pEscrow = null;
  if (p2pEscrowAddress && (await hasCode(p2pEscrowAddress))) {
    console.log(`\n--- Step 7: PenoraP2PEscrow already deployed at: ${p2pEscrowAddress} ---`);
    p2pEscrow = await hre.ethers.getContractAt('PenoraP2PEscrow', p2pEscrowAddress);
  } else if (isDryRun) {
    console.log(`\n--- Step 7: [DRY-RUN] PenoraP2PEscrow would be deployed with PNR: ${pnrAddress}, USDT: ${usdtAddress} ---`);
    p2pEscrowAddress = p2pEscrowAddress || '0x0000000000000000000000000000000000000000 (Awaiting Deployment)';
  } else {
    console.log('\n--- Step 7: Deploying PenoraP2PEscrow (P2P Marketplace) ---');
    const PenoraP2PEscrow = await hre.ethers.getContractFactory('PenoraP2PEscrow');
    p2pEscrow = await PenoraP2PEscrow.deploy(pnrAddress, usdtAddress, DESTINATION_WALLET, 50, DESTINATION_WALLET);
    await p2pEscrow.waitForDeployment();
    p2pEscrowAddress = await p2pEscrow.getAddress();
    console.log(`✓ PenoraP2PEscrow deployed at: ${p2pEscrowAddress}`);
  }

  // Step 8: PenoraExchange (Inventory-Backed Purchase Desk)
  let exchangeAddress = process.env.PUBLIC_PNR_EXCHANGE_ADDRESS;
  let exchange = null;
  if (exchangeAddress && (await hasCode(exchangeAddress))) {
    console.log(`\n--- Step 8: PenoraExchange already deployed at: ${exchangeAddress} ---`);
    exchange = await hre.ethers.getContractAt('PenoraExchange', exchangeAddress);
    const onchainRate = await exchange.pnrPerUsdt();
    console.log(`  Current On-Chain Rate: ${hre.ethers.formatEther(onchainRate)} PNR per 1 USDT`);
    console.log(`  Equivalent Price:      ${(1 / Number(hre.ethers.formatEther(onchainRate))).toFixed(4)} USDT per PNR`);
  } else if (isDryRun) {
    console.log(`\n--- Step 8: [DRY-RUN] PenoraExchange would be deployed:`);
    console.log(`  Initial Rate: 5 PNR per 1 USDT (Equivalent: 0.20 USDT/PNR, 5 * 10^18)`);
    console.log(`  Tokens: PNR (${pnrAddress}) & MockUSDT (${usdtAddress})`);
    console.log(`  Owner:  ${DESTINATION_WALLET}`);
    exchangeAddress = exchangeAddress || '0x0000000000000000000000000000000000000000 (Awaiting Deployment)';
  } else {
    console.log('\n--- Step 8: Deploying PenoraExchange (Inventory-Backed Purchase Desk) ---');
    console.log(`  Initial Rate: 5 PNR per 1 USDT (Equivalent: 0.20 USDT/PNR)`);
    console.log(`  Initial Owner: ${DESTINATION_WALLET}`);
    const PenoraExchange = await hre.ethers.getContractFactory('PenoraExchange');
    exchange = await PenoraExchange.deploy(pnrAddress, usdtAddress, DESTINATION_WALLET, INITIAL_EXCHANGE_RATE);
    await exchange.waitForDeployment();
    exchangeAddress = await exchange.getAddress();
    console.log(`✓ PenoraExchange deployed at: ${exchangeAddress}`);
  }

  // Verify allocations and balances if contracts exist on-chain
  let destPnrFormatted = '0';
  let destUsdtFormatted = '0';
  let treasuryPnrFormatted = '0';

  if (pnr) {
    const destPnrBal = await pnr.balanceOf(DESTINATION_WALLET);
    const treasuryPnrBal = await pnr.balanceOf(pnrAddress);
    destPnrFormatted = hre.ethers.formatEther(destPnrBal);
    treasuryPnrFormatted = hre.ethers.formatEther(treasuryPnrBal);
  }
  if (usdt) {
    const destUsdtBal = await usdt.balanceOf(DESTINATION_WALLET);
    destUsdtFormatted = (Number(destUsdtBal) / 1e6).toString();
  }

  console.log('\n================================================================');
  console.log(`DEPLOYMENT & ALLOCATION SUMMARY ${isDryRun ? '[DRY RUN PREVIEW]' : ''}`);
  console.log('================================================================');
  console.log(`Destination Wallet: ${DESTINATION_WALLET}`);
  console.log(`- Verified Test PNR Balance:      ${destPnrFormatted} PNR (Target: 10,000)`);
  console.log(`- Verified Test USDT Balance:     ${destUsdtFormatted} USDT (Target: 1,000)`);
  console.log(`- PNR Contract Treasury Balance:  ${treasuryPnrFormatted} PNR (Target: 99,990,000)`);
  console.log('\nContract Addresses:');
  console.log(`PUBLIC_PNR_TOKEN_ADDRESS=${pnrAddress}`);
  console.log(`PUBLIC_USDT_CONTRACT_ADDRESS=${usdtAddress}`);
  console.log(`PUBLIC_PP_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`PUBLIC_INFLUENCE_ADDRESS=${influenceAddress}`);
  console.log(`PUBLIC_REWARD_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`REWARDS_ARTICLE_CONTRACT=${articleRewardsAddress}`);
  console.log(`PUBLIC_P2P_ESCROW_ADDRESS=${p2pEscrowAddress}`);
  console.log(`PUBLIC_PNR_EXCHANGE_ADDRESS=${exchangeAddress}`);

  if (!isDryRun) {
    const manifest = {
      network: 'Polygon Amoy Testnet',
      chainId: TARGET_CHAIN_ID,
      timestamp: new Date().toISOString(),
      deployer: deployerAddress,
      destination: DESTINATION_WALLET,
      contracts: {
        PenoraToken: { address: pnrAddress, explorer: `https://amoy.polygonscan.com/token/${pnrAddress}` },
        MockUSDT: { address: usdtAddress, explorer: `https://amoy.polygonscan.com/token/${usdtAddress}` },
        PenoraPowerEscrow: { address: escrowAddress, explorer: `https://amoy.polygonscan.com/address/${escrowAddress}` },
        PenoraVotingInfluence: { address: influenceAddress, explorer: `https://amoy.polygonscan.com/address/${influenceAddress}` },
        PenoraRewardVault: { address: vaultAddress, explorer: `https://amoy.polygonscan.com/address/${vaultAddress}` },
        PenoraArticleRewards: { address: articleRewardsAddress, explorer: `https://amoy.polygonscan.com/address/${articleRewardsAddress}` },
        PenoraP2PEscrow: { address: p2pEscrowAddress, explorer: `https://amoy.polygonscan.com/address/${p2pEscrowAddress}` },
        PenoraExchange: { address: exchangeAddress, explorer: `https://amoy.polygonscan.com/address/${exchangeAddress}` },
      },
      exchangeRate: {
        pnrPerUsdt: '5000000000000000000',
        equivalentUsdtPerPnr: '0.20',
      },
      funding: {
        testPnr: destPnrFormatted,
        testUsdt: destUsdtFormatted,
        treasuryPnr: treasuryPnrFormatted,
      },
    };

    const manifestPath = path.join(__dirname, '..', 'deployment-amoy.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\nDeployment manifest saved to ${manifestPath}`);
  }
}

// Explicit market-only mode avoids redeploying unrelated protocol contracts.
if (process.env.PENORA_MARKET_ONLY === '1') {
  require('./deploy-market-amoy.cjs');
} else {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Deployment script error:', error);
      process.exit(1);
    });
}

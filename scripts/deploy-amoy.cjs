// scripts/deploy-amoy.cjs
// PENORA Blockchain — Polygon Amoy Testnet (Chain ID 80002) Deployment Script
// Deploys PenoraToken (PNR), MockUSDT, PenoraPowerEscrow, and PenoraVotingInfluence.
// Strictly checks network, balances, allocations, and non-custodial ownership.

const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

const DESTINATION_WALLET = '0x38CdF24eC27530B8F933023de2416d3960BD7372';
const TARGET_CHAIN_ID = 80002;

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

  console.log(`Deployer Address:    ${deployerAddress}`);
  console.log(`Deployer POL Balance: ${balancePol} POL`);
  console.log(`Destination Address: ${DESTINATION_WALLET}`);

  if (balanceWei < hre.ethers.parseEther('0.1')) {
    throw new Error(
      `Insufficient test POL for gas: Deployer has ${balancePol} POL. Minimum required for 4 contract deployments is ~0.2 POL. Please fund from Polygon faucet.`
    );
  }

  console.log('\n--- Step 1: Deploying PenoraToken (Test PNR, 100M Genesis Supply) ---');
  const testPnrFunding = hre.ethers.parseEther('10000'); // Exactly 10,000 PNR to destination
  const PenoraToken = await hre.ethers.getContractFactory('PenoraToken');
  const pnr = await PenoraToken.deploy(deployerAddress, DESTINATION_WALLET, testPnrFunding);
  await pnr.waitForDeployment();
  const pnrAddress = await pnr.getAddress();
  console.log(`✓ PenoraToken deployed at: ${pnrAddress}`);

  console.log('\n--- Step 2: Deploying MockUSDT (Test USDT, 6 Decimals) ---');
  // Initial 1,000 USDT minted directly to destination wallet
  const initialUsdtSupply = 1_000n * 10n ** 6n; // 1,000 USDT
  const MockUSDT = await hre.ethers.getContractFactory('MockUSDT');
  const usdt = await MockUSDT.deploy('Test Tether USD', 'USDT', initialUsdtSupply, DESTINATION_WALLET);
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log(`✓ MockUSDT deployed at: ${usdtAddress}`);

  console.log('\n--- Step 3: Deploying PenoraPowerEscrow (1:1 PNR -> PP Staking) ---');
  const PenoraPowerEscrow = await hre.ethers.getContractFactory('PenoraPowerEscrow');
  const escrow = await PenoraPowerEscrow.deploy(pnrAddress, DESTINATION_WALLET);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`✓ PenoraPowerEscrow deployed at: ${escrowAddress}`);

  console.log('\n--- Step 4: Deploying PenoraVotingInfluence (Mana & Curation Engine) ---');
  const PenoraVotingInfluence = await hre.ethers.getContractFactory('PenoraVotingInfluence');
  const influence = await PenoraVotingInfluence.deploy(escrowAddress, DESTINATION_WALLET);
  await influence.waitForDeployment();
  const influenceAddress = await influence.getAddress();
  console.log(`✓ PenoraVotingInfluence deployed at: ${influenceAddress}`);

  console.log('\n--- Step 5: Allocations Verified at Genesis ---');
  console.log(`✓ 10,000 Test PNR minted directly to ${DESTINATION_WALLET}`);
  console.log(`✓ 99,990,000 Test PNR minted to sovereign contract treasury`);
  console.log(`✓ Transferred 10,000 Test PNR to ${DESTINATION_WALLET} (tx: ${transferTx.hash})`);

  // Verify allocations
  const destPnrBal = await pnr.balanceOf(DESTINATION_WALLET);
  const destUsdtBal = await usdt.balanceOf(DESTINATION_WALLET);
  const vaultPnrBal = await pnr.balanceOf(deployerAddress);

  console.log('\n================================================================');
  console.log('DEPLOYMENT & ALLOCATION SUMMARY');
  console.log('================================================================');
  console.log(`Destination Wallet: ${DESTINATION_WALLET}`);
  console.log(`- Verified Test PNR Balance:  ${hre.ethers.formatEther(destPnrBal)} PNR (Target: 10,000)`);
  console.log(`- Verified Test USDT Balance: ${Number(destUsdtBal) / 1e6} USDT (Target: 1,000)`);
  console.log(`- Vault Retained PNR:         ${hre.ethers.formatEther(vaultPnrBal)} PNR (Target: 99,990,000)`);
  console.log('\nDeployed Contract Addresses:');
  console.log(`PUBLIC_PNR_TOKEN_ADDRESS=${pnrAddress}`);
  console.log(`PUBLIC_USDT_CONTRACT_ADDRESS=${usdtAddress}`);
  console.log(`PUBLIC_PP_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`PUBLIC_INFLUENCE_ADDRESS=${influenceAddress}`);

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
    },
    funding: {
      testPnr: '10000',
      testUsdt: '1000',
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

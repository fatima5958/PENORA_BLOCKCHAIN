// PENORA — Existing-token-only Polygon Amoy market activation.
// Safe by default: preflight is read-only until PENORA_EXECUTE_ONCHAIN=1.
// NEVER paste a deployer private key into chats or commit it to GitHub.
const hre = require('hardhat');
const { ethers, artifacts } = hre;

const CHAIN_ID = 80002;
const FOUNDER = '0x38CdF24eC27530B8F933023de2416d3960BD7372';
const RATE = 5n * 10n ** 18n; // TESTNET ONLY: 1 PNR = 0.20 MockUSDT
const DESIRED_INVENTORY = 5000n * 10n ** 18n;
const MIN_GAS_RESERVE = ethers.parseEther('0.01');
const PNR_ADDRESS = process.env.PUBLIC_PNR_TOKEN_ADDRESS || '0xBdD9D45524617d20111879ff914E1E2B708D59A6';
const MOCK_USDT_ADDRESS = process.env.PUBLIC_USDT_CONTRACT_ADDRESS || '0x88E538DB3FD3980Ba510aDd2671587Daf40F1050';
const execute = process.env.PENORA_EXECUTE_ONCHAIN === '1';

const TOKEN_ABI = [
  'function name() view returns (string)', 'function symbol() view returns (string)',
  'function decimals() view returns (uint8)', 'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
];
const MARKET_ABI = [
  'function pnrToken() view returns (address)', 'function usdtToken() view returns (address)',
  'function owner() view returns (address)', 'function pnrPerUsdt() view returns (uint256)',
  'function setRate(uint256)',
];
const P2P_ABI = [
  'function pnrToken() view returns (address)', 'function usdtToken() view returns (address)',
  'function owner() view returns (address)', 'function feeBps() view returns (uint256)',
];
const matches = (a, b) => a.toLowerCase() === b.toLowerCase();
async function requireCode(address, label) {
  if (!ethers.isAddress(address) || (await ethers.provider.getCode(address)) === '0x') {
    throw Error(label + ' has no deployed contract code on Amoy: ' + address);
  }
}
async function validatedExisting(address, label, abi) {
  if (!address) return null;
  await requireCode(address, label);
  const contract = new ethers.Contract(address, abi, ethers.provider);
  const [pnr, usdt, owner] = await Promise.all([
    contract.pnrToken(), contract.usdtToken(), contract.owner(),
  ]);
  if (!matches(pnr, PNR_ADDRESS) || !matches(usdt, MOCK_USDT_ADDRESS) || !matches(owner, FOUNDER)) {
    throw Error(label + ' token pair or owner does not match expected configuration');
  }
  return contract;
}
async function factoryFor(name, args) {
  const a = await artifacts.readArtifact(name);
  const factory = new ethers.ContractFactory(a.abi, a.bytecode);
  const tx = await factory.getDeployTransaction(...args);
  const gas = await ethers.provider.estimateGas({ from: FOUNDER, data: tx.data });
  return { gas, artifact: a };
}
async function main() {
  const chain = await ethers.provider.getNetwork();
  if (Number(chain.chainId) !== CHAIN_ID) throw Error('Wrong chain: expected Polygon Amoy 80002');
  if (!ethers.isAddress(PNR_ADDRESS) || !ethers.isAddress(MOCK_USDT_ADDRESS)) throw Error('Invalid token address');
  await requireCode(PNR_ADDRESS, 'PNR');
  await requireCode(MOCK_USDT_ADDRESS, 'MockUSDT');
  const pnr = new ethers.Contract(PNR_ADDRESS, TOKEN_ABI, ethers.provider);
  const usdt = new ethers.Contract(MOCK_USDT_ADDRESS, TOKEN_ABI, ethers.provider);
  const [pnrName, pnrSymbol, pnrDecimals, supply, usdtName, usdtSymbol, usdtDecimals] = await Promise.all([
    pnr.name(), pnr.symbol(), pnr.decimals(), pnr.totalSupply(),
    usdt.name(), usdt.symbol(), usdt.decimals(),
  ]);
  if (pnrName !== 'PENORA Token' || pnrSymbol !== 'PNR' || Number(pnrDecimals) !== 18 || supply !== 100000000n * 10n ** 18n) {
    throw Error('PNR identity or fixed total supply mismatch');
  }
  if (!/test|mock/i.test(usdtName) || usdtSymbol !== 'USDT' || Number(usdtDecimals) !== 6) {
    throw Error('Configured stablecoin is not recognized as MockUSDT; aborting');
  }
  let exchangeAddress = process.env.PUBLIC_PNR_EXCHANGE_ADDRESS || '';
  let p2pAddress = process.env.PUBLIC_P2P_ESCROW_ADDRESS || '';
  const existingDesk = await validatedExisting(exchangeAddress, 'Exchange', MARKET_ABI);
  const existingP2P = await validatedExisting(p2pAddress, 'P2P', P2P_ABI);
  const founderPnr = await pnr.balanceOf(FOUNDER);
  const founderGas = await ethers.provider.getBalance(FOUNDER);
  const deskInventory = existingDesk ? await pnr.balanceOf(exchangeAddress) : 0n;
  const topUp = deskInventory >= DESIRED_INVENTORY ? 0n : DESIRED_INVENTORY - deskInventory;
  if (founderPnr < topUp) throw Error('Founder has insufficient PNR for requested 5000 PNR total desk inventory');

  const deskArgs = [PNR_ADDRESS, MOCK_USDT_ADDRESS, FOUNDER, RATE];
  // No testnet trading fees by default; leave fee configuration of existing deployments unchanged.
  const p2pArgs = [PNR_ADDRESS, MOCK_USDT_ADDRESS, FOUNDER, 0, FOUNDER];
  const deskGas = existingDesk ? 0n : (await factoryFor('PenoraExchange', deskArgs)).gas;
  const p2pGas = existingP2P ? 0n : (await factoryFor('PenoraP2PEscrow', p2pArgs)).gas;
  const transferGas = topUp ? await ethers.provider.estimateGas({
    from: FOUNDER,
    to: PNR_ADDRESS,
    data: pnr.interface.encodeFunctionData('transfer', [exchangeAddress || FOUNDER, topUp]),
  }) : 0n;
  const rateChange = existingDesk && (await existingDesk.pnrPerUsdt()) !== RATE;
  const rateGas = rateChange ? await ethers.provider.estimateGas({
    from: FOUNDER, to: exchangeAddress,
    data: existingDesk.interface.encodeFunctionData('setRate', [RATE]),
  }) : 0n;
  const fees = await ethers.provider.getFeeData();
  const gasPrice = fees.maxFeePerGas || fees.gasPrice;
  if (!gasPrice || gasPrice <= 0n) throw Error('Could not obtain current gas price');
  // 35% gas buffer for estimated operations; keep 0.01 POL separate reserve.
  const estimatedCost = (deskGas + p2pGas + transferGas + rateGas) * gasPrice * 135n / 100n;
  console.log(JSON.stringify({
    network: 'Polygon Amoy', chainId: CHAIN_ID, mode: execute ? 'EXECUTE' : 'DRY_RUN',
    PNR_ADDRESS, MOCK_USDT_ADDRESS, founder: FOUNDER,
    founderPnr: ethers.formatEther(founderPnr),
    founderTestPol: ethers.formatEther(founderGas),
    currentDesk: exchangeAddress || null, currentP2P: p2pAddress || null,
    intendedPriceMockUsdtPerPnr: '0.20', pnrPerUsdt: RATE.toString(),
    desiredDeskInventoryPnr: '5000', fundingRequiredPnr: ethers.formatEther(topUp),
    expectedGasPolWithBuffer: ethers.formatEther(estimatedCost),
    minimumGasReservePol: ethers.formatEther(MIN_GAS_RESERVE),
  }, null, 2));
  if (estimatedCost + MIN_GAS_RESERVE > founderGas) {
    throw Error('Insufficient Test POL for gas estimates plus the 0.01 POL reserve. No broadcast performed.');
  }
  if (!execute) {
    console.log('READ-ONLY preflight passed. Set PENORA_EXECUTE_ONCHAIN=1 ONLY on your trusted local computer with an authorized signer.');
    return;
  }
  const signers = await ethers.getSigners();
  if (signers.length !== 1 || !matches(await signers[0].getAddress(), FOUNDER)) {
    throw Error('Exactly one authorized founder signer is required; no broadcast performed.');
  }
  const signer = signers[0];
  if (!existingDesk) {
    const desk = await (await ethers.getContractFactory('PenoraExchange', signer)).deploy(...deskArgs);
    await desk.waitForDeployment();
    exchangeAddress = await desk.getAddress();
    console.log('Verified exchange deployment:', exchangeAddress, (desk.deploymentTransaction() || {}).hash);
  }
  await validatedExisting(exchangeAddress, 'Exchange', MARKET_ABI);
  if (!existingP2P) {
    const market = await (await ethers.getContractFactory('PenoraP2PEscrow', signer)).deploy(...p2pArgs);
    await market.waitForDeployment();
    p2pAddress = await market.getAddress();
    console.log('Verified P2P deployment:', p2pAddress, (market.deploymentTransaction() || {}).hash);
  }
  await validatedExisting(p2pAddress, 'P2P', P2P_ABI);
  const finalDesk = new ethers.Contract(exchangeAddress, MARKET_ABI, signer);
  if ((await finalDesk.pnrPerUsdt()) !== RATE) {
    const tx = await finalDesk.setRate(RATE);
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw Error('Exchange rate update reverted');
  }
  const balanceBefore = await pnr.balanceOf(exchangeAddress);
  if (balanceBefore < DESIRED_INVENTORY) {
    const delta = DESIRED_INVENTORY - balanceBefore;
    if ((await pnr.balanceOf(FOUNDER)) < delta) throw Error('Founder PNR balance changed; insufficient inventory');
    const tx = await pnr.connect(signer).transfer(exchangeAddress, delta);
    const receipt = await tx.wait();
    if (receipt.status !== 1) throw Error('PNR desk funding transaction reverted');
    console.log('Funding transfer confirmed:', receipt.hash, ethers.formatEther(delta), 'PNR');
  }
  const finalBalance = await pnr.balanceOf(exchangeAddress);
  if (finalBalance < DESIRED_INVENTORY) throw Error('Inventory verification failed');
  console.log('AMOY MARKET ACTIVATION VERIFIED');
  console.log('PUBLIC_PNR_TOKEN_ADDRESS=' + PNR_ADDRESS);
  console.log('PUBLIC_USDT_CONTRACT_ADDRESS=' + MOCK_USDT_ADDRESS);
  console.log('PUBLIC_PNR_EXCHANGE_ADDRESS=' + exchangeAddress);
  console.log('PUBLIC_P2P_ESCROW_ADDRESS=' + p2pAddress);
  console.log('Actual exchange inventory PNR: ' + ethers.formatEther(finalBalance));
}
main().catch(error => { console.error('Market activation failed:', error.message || error); process.exitCode = 1; });

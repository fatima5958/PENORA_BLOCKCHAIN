// Opt-in browser -> RPC -> real local Solidity verification. Never connects to a remote chain.
// PENORA_WALLET_E2E=1 npx hardhat run scripts/verify-wallet-local.cjs --network hardhat
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const hre = require('hardhat');

async function main() {
  assert.equal(process.env.PENORA_WALLET_E2E, '1', 'Enable the isolated local wallet E2E explicitly.');
  assert.equal(hre.network.name, 'hardhat', 'Only the in-process Hardhat network is allowed.');
  assert.equal(Number(await hre.network.provider.request({ method: 'eth_chainId' })), 80002);
  const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
    ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright') : 'playwright');
  const root = path.resolve(__dirname, '..');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'penora-wallet-e2e-'));
  const dist = path.join(output, 'dist');
  const [owner, creator, recipient] = await hre.ethers.getSigners();
  const deploy = async (name, ...args) => {
    const instance = await (await hre.ethers.getContractFactory(name)).deploy(...args);
    await instance.waitForDeployment();
    return instance;
  };
  const pnr = await deploy('PenoraToken', owner.address);
  const usdt = await deploy('MockUSDT', 'Local Test USDT', 'USDT', 1_000_000_000n, owner.address);
  const escrow = await deploy('PenoraPowerEscrow', await pnr.getAddress(), owner.address);
  const influence = await deploy('PenoraVotingInfluence', await escrow.getAddress(), owner.address);
  await (await pnr.transfer(creator.address, hre.ethers.parseEther('100'))).wait();
  await (await usdt.transfer(creator.address, 100_000_000n)).wait();

  let holdReceipts = false;
  const broadcasts = [];
  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/rpc') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const processRpc = async payload => {
        try {
          if (holdReceipts && payload.method === 'eth_getTransactionReceipt') return { jsonrpc: '2.0', id: payload.id, result: null };
          const result = await hre.network.provider.request({ method: payload.method, params: payload.params || [] });
          if (payload.method === 'eth_sendTransaction') broadcasts.push(result);
          return { jsonrpc: '2.0', id: payload.id, result };
        } catch (error) {
          return { jsonrpc: '2.0', id: payload.id, error: { code: error.code || -32603, message: error.message } };
        }
      };
      try {
        const input = JSON.parse(raw);
        const result = Array.isArray(input) ? await Promise.all(input.map(processRpc)) : await processRpc(input);
        res.writeHead(200, { 'content-type': 'application/json' });
        return res.end(JSON.stringify(result));
      } catch { res.writeHead(400); return res.end(); }
    }
    let file = path.resolve(dist, '.' + new URL(req.url, 'http://localhost').pathname);
    if (file !== dist && !file.startsWith(dist + path.sep)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  let page;
  const results = [];
  const record = message => { results.push(message); console.log(message); };
  const errors = [];
  try {
    const build = spawnSync(process.execPath, [path.join(root, 'node_modules/astro/astro.js'), 'build', '--outDir', dist], {
      cwd: root, encoding: 'utf8', env: { ...process.env,
        PUBLIC_AMOY_RPC_URL: origin + '/rpc',
        PUBLIC_PNR_TOKEN_ADDRESS: await pnr.getAddress(),
        PUBLIC_USDT_CONTRACT_ADDRESS: await usdt.getAddress(),
        PUBLIC_PP_ESCROW_ADDRESS: await escrow.getAddress(),
        PUBLIC_INFLUENCE_ADDRESS: await influence.getAddress(),
      },
    });
    fs.writeFileSync(path.join(output, 'build.log'), (build.stdout || '') + (build.stderr || ''));
    assert.equal(build.status, 0, `Fixture build failed. See ${output}/build.log`);
    browser = await chromium.launch({ headless: true,
      executablePath: process.env.PENORA_CHROMIUM_EXECUTABLE || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process'],
    });
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(15_000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.addInitScript(({ address }) => {
      const listeners = {};
      let currentAddress = address;
      window.penoraFixtureWallet = { select: next => { currentAddress = next; listeners.accountsChanged?.(next ? [next] : []); } };
      window.ethereum = { isMetaMask: true,
        on: (name, callback) => { listeners[name] = callback; },
        request: async ({ method, params }) => {
          if (method === 'eth_accounts' || method === 'eth_requestAccounts') return currentAddress ? [currentAddress] : [];
          const body = await (await fetch('/rpc', { method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params: params || [] }),
          })).json();
          if (body.error) throw Object.assign(new Error(body.error.message), { code: body.error.code });
          return body.result;
        },
      };
    }, { address: creator.address });
    await page.goto(origin + '/wallet/');
    const text = value => page.getByText(value, { exact: true });
    await text('100 PNR').waitFor();
    await text('100 USDT').waitFor();
    record('Real local PNR/USDT balances rendered');

    const send = async (asset, amount) => {
      await page.getByRole('button', { name: 'Send / Withdraw', exact: true }).click();
      await page.locator('#wallet-asset').selectOption(asset);
      await page.getByPlaceholder('0x...', { exact: true }).fill(recipient.address);
      await page.getByPlaceholder('0.00', { exact: true }).fill(amount);
      await page.getByRole('button', { name: 'Review Transfer', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm & Sign in MetaMask', exact: true }).click();
      await text('Transfer confirmed').waitFor();
    };
    await send('USDT', '1.000001');
    assert.equal(await usdt.balanceOf(recipient.address), 1_000_001n);
    await send('PNR', '1.000000000000000001');
    assert.equal(await pnr.balanceOf(recipient.address), 1_000_000_000_000_000_001n);
    record('Browser sends confirmed with exact USDT and 18-decimal PNR contract balances');

    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.getByRole('button', { name: 'Power Up', exact: true }).click();
    await page.getByRole('dialog').getByPlaceholder('0.0', { exact: true }).fill('26');
    await page.getByRole('button', { name: 'Confirm Power Up', exact: true }).click();
    await page.getByText(/Power Up confirmed:/).waitFor();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await escrow.lockedPower(creator.address), hre.ethers.parseEther('26'));
    await text('26 PP').waitFor();
    record('Approval then Power Up confirmed and 26 PP rendered');

    await page.getByRole('button', { name: 'Power Down', exact: true }).click();
    await page.getByRole('dialog').getByPlaceholder('0.0', { exact: true }).fill('13');
    await page.getByRole('button', { name: 'Start 13-Week Power Down', exact: true }).click();
    await page.getByText(/13-week Power Down schedule started:/).waitFor();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await escrow.getAvailablePower(creator.address), hre.ethers.parseEther('13'));
    await text('13 PP').waitFor();
    const claim = page.getByRole('button', { name: /Claim Matured Installments/ });
    assert.equal(await claim.isDisabled(), true);
    await hre.network.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
    await hre.network.provider.send('evm_mine');
    await page.getByRole('button', { name: 'Deposit', exact: true }).click();
    await page.getByRole('button', { name: 'Check Now', exact: true }).click();
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    const beforeClaim = await pnr.balanceOf(creator.address);
    await claim.click();
    await page.getByText(/Matured installment claimed:/).waitFor();
    assert.equal(await pnr.balanceOf(creator.address), beforeClaim + hre.ethers.parseEther('1'));
    await page.getByRole('button', { name: 'Cancel Remaining Schedule (Restore PP)', exact: true }).click();
    await page.getByText(/Power Down cancelled;/).waitFor();
    assert.equal((await escrow.powerDownSchedules(creator.address)).active, false);
    assert.equal(await escrow.getAvailablePower(creator.address), hre.ethers.parseEther('25'));
    record('Power Down, week-one claim and cancellation verified against real local contract state');

    await page.getByRole('button', { name: 'Deposit', exact: true }).click();
    await page.locator('#wallet-asset').selectOption('PNR');
    const deposit = await pnr.transfer(creator.address, hre.ethers.parseEther('7'));
    await deposit.wait();
    await page.getByRole('button', { name: 'Check Now', exact: true }).click();
    await page.getByRole('button', { name: 'Transaction History', exact: true }).click();
    await page.getByText(deposit.hash.slice(0, 10) + '...' + deposit.hash.slice(-8), { exact: true }).waitFor();
    record('Incoming PNR deposit indexed in wallet history');
    await text('Power Up').waitFor();
    await text('Power Down started').waitFor();
    await text('Installment claimed').waitFor();
    await text('Power Down cancelled').waitFor();
    record('Real escrow events indexed: Power Up, Power Down, installment claim and cancellation');
    // Hold only receipt reads: the approval still executes in the real local EVM.
    const beforeSwitch = broadcasts.length;
    const lockedBeforeSwitch = await escrow.lockedPower(creator.address);
    holdReceipts = true;
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.getByRole('button', { name: 'Power Up', exact: true }).click();
    await page.getByRole('dialog').getByPlaceholder('0.0', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Confirm Power Up', exact: true }).click();
    for (let attempt = 0; attempt < 100 && broadcasts.length === beforeSwitch; attempt++) await page.waitForTimeout(100);
    assert.equal(broadcasts.length, beforeSwitch + 1, 'Expected exactly the allowance approval before switching accounts');
    const heldApproval = broadcasts.at(-1);
    await page.evaluate(address => window.penoraFixtureWallet.select(address), recipient.address);
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    holdReceipts = false;
    // A local chain has no automatic empty blocks; let the receipt watcher observe a new head.
    await hre.network.provider.send('evm_mine');
    await page.waitForFunction(hash => Object.keys(localStorage).some(key => key.startsWith('penora_power_80002_') &&
      JSON.parse(localStorage.getItem(key) || '[]').some(tx => tx.hash === hash && tx.status === 'confirmed')), heldApproval);
    assert.equal(broadcasts.length, beforeSwitch + 1, 'An account change must prevent the staking signature');
    assert.equal(await escrow.lockedPower(creator.address), lockedBeforeSwitch);
    assert.equal(await page.getByText(/Power Up confirmed:/).count(), 0);
    await page.evaluate(() => window.penoraFixtureWallet.select(null));
    await page.getByRole('button', { name: 'Connect Web3 Wallet', exact: true }).waitFor();
    record('Account switched during actual approval: no staking signature, stale success or retained connection after disconnect');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ status: 'PASS', results, errors }, null, 2));
    console.log(JSON.stringify({ status: 'PASS', output, results, errors }, null, 2));
  } catch (error) {
    if (page) {
      fs.writeFileSync(path.join(output, 'failure.txt'), await page.locator('body').innerText().catch(() => ''));
      await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    }
    console.error(`Wallet E2E failed. Evidence: ${output}`);
    throw error;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });

// Opt-in browser -> RPC -> real local Solidity verification. Never connects to a remote chain.
// PENORA_WALLET_E2E=1 PENORA_EXCHANGE_E2E=1 npx hardhat run scripts/verify-exchange-local.cjs --network hardhat
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const hre = require('hardhat');

async function main() {
  assert.equal(process.env.PENORA_EXCHANGE_E2E, '1', 'Enable the isolated local exchange E2E explicitly.');
  assert.equal(hre.network.name, 'hardhat', 'Only the in-process Hardhat network is allowed.');
  assert.equal(Number(await hre.network.provider.request({ method: 'eth_chainId' })), 80002);
  const { chromium } = require(process.env.PENORA_PLAYWRIGHT_MODULE || (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright') : 'playwright'));
  const root = path.resolve(__dirname, '..');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'penora-exchange-e2e-'));
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

  const exchange = await deploy('PenoraExchange', await pnr.getAddress(), await usdt.getAddress(), owner.address, hre.ethers.parseEther('20'));
  await (await pnr.transfer(await exchange.getAddress(), hre.ethers.parseEther('1000'))).wait();
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
        PUBLIC_PNR_EXCHANGE_ADDRESS: await exchange.getAddress(),
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
    await page.goto(origin + '/exchange/');
    await page.getByRole('button',{name:'Review purchase',exact:true}).waitFor();
    await page.getByLabel('You pay',{exact:true}).fill('2');
    await page.getByRole('button',{name:'Review purchase',exact:true}).click();
    await page.getByRole('dialog').waitFor();
    await page.getByRole('dialog').getByText('2 test USDT',{exact:true}).waitFor();
    await page.getByRole('dialog').getByRole('button',{name:'Approve & buy PNR',exact:true}).click();
    await page.getByText(/Purchase confirmed: 40 PNR delivered/).waitFor({timeout:30000});
    assert.equal(await pnr.balanceOf(creator.address),hre.ethers.parseEther('140'));
    assert.equal(await usdt.balanceOf(creator.address),98_000_000n);
    assert.equal(await usdt.balanceOf(await exchange.getAddress()),2_000_000n);
    assert.equal(await usdt.allowance(creator.address,await exchange.getAddress()),0n);
    assert.equal(broadcasts.length,2,'Exactly one approval and one purchase');
    record('Browser → exact approval → real local purchase → receipt → PNR and USDT balances verified');
    await page.getByRole('link',{name:'View transaction'}).waitFor();
    await page.getByText('960 PNR',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Market details',exact:true}).click();
    await page.getByText('Owner-priced inventory desk',{exact:true}).waitFor();
    await page.getByRole('button',{name:'1D',exact:true}).click();
    await page.getByRole('button',{name:'Show line chart',exact:true}).click();
    await page.getByRole('button',{name:'Show candlestick chart',exact:true}).click();
    for(const width of [360,390,768,1365]) {
      await page.setViewportSize({width,height:1000});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`Overflow at ${width}`);
      await page.screenshot({path:path.join(output,`exchange-${width}.png`),fullPage:true});
    }
    record('Chart controls, market details, receipt link and four responsive widths verified');
    await page.reload();
    await page.getByRole('button',{name:'Review purchase',exact:true}).waitFor();
    // Exact percentage buttons use verified six-decimal USDT balances.
    await page.getByRole('button',{name:'MAX',exact:true}).click();
    assert.equal(await page.getByLabel('You pay',{exact:true}).inputValue(),'98');
    await page.getByRole('button',{name:'Review purchase',exact:true}).click();
    await page.getByText('Not enough PNR liquidity for this amount.',{exact:true}).waitFor();
    assert.equal(broadcasts.length,2,'No signatures when inventory cannot fill the order');
    record('Insufficient liquidity fails before any new signature');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({status:'PASS',output,results}));
  } catch(error) {
    if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});
    console.error('Exchange E2E failed. Evidence: '+output);throw error;
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1);});

// hardhat.config.cjs
// PENORA Blockchain — Smart Contract Development & Testing Configuration
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: false,
    },
  },
  networks: {
    hardhat: {
      // Browser E2E uses an isolated local chain with the application's Amoy ID.
      chainId: process.env.PENORA_WALLET_E2E === '1' ? 80002 : 31337,
      // 100 funded test accounts with 10,000 ETH each for comprehensive free local testing
      accounts: {
        count: 100,
        accountsBalance: "10000000000000000000000",
      },
    },
    polygonAmoy: {
      url: process.env.PUBLIC_AMOY_RPC_URL || process.env.AMOY_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com",
      chainId: 80002,
      accounts: process.env.AMOY_DEPLOYER_PRIVATE_KEY ? [process.env.AMOY_DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache_hardhat",
    artifacts: "./artifacts_hardhat",
  },
};

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
    },
    polygonAmoy: {
      url: "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      // Deployment accounts are NOT configured here to maintain strict non-custodial security
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache_hardhat",
    artifacts: "./artifacts_hardhat",
  },
};

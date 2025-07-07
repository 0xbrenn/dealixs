// deployment.config.js
module.exports = {
  EXISTING_CONTRACTS: {
    WETH: process.env.EXISTING_WETH_ADDRESS || "",
    FACTORY: process.env.EXISTING_FACTORY_ADDRESS || "",
    ROUTER: process.env.EXISTING_ROUTER_ADDRESS || "",
  },
  NETWORKS: {
    iopnTestnet: {
      chainId: 984,
      rpcUrl: "https://testnet-rpc.iopn.tech",
      explorer: "https://testnet-explorer.iopn.tech",
      existingContracts: {}
    },
    localhost: {
      chainId: 31337,
      rpcUrl: "http://localhost:8545",
      existingContracts: {}
    }
  },
  OPTIONS: {
    skipExisting: process.env.SKIP_EXISTING_CONTRACTS === "true",
    verifyContracts: process.env.VERIFY_CONTRACTS === "true",
    confirmDeployment: process.env.CONFIRM_DEPLOYMENT !== "false"
  }
};
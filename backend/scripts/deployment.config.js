// deployment.config.js
module.exports = {
  EXISTING_CONTRACTS: {
    WETH: "0x4200000000000000000000000000000000000006", // Base's official WETH
    FACTORY: "",
    ROUTER: "",
  },
  NETWORKS: {
    baseMainnet: {
      chainId: 8453,
      existingContracts: {
        WETH: "0x4200000000000000000000000000000000000006"
      }
    }
  },
  OPTIONS: {
    skipExisting: true, // Set this directly to true
    verifyContracts: false,
    confirmDeployment: true
  }
};
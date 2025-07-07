// scripts/3-deploy-dealix-base.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting DealixDEX Deployment on Base Mainnet...");
  console.log("================================================");
  
  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);
  console.log("Deployer balance:", hre.ethers.utils.formatEther(await deployer.getBalance()), "ETH");
  
  // Your deployed contracts on Base mainnet
  const deployedContracts = {
    WETH: "0x4200000000000000000000000000000000000006",
    Factory: "0xbF744FD5c3D4595E4f64A777ab67fDb130aBcbb0",
    Router: "0xF0bf7eba89894eAf67e7E1B53C03cd0d5C21A2c6",
    DealixLibrary: "0x50e9c4ddD07D62f8D92125f2aB7B059B324c0923"
  };
  
  console.log("\n📋 Using deployed contracts:");
  console.log("  WETH:", deployedContracts.WETH);
  console.log("  Factory:", deployedContracts.Factory);
  console.log("  Router:", deployedContracts.Router);
  console.log("  DealixLibrary:", deployedContracts.DealixLibrary);

  // Deploy DealixDEX
  console.log("\n🔨 Deploying DealixDEX...");
  
  const DealixDEX = await hre.ethers.getContractFactory("DealixDEX");
  const dealixDEX = await DealixDEX.deploy(
    deployedContracts.Router,
    deployedContracts.Factory,
    deployer.address, // Treasury address (can be changed later)
    deployer.address  // Guardian address (can be changed later)
  );

  console.log("⏳ Waiting for deployment confirmation...");
  await dealixDEX.deployed();
  console.log("✅ DealixDEX deployed to:", dealixDEX.address);

  // Get deployment transaction receipt for gas info
  const deployTx = dealixDEX.deployTransaction;
  const receipt = await deployTx.wait();
  console.log("   Gas used:", receipt.gasUsed.toString());
  console.log("   Block number:", receipt.blockNumber);

  // Create deployment directory if it doesn't exist
  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir);
  }

  // Save deployment data
  const deploymentData = {
    network: network,
    chainId: 8453, // Base mainnet
    timestamp: new Date().toISOString(),
    contracts: {
      ...deployedContracts,
      DealixDEX: dealixDEX.address
    },
    dealixDeployment: {
      deploymentTx: deployTx.hash,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber,
      treasury: deployer.address,
      guardian: deployer.address,
      deployer: deployer.address
    }
  };

  // Save deployment file
  const deploymentPath = path.join(deploymentDir, `${network}-dealix-deployment.json`);
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentData, null, 2));

  // Create/Update .env file for frontend
  const envPath = path.join(deploymentDir, `.env.${network}`);
  const envContent = `# DealixDEX Deployment - ${new Date().toISOString()}
# Network: Base Mainnet (Chain ID: 8453)

# Core DEX Contracts
REACT_APP_WETH_ADDRESS=${deployedContracts.WETH}
REACT_APP_FACTORY_ADDRESS=${deployedContracts.Factory}
REACT_APP_ROUTER_ADDRESS=${deployedContracts.Router}
REACT_APP_LIBRARY_ADDRESS=${deployedContracts.DealixLibrary}

# Dealix Contracts
REACT_APP_DEALIX_ADDRESS=${dealixDEX.address}

# Network Configuration
REACT_APP_CHAIN_ID=8453
REACT_APP_CHAIN_NAME=Base
`;
  fs.writeFileSync(envPath, envContent);

  // Verify initial state
  console.log("\n🔍 Verifying DealixDEX state...");
  const router = await dealixDEX.router();
  const factory = await dealixDEX.factory();
  const treasury = await dealixDEX.treasuryAddress();
  const guardian = await dealixDEX.guardian();
  const mintingFee = await dealixDEX.mintingFee();
  const platformFee = await dealixDEX.platformFee();

  console.log("  Router:", router);
  console.log("  Factory:", factory);
  console.log("  Treasury:", treasury);
  console.log("  Guardian:", guardian);
  console.log("  Minting Fee:", hre.ethers.utils.formatEther(mintingFee), "ETH");
  console.log("  Platform Fee:", platformFee.toString(), "basis points");

  // Display summary
  console.log("\n============================================");
  console.log("✅ DealixDEX Deployment Complete!");
  console.log("============================================");
  console.log("\n📋 Contract Addresses:");
  console.log("  DealixDEX:", dealixDEX.address);
  console.log("  Router:", deployedContracts.Router);
  console.log("  Factory:", deployedContracts.Factory);
  console.log("  WETH:", deployedContracts.WETH);
  console.log("  Library:", deployedContracts.DealixLibrary);
  
  console.log("\n📄 Files created:");
  console.log("  Deployment data:", deploymentPath);
  console.log("  Frontend env:", envPath);
  
  console.log("\n🎯 Next steps:");
  console.log("1. Deploy DealixLiquidityManager:");
  console.log(`   npx hardhat run scripts/4-deploy-liquidity-manager-base.js --network ${network}`);
  console.log("\n2. Verify on Basescan:");
  console.log(`   npx hardhat verify --network ${network} ${dealixDEX.address} ${deployedContracts.Router} ${deployedContracts.Factory} ${deployer.address} ${deployer.address}`);
  console.log("\n3. Update treasury and guardian addresses if needed");
  console.log("4. Configure initial parameters and create discount pools");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
// scripts/4-deploy-liquidity-manager-base.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting DealixLiquidityManager Deployment on Base Mainnet...");
  console.log("===========================================================");
  
  const network = hre.network.name;
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);
  console.log("Deployer balance:", hre.ethers.utils.formatEther(await deployer.getBalance()), "ETH");
  
  // Load DealixDEX deployment
  const deploymentDir = path.join(__dirname, "../deployments");
  const dealixDeploymentPath = path.join(deploymentDir, `${network}-dealix-deployment.json`);
  
  if (!fs.existsSync(dealixDeploymentPath)) {
    throw new Error(`DealixDEX deployment not found. Please run 3-deploy-dealix-base.js first.`);
  }
  
  const dealixDeployment = JSON.parse(fs.readFileSync(dealixDeploymentPath, "utf8"));
  
  console.log("\n📋 Using deployed contracts:");
  console.log("  WETH:", dealixDeployment.contracts.WETH);
  console.log("  Factory:", dealixDeployment.contracts.Factory);
  console.log("  Router:", dealixDeployment.contracts.Router);
  console.log("  DealixDEX:", dealixDeployment.contracts.DealixDEX);

  // Check if DealixLiquidityManager already deployed
  if (dealixDeployment.contracts.DealixLiquidityManager) {
    console.log("\n⚠️  DealixLiquidityManager already deployed at:", dealixDeployment.contracts.DealixLiquidityManager);
    console.log("   Skipping deployment.");
    return;
  }

  // Deploy DealixLiquidityManager
  console.log("\n🔨 Deploying DealixLiquidityManager...");
  
  const DealixLiquidityManager = await hre.ethers.getContractFactory("DealixLiquidityManager");
  const liquidityManager = await DealixLiquidityManager.deploy(
    dealixDeployment.contracts.Router,
    dealixDeployment.contracts.Factory,
    dealixDeployment.contracts.DealixDEX,
    deployer.address // Treasury address (should match DealixDEX treasury)
  );

  console.log("⏳ Waiting for deployment confirmation...");
  await liquidityManager.deployed();
  console.log("✅ DealixLiquidityManager deployed to:", liquidityManager.address);

  // Get deployment transaction receipt for gas info
  const deployTx = liquidityManager.deployTransaction;
  const receipt = await deployTx.wait();
  console.log("   Gas used:", receipt.gasUsed.toString());
  console.log("   Block number:", receipt.blockNumber);

  // Set DealixLiquidityManager in DealixDEX
  console.log("\n🔗 Linking DealixLiquidityManager to DealixDEX...");
  const dealixDEX = await hre.ethers.getContractAt("DealixDEX", dealixDeployment.contracts.DealixDEX);
  
  try {
    const setManagerTx = await dealixDEX.setLiquidityManager(liquidityManager.address);
    await setManagerTx.wait();
    console.log("✅ DealixLiquidityManager linked to DealixDEX");
  } catch (error) {
    console.log("⚠️  Could not set liquidity manager in DealixDEX. You may need to do this manually.");
    console.log("   Error:", error.message);
  }

  // Update deployment data
  const updatedDeployment = {
    ...dealixDeployment,
    contracts: {
      ...dealixDeployment.contracts,
      DealixLiquidityManager: liquidityManager.address
    },
    liquidityManagerDeployment: {
      deploymentTx: deployTx.hash,
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber,
      timestamp: new Date().toISOString()
    }
  };

  // Save updated deployment file
  fs.writeFileSync(dealixDeploymentPath, JSON.stringify(updatedDeployment, null, 2));

  // Update .env file for frontend
  const envPath = path.join(deploymentDir, `.env.${network}`);
  const existingEnv = fs.readFileSync(envPath, "utf8");
  const updatedEnv = existingEnv + `REACT_APP_LIQUIDITY_MANAGER_ADDRESS=${liquidityManager.address}\n`;
  fs.writeFileSync(envPath, updatedEnv);

  // Verify initial state
  console.log("\n🔍 Verifying DealixLiquidityManager state...");
  const router = await liquidityManager.router();
  const factory = await liquidityManager.factory();
  const dealixDEXAddress = await liquidityManager.dealixDEX();
  const treasury = await liquidityManager.treasuryAddress();
  const platformCut = await liquidityManager.affiliatePlatformCut();

  console.log("  Router:", router);
  console.log("  Factory:", factory);
  console.log("  DealixDEX:", dealixDEXAddress);
  console.log("  Treasury:", treasury);
  console.log("  Platform Cut:", platformCut.toString(), "basis points");

  // Create final deployment summary
  const summaryPath = path.join(deploymentDir, `${network}-deployment-summary.txt`);
  const summaryContent = `DEALIX DEX DEPLOYMENT SUMMARY - BASE MAINNET
============================================
Network: Base Mainnet
Chain ID: 8453
Deployment Date: ${new Date().toISOString()}

CONTRACT ADDRESSES
==================
WETH: ${updatedDeployment.contracts.WETH}
Factory: ${updatedDeployment.contracts.Factory}
Router: ${updatedDeployment.contracts.Router}
Library: ${updatedDeployment.contracts.DealixLibrary}
DealixDEX: ${updatedDeployment.contracts.DealixDEX}
DealixLiquidityManager: ${liquidityManager.address}

BASESCAN VERIFICATION COMMANDS
==============================
# Verify Factory
npx hardhat verify --network ${network} ${updatedDeployment.contracts.Factory} ${deployer.address}

# Verify Router
npx hardhat verify --network ${network} ${updatedDeployment.contracts.Router} ${updatedDeployment.contracts.Factory} ${updatedDeployment.contracts.WETH}

# Verify DealixDEX
npx hardhat verify --network ${network} ${updatedDeployment.contracts.DealixDEX} ${updatedDeployment.contracts.Router} ${updatedDeployment.contracts.Factory} ${deployer.address} ${deployer.address}

# Verify DealixLiquidityManager
npx hardhat verify --network ${network} ${liquidityManager.address} ${updatedDeployment.contracts.Router} ${updatedDeployment.contracts.Factory} ${updatedDeployment.contracts.DealixDEX} ${deployer.address}

FRONTEND CONFIGURATION
=====================
Add these to your frontend .env:

REACT_APP_WETH_ADDRESS=${updatedDeployment.contracts.WETH}
REACT_APP_FACTORY_ADDRESS=${updatedDeployment.contracts.Factory}
REACT_APP_ROUTER_ADDRESS=${updatedDeployment.contracts.Router}
REACT_APP_LIBRARY_ADDRESS=${updatedDeployment.contracts.DealixLibrary}
REACT_APP_DEALIX_ADDRESS=${updatedDeployment.contracts.DealixDEX}
REACT_APP_LIQUIDITY_MANAGER_ADDRESS=${liquidityManager.address}
REACT_APP_CHAIN_ID=8453
REACT_APP_CHAIN_NAME=Base

DEPLOYMENT TRANSACTIONS
=======================
DealixDEX: ${dealixDeployment.dealixDeployment.deploymentTx}
DealixLiquidityManager: ${deployTx.hash}

NEXT STEPS
==========
1. Verify all contracts on Basescan using the commands above
2. Configure verified projects in DealixLiquidityManager
3. Set appropriate fees and parameters
4. Create initial discount pools
5. Update frontend with contract addresses
6. Test all functionality before announcing

IMPORTANT ADDRESSES TO CONFIGURE
================================
- Treasury Address: ${deployer.address} (currently set to deployer)
- Guardian Address: ${deployer.address} (currently set to deployer)
- Consider using a multi-sig wallet for these roles in production
`;

  fs.writeFileSync(summaryPath, summaryContent);

  // Display summary
  console.log("\n============================================");
  console.log("✅ DealixLiquidityManager Deployment Complete!");
  console.log("============================================");
  console.log("\n📋 All Contract Addresses:");
  console.log("  WETH:", updatedDeployment.contracts.WETH);
  console.log("  Factory:", updatedDeployment.contracts.Factory);
  console.log("  Router:", updatedDeployment.contracts.Router);
  console.log("  Library:", updatedDeployment.contracts.DealixLibrary);
  console.log("  DealixDEX:", updatedDeployment.contracts.DealixDEX);
  console.log("  DealixLiquidityManager:", liquidityManager.address);
  
  console.log("\n📄 Files updated:");
  console.log("  Deployment data:", dealixDeploymentPath);
  console.log("  Frontend env:", envPath);
  console.log("  Summary file:", summaryPath);
  
  console.log("\n🎉 Full deployment complete! Check the summary file for verification commands and next steps.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
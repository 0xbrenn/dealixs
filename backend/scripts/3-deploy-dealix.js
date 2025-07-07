// scripts/3-deploy-dealix.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting DealixDEX Deployment...");
  console.log("=====================================");
  
  const network = hre.network.name; // Get network name properly
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);
  console.log("Deployer balance:", hre.ethers.utils.formatEther(await deployer.getBalance()), "ETH");
  
  // Load existing deployment
  const deploymentDir = path.join(__dirname, "../deployments");
  const existingDeploymentPath = path.join(deploymentDir, `${network}-complete-deployment.json`);
  
  if (!fs.existsSync(existingDeploymentPath)) {
    throw new Error(`No existing deployment found for ${network}. Please run steps 1 and 2 first.`);
  }
  
  const existingDeployment = JSON.parse(fs.readFileSync(existingDeploymentPath, "utf8"));
  console.log("\n📋 Using existing contracts:");
  console.log("  Router:", existingDeployment.contracts.Router);
  console.log("  Factory:", existingDeployment.contracts.Factory);

  // Deploy DealixDEX
  console.log("\n🔨 Deploying DealixDEX...");
  
  const DealixDEX = await hre.ethers.getContractFactory("DealixDEX");
  const dealixDEX = await DealixDEX.deploy(
    existingDeployment.contracts.Router,
    existingDeployment.contracts.Factory,
    deployer.address // Treasury address (can be changed later)
  );

  await dealixDEX.deployed();
  console.log("✅ DealixDEX deployed to:", dealixDEX.address);

  // Get deployment transaction receipt for gas info
  const deployTx = dealixDEX.deployTransaction;
  const receipt = await deployTx.wait();
  console.log("   Gas used:", receipt.gasUsed.toString());

  // Save Dealix deployment
  const dealixDeployment = {
    network: network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId,
    timestamp: new Date().toISOString(),
    contracts: {
      ...existingDeployment.contracts,
      DealixDEX: dealixDEX.address
    },
    dealixConfig: {
      mintingFee: "0.0005 ETH",
      platformFee: "0.25%",
      maxDiscountPercentage: "50%",
      affiliatePlatformCut: "10%",
      streakBonusPerDay: "0.05%"
    },
    deployer: deployer.address,
    blockNumber: receipt.blockNumber
  };

  // Save deployment file
  const dealixDeploymentPath = path.join(deploymentDir, `${network}-dealix-deployment.json`);
  fs.writeFileSync(dealixDeploymentPath, JSON.stringify(dealixDeployment, null, 2));

  // Update .env file for frontend
  const envPath = path.join(deploymentDir, `.env.${network}`);
  const envContent = fs.readFileSync(envPath, "utf8");
  const updatedEnvContent = envContent + `\nREACT_APP_DEALIX_ADDRESS=${dealixDEX.address}`;
  fs.writeFileSync(envPath, updatedEnvContent);

  // Verify initial state
  console.log("\n🔍 Verifying DealixDEX state...");
  const router = await dealixDEX.router();
  const factory = await dealixDEX.factory();
  const treasury = await dealixDEX.treasuryAddress();
  const mintingFee = await dealixDEX.mintingFee();
  const platformFee = await dealixDEX.platformFee();

  console.log("  Router:", router);
  console.log("  Factory:", factory);
  console.log("  Treasury:", treasury);
  console.log("  Minting Fee:", hre.ethers.utils.formatEther(mintingFee), "ETH");
  console.log("  Platform Fee:", platformFee.toString(), "basis points");

  // Display summary
  console.log("\n✅ DealixDEX Deployment Complete!");
  console.log("================================");
  console.log("DealixDEX Address:", dealixDEX.address);
  console.log("\nAll deployed contracts:");
  console.log("  WETH:", existingDeployment.contracts.WETH);
  console.log("  Factory:", existingDeployment.contracts.Factory);
  console.log("  Router:", existingDeployment.contracts.Router);
  console.log("  Library:", existingDeployment.contracts.DealixLibrary);
  console.log("  DealixDEX:", dealixDEX.address);
  
  console.log("\n📄 Deployment saved to:", dealixDeploymentPath);
  console.log("📄 Frontend env updated:", envPath);
  
  console.log("\n🎯 Next steps:");
  console.log("1. Verify the contract on Basescan:");
  console.log(`   npx hardhat verify --network ${network} ${dealixDEX.address} ${existingDeployment.contracts.Router} ${existingDeployment.contracts.Factory} ${deployer.address}`);
  console.log("2. Update treasury address if needed");
  console.log("3. Create initial discount pools");
  console.log("4. Launch frontend application");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
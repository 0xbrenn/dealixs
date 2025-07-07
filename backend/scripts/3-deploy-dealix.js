const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🚀 Starting DealixDEX Deployment...");
  console.log("=====================================");

  // Get network
  const network = await hre.ethers.provider.getNetwork();
  console.log("Network:", network.name);

  // Get deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Get balance
  const balance = await deployer.getBalance();
  console.log("Deployer balance:", hre.ethers.utils.formatEther(balance), "ETH");

  // Load existing deployment
  const deploymentDir = path.join(__dirname, "..", "deployments");
  const existingDeploymentPath = path.join(deploymentDir, `${network.name}-complete-deployment.json`);
  
  if (!fs.existsSync(existingDeploymentPath)) {
    throw new Error(`No existing deployment found for ${network.name}. Please run steps 1 and 2 first.`);
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
    network: network.name,
    chainId: network.chainId,
    timestamp: new Date().toISOString(),
    contracts: {
      ...existingDeployment.contracts,
      DealixDEX: dealixDEX.address
    },
    dealixConfig: {
      mintingFee: "0.05 ETH",
      platformFee: "0.25%",
      maxDiscountPercentage: "50%",
      affiliatePlatformCut: "10%",
      streakBonusPerDay: "0.05%"
    },
    deployer: deployer.address,
    blockNumber: receipt.blockNumber
  };

  // Save deployment file
  const dealixDeploymentPath = path.join(deploymentDir, `${network.name}-dealix-deployment.json`);
  fs.writeFileSync(dealixDeploymentPath, JSON.stringify(dealixDeployment, null, 2));

  // Update .env file for frontend
  const envPath = path.join(deploymentDir, `.env.${network.name}`);
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
  console.log("=====================================");
  console.log("\n📄 All Contracts:");
  console.log("  WETH:", dealixDeployment.contracts.WETH);
  console.log("  Factory:", dealixDeployment.contracts.Factory);
  console.log("  Router:", dealixDeployment.contracts.Router);
  console.log("  DealixLibrary:", dealixDeployment.contracts.DealixLibrary);
  console.log("  DealixDEX:", dealixDeployment.contracts.DealixDEX);

  console.log("\n📁 Deployment files saved:");
  console.log("  Dealix deployment:", dealixDeploymentPath);
  console.log("  Updated frontend env:", envPath);

  console.log("\n🎯 Next Steps:");
  console.log("1. Update frontend to integrate DealixDEX features");
  console.log("2. Deploy initial badges and configure platform");
  console.log("3. Create first discount pools");
  console.log("4. Launch marketing campaign for Dealix IDs");

  // Optional: Verify on explorer
  if (network.name !== "localhost" && network.name !== "hardhat") {
    console.log("\n📝 To verify on explorer:");
    console.log(`npx hardhat verify --network ${network.name} ${dealixDEX.address} ${router} ${factory} ${treasury}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
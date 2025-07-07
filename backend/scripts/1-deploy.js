// scripts/1-deploy.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Load deployment configuration
const deploymentConfig = require("./deployment.config");

// Load environment variables from .env.deployment if it exists
const envPath = path.join(__dirname, "../.env.deployment");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

async function main() {
  console.log("🚀 Dealix DEX Deployment - Step 1: Deploy All Contracts (Except Library)");
  console.log("======================================================================\n");

  // Network verification
  const chainId = (await ethers.provider.getNetwork()).chainId;
  console.log("📍 Network Details:");
  console.log("   Chain ID:", chainId);
  
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.utils.formatEther(await deployer.getBalance()));

  // Load existing contracts configuration
  const existingContracts = {
    ...deploymentConfig.EXISTING_CONTRACTS,
    ...(deploymentConfig.NETWORKS[network.name]?.existingContracts || {})
  };

  console.log("\n📋 Configuration:");
  console.log("   Skip existing:", deploymentConfig.OPTIONS.skipExisting);
  if (existingContracts.WETH) console.log("   Existing WETH:", existingContracts.WETH);
  if (existingContracts.FACTORY) console.log("   Existing Factory:", existingContracts.FACTORY);
  if (existingContracts.ROUTER) console.log("   Existing Router:", existingContracts.ROUTER);

  // Create deployment directory
  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir);
  }

  const deployment = {
    step: 1,
    network: network.name,
    chainId: chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {},
    gasUsed: {},
    totalGasUsed: ethers.BigNumber.from(0)
  };

  try {
    // 1. Deploy or use existing WETH/WDealix
    console.log("\n📋 Step 1: WETH/WDealix");
    console.log("=====================");
    
    if (existingContracts.WETH && deploymentConfig.OPTIONS.skipExisting) {
      console.log("✅ Using existing WETH:", existingContracts.WETH);
      deployment.contracts.WETH = existingContracts.WETH;
      deployment.skipped = deployment.skipped || [];
      deployment.skipped.push("WETH");
    } else {
      console.log("📦 Deploying new WETH/WDealix...");
      const WETH = await ethers.getContractFactory("WETH9");
      const weth = await WETH.deploy();
      await weth.deployed();
      const wethReceipt = await weth.deployTransaction.wait();
      
      deployment.contracts.WETH = weth.address;
      deployment.gasUsed.WETH = wethReceipt.gasUsed.toString();
      deployment.totalGasUsed = deployment.totalGasUsed.add(wethReceipt.gasUsed);
      
      console.log("✅ WETH deployed to:", weth.address);
      console.log("   Gas used:", wethReceipt.gasUsed.toString());
    }

    // 2. Deploy or use existing Factory
    console.log("\n📋 Step 2: Factory");
    console.log("==================");
    
    if (existingContracts.FACTORY && deploymentConfig.OPTIONS.skipExisting) {
      console.log("✅ Using existing Factory:", existingContracts.FACTORY);
      deployment.contracts.Factory = existingContracts.FACTORY;
      deployment.skipped = deployment.skipped || [];
      deployment.skipped.push("Factory");
    } else {
      console.log("📦 Deploying new Factory...");
      const Factory = await ethers.getContractFactory("DealixV2Factory");
      const factory = await Factory.deploy(deployer.address);
      await factory.deployed();
      const factoryReceipt = await factory.deployTransaction.wait();
      
      deployment.contracts.Factory = factory.address;
      deployment.gasUsed.Factory = factoryReceipt.gasUsed.toString();
      deployment.totalGasUsed = deployment.totalGasUsed.add(factoryReceipt.gasUsed);
      
      console.log("✅ Factory deployed to:", factory.address);
      console.log("   Gas used:", factoryReceipt.gasUsed.toString());
    }

    // 3. Get Init Code Hash
    console.log("\n📋 Step 3: Calculate Init Code Hash");
    console.log("===================================");
    
    const DealixPair = await ethers.getContractFactory("DealixV2Pair");
    const initCodeHash = ethers.utils.keccak256(DealixPair.bytecode);
    deployment.initCodeHash = initCodeHash;
    
    console.log("🔑 Init code hash:", initCodeHash);

    // 4. Deploy or use existing Router
    console.log("\n📋 Step 4: Router");
    console.log("=================");
    
    if (existingContracts.ROUTER && deploymentConfig.OPTIONS.skipExisting) {
      console.log("✅ Using existing Router:", existingContracts.ROUTER);
      deployment.contracts.Router = existingContracts.ROUTER;
      deployment.skipped = deployment.skipped || [];
      deployment.skipped.push("Router");
    } else {
      console.log("📦 Deploying new Router...");
      const Router = await ethers.getContractFactory("DealixV2Router02");
      const router = await Router.deploy(deployment.contracts.Factory, deployment.contracts.WETH);
      await router.deployed();
      const routerReceipt = await router.deployTransaction.wait();
      
      deployment.contracts.Router = router.address;
      deployment.gasUsed.Router = routerReceipt.gasUsed.toString();
      deployment.totalGasUsed = deployment.totalGasUsed.add(routerReceipt.gasUsed);
      
      console.log("✅ Router deployed to:", router.address);
      console.log("   Gas used:", routerReceipt.gasUsed.toString());
    }

    // Save deployment data
    const deploymentPath = path.join(deploymentDir, `${network.name}-contracts-deployment.json`);
    fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

    // Create init hash file
    const initHashPath = path.join(deploymentDir, "init-code-hash.txt");
    const initHashContent = `INIT CODE HASH: ${initCodeHash}

IMPORTANT: Update this in DealixLibrary.sol before running step 2!

Replace the hex value in the pairFor function with: ${initCodeHash.slice(2)}

Current deployment addresses:
- WETH: ${deployment.contracts.WETH}
- Factory: ${deployment.contracts.Factory}
- Router: ${deployment.contracts.Router}
`;
    fs.writeFileSync(initHashPath, initHashContent);

    console.log("\n============================================");
    console.log("📋 DEPLOYMENT SUMMARY - STEP 1");
    console.log("============================================");
    console.log("Network:", network.name, `(Chain ID: ${chainId})`);
    console.log("Deployer:", deployer.address);
    console.log("\nDeployed Contracts:");
    console.log("  WETH:", deployment.contracts.WETH, deployment.skipped?.includes("WETH") ? "(existing)" : "(new)");
    console.log("  Factory:", deployment.contracts.Factory, deployment.skipped?.includes("Factory") ? "(existing)" : "(new)");
    console.log("  Router:", deployment.contracts.Router, deployment.skipped?.includes("Router") ? "(existing)" : "(new)");
    console.log("\nTotal gas used:", deployment.totalGasUsed.toString());
    console.log("\n🔑 INIT CODE HASH:", initCodeHash);
    console.log("\n📄 Files created:");
    console.log("  Deployment data:", deploymentPath);
    console.log("  Init hash file:", initHashPath);
    
    console.log("\n⚠️  CRITICAL NEXT STEPS:");
    console.log("=====================================");
    console.log("1. Copy this init code hash: " + initCodeHash);
    console.log("2. Open contracts/libraries/DealixLibrary.sol");
    console.log("3. Find the pairFor function");
    console.log("4. Replace the hex value with: " + initCodeHash.slice(2));
    console.log("5. Save the file");
    console.log("6. Run: npx hardhat run scripts/2-deploy.js --network " + network.name);
    
    console.log("\n✅ Step 1 completed successfully!");
    console.log("   All contracts deployed except the library.");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    
    // Save partial deployment if any contracts were deployed
    if (Object.keys(deployment.contracts).length > 0) {
      const partialPath = path.join(deploymentDir, `${network.name}-partial-deployment.json`);
      fs.writeFileSync(partialPath, JSON.stringify(deployment, null, 2));
      console.log("\n⚠️  Partial deployment saved to:", partialPath);
    }
    
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
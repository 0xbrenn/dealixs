// scripts/2-deploy.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Dealix DEX Deployment - Step 2: Deploy Library");
  console.log("===============================================\n");

  // Load step 1 deployment
  const deploymentDir = path.join(__dirname, "../deployments");
  const step1Path = path.join(deploymentDir, `${network.name}-contracts-deployment.json`);
  
  if (!fs.existsSync(step1Path)) {
    console.error("❌ Step 1 deployment not found!");
    console.error("Please run: npx hardhat run scripts/1-deploy.js --network", network.name);
    process.exit(1);
  }

  const contractsDeployment = JSON.parse(fs.readFileSync(step1Path, 'utf8'));
  const [deployer] = await ethers.getSigners();
  
  console.log("📍 Network:", network.name);
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.utils.formatEther(await deployer.getBalance()));
  console.log("\n📋 Using contracts from Step 1:");
  console.log("  Factory:", contractsDeployment.contracts.Factory);
  console.log("  WETH:", contractsDeployment.contracts.WETH);
  console.log("  Router:", contractsDeployment.contracts.Router);

  // Verify init code hash
  console.log("\n🔍 Verifying Init Code Hash");
  console.log("============================");
  
  const DealixPair = await ethers.getContractFactory("DealixV2Pair");
  const currentInitCodeHash = ethers.utils.keccak256(DealixPair.bytecode);
  
  console.log("Expected hash (from step 1):", contractsDeployment.initCodeHash);
  console.log("Current hash:", currentInitCodeHash);
  
  if (currentInitCodeHash !== contractsDeployment.initCodeHash) {
    console.warn("\n⚠️  WARNING: Init code hash has changed!");
    console.warn("This might cause issues with pair address calculation.");
  }

  // Check DealixLibrary has been updated
  console.log("\n📋 Checking DealixLibrary.sol");
  console.log("============================");
  
  const libraryPath = path.join(__dirname, "../contracts/libraries/DealixV2Library.sol");
  const libraryContent = fs.readFileSync(libraryPath, 'utf8');
  const hexPattern = /hex["']([0-9a-fA-F]{64})["']/;
  const match = libraryContent.match(hexPattern);
  
  if (match) {
    const libraryHash = `0x${match[1]}`;
    console.log("Library hash found:", libraryHash);
    
    if (libraryHash !== currentInitCodeHash) {
      console.error("\n❌ ERROR: DealixV2Library.sol has not been updated with the correct init code hash!");
      console.error("Expected:", currentInitCodeHash);
      console.error("Found:", libraryHash);
      console.error("\nPlease update the hex value in DealixV2Library.sol to:", currentInitCodeHash.slice(2));
      process.exit(1);
    }
    console.log("✅ DealixLibrary.sol has correct init code hash");
  } else {
    console.error("❌ Could not find init code hash in DealixV2Library.sol");
    process.exit(1);
  }

  // Deploy the library
  console.log("\n📋 Deploying DealixV2Library");
  console.log("========================");
  
  try {
    const DealixLibrary = await ethers.getContractFactory("DealixV2Library");
    const library = await DealixLibrary.deploy();
    await library.deployed();
    const libraryReceipt = await library.deployTransaction.wait();
    
    console.log("✅ DealixLibrary deployed to:", library.address);
    console.log("   Gas used:", libraryReceipt.gasUsed.toString());

    // Create final deployment summary
    const finalDeployment = {
      ...contractsDeployment,
      step: 2,
      libraryDeployment: {
        timestamp: new Date().toISOString(),
        address: library.address,
        gasUsed: libraryReceipt.gasUsed.toString()
      },
      contracts: {
        ...contractsDeployment.contracts,
        DealixLibrary: library.address
      }
    };

    // Update total gas
    finalDeployment.totalGasUsed = ethers.BigNumber.from(contractsDeployment.totalGasUsed)
      .add(libraryReceipt.gasUsed)
      .toString();

    // Save final deployment
    const finalDeploymentPath = path.join(deploymentDir, `${network.name}-complete-deployment.json`);
    fs.writeFileSync(finalDeploymentPath, JSON.stringify(finalDeployment, null, 2));

    // Create frontend env file
    const envContent = `# Dealix DEX Complete Deployment - ${new Date().toISOString()}
# Network: ${network.name} (Chain ID: ${finalDeployment.chainId})

# Core Contracts
REACT_APP_WETH_ADDRESS=${finalDeployment.contracts.WETH}
REACT_APP_FACTORY_ADDRESS=${finalDeployment.contracts.Factory}
REACT_APP_ROUTER_ADDRESS=${finalDeployment.contracts.Router}
REACT_APP_LIBRARY_ADDRESS=${finalDeployment.contracts.DealixLibrary}

# Init Code Hash
REACT_APP_INIT_CODE_HASH=${finalDeployment.initCodeHash}

# Network Configuration
REACT_APP_CHAIN_ID=${finalDeployment.chainId}
${network.name === 'DealixTestnet' ? `REACT_APP_RPC_URL=https://testnet-rpc.Dealix.tech
REACT_APP_EXPLORER_URL=https://testnet-explorer.Dealix.tech` : ''}
`;

    const envPath = path.join(deploymentDir, `.env.${network.name}`);
    fs.writeFileSync(envPath, envContent);

    console.log("\n============================================");
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("============================================");
    console.log("Network:", network.name, `(Chain ID: ${finalDeployment.chainId})`);
    console.log("\nAll Contracts:");
    console.log("  WETH:", finalDeployment.contracts.WETH);
    console.log("  Factory:", finalDeployment.contracts.Factory);
    console.log("  Router:", finalDeployment.contracts.Router);
    console.log("  DealixLibrary:", finalDeployment.contracts.DealixLibrary);
    console.log("\nInit Code Hash:", finalDeployment.initCodeHash);
    console.log("Total gas used:", finalDeployment.totalGasUsed);
    console.log("\n📄 Files created:");
    console.log("  Complete deployment:", finalDeploymentPath);
    console.log("  Frontend env:", envPath);
    
    console.log("\n🚀 Next Steps:");
    console.log("1. Copy the env file to your frontend:");
    console.log(`   cp ${envPath} ../frontend/.env.local`);
    console.log("2. Your DEX is ready to use!");
    
    if (network.name === 'DealixTestnet') {
      console.log("\n📱 Dealix Testnet Details:");
      console.log("   RPC URL: https://testnet-rpc.Dealix.tech");
      console.log("   Chain ID: 984");
      console.log("   Currency Symbol: Dealix");
      console.log("   Block Explorer: https://testnet-explorer.Dealix.tech");
    }
    
    console.log("\n✅ All contracts deployed successfully!");

  } catch (error) {
    console.error("\n❌ Library deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
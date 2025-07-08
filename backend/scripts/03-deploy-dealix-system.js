const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Deploying Dealix System ===");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  
  // Read DEX deployment
  const dexDeployment = JSON.parse(fs.readFileSync("dealix-deployment-complete.json", "utf8"));
  const ROUTER_ADDRESS = dexDeployment.router;
  const FACTORY_ADDRESS = dexDeployment.factory;
  const WETH_ADDRESS = dexDeployment.weth;
  
  console.log("\nUsing DEX contracts:");
  console.log("Router:", ROUTER_ADDRESS);
  console.log("Factory:", FACTORY_ADDRESS);
  console.log("WETH:", WETH_ADDRESS);
  
  // Deploy treasury (can be a multisig in production)
  const treasuryAddress = deployer.address; // Use deployer as treasury for now
  const guardianAddress = deployer.address; // Use deployer as guardian for now
  
  // 1. Deploy DealixDEX
  console.log("\n1. Deploying DealixDEX...");
  const DealixDEX = await hre.ethers.getContractFactory("contracts/dealix/DealixDEX.sol:DealixDEX");
  const dealixDEX = await DealixDEX.deploy(
    ROUTER_ADDRESS,
    FACTORY_ADDRESS,
    treasuryAddress,
    guardianAddress
  );
  await dealixDEX.deployed();
  console.log("✅ DealixDEX deployed to:", dealixDEX.address);
  
  // 2. Deploy DealixLiquidityManager
  console.log("\n2. Deploying DealixLiquidityManager...");
  const DealixLiquidityManager = await hre.ethers.getContractFactory("contracts/dealix/DealixLiquidityManager.sol:DealixLiquidityManager");
  const liquidityManager = await DealixLiquidityManager.deploy(
    ROUTER_ADDRESS,
    FACTORY_ADDRESS,
    dealixDEX.address,
    treasuryAddress
  );
  await liquidityManager.deployed();
  console.log("✅ DealixLiquidityManager deployed to:", liquidityManager.address);
  
  // 3. Save deployment info
  const dealixDeployment = {
    ...dexDeployment,
    dealixDEX: dealixDEX.address,
    liquidityManager: liquidityManager.address,
    treasury: treasuryAddress,
    guardian: guardianAddress,
    dealixSystem: {
      mintingFee: "0.0005",
      platformFee: "0.25%",
      affiliatePlatformCut: "10%",
      maxDiscountPercentage: "50%"
    },
    deployedAt: new Date().toISOString()
  };
  
  fs.writeFileSync("dealix-complete-deployment.json", JSON.stringify(dealixDeployment, null, 2));
  
  console.log("\n===========================================");
  console.log("🎉 DEALIX SYSTEM DEPLOYED SUCCESSFULLY!");
  console.log("===========================================");
  console.log("DealixDEX:", dealixDEX.address);
  console.log("LiquidityManager:", liquidityManager.address);
  console.log("===========================================");
  
  console.log("\n📋 Next Steps:");
  console.log("1. Verify the contracts on Basescan");
  console.log("2. Set up initial badges and tiers");
  console.log("3. Verify some initial projects");
  console.log("4. Update frontend with new addresses");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
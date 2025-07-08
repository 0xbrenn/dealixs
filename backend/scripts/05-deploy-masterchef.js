// scripts/05-deploy-masterchef.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Deploying DealixMasterChef ===");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());
  
  // Read existing deployment
  const deployment = JSON.parse(fs.readFileSync("dealix-complete-deployment.json", "utf8"));
  const DEALIX_DEX = deployment.dealixDEX;
  
  // Configuration
  const REWARD_TOKEN = "0x..."; // Your reward token address (you need to deploy or specify this)
  const REWARD_PER_SECOND = hre.ethers.utils.parseEther("1"); // 1 token per second
  const START_TIME = Math.floor(Date.now() / 1000) + 3600; // Start in 1 hour
  const FEE_ADDRESS = deployer.address; // Use treasury or separate fee address
  
  console.log("\nConfiguration:");
  console.log("DealixDEX:", DEALIX_DEX);
  console.log("Reward Token:", REWARD_TOKEN);
  console.log("Reward Per Second:", hre.ethers.utils.formatEther(REWARD_PER_SECOND));
  console.log("Start Time:", new Date(START_TIME * 1000).toLocaleString());
  console.log("Fee Address:", FEE_ADDRESS);
  
  // Deploy MasterChef
  console.log("\nDeploying MasterChef...");
  const MasterChef = await hre.ethers.getContractFactory("contracts/dealix/DealixMasterChef.sol:DealixMasterChef");
  const masterChef = await MasterChef.deploy(
    REWARD_TOKEN,
    DEALIX_DEX,
    REWARD_PER_SECOND,
    START_TIME,
    FEE_ADDRESS
  );
  await masterChef.deployed();
  console.log("✅ MasterChef deployed to:", masterChef.address);
  
  // Save deployment
  deployment.masterChef = masterChef.address;
  deployment.farming = {
    rewardToken: REWARD_TOKEN,
    rewardPerSecond: REWARD_PER_SECOND.toString(),
    startTime: START_TIME,
    feeAddress: FEE_ADDRESS
  };
  
  fs.writeFileSync("dealix-complete-deployment.json", JSON.stringify(deployment, null, 2));
  
  console.log("\n===========================================");
  console.log("🎉 MASTERCHEF DEPLOYED SUCCESSFULLY!");
  console.log("===========================================");
  console.log("MasterChef:", masterChef.address);
  console.log("===========================================");
  
  console.log("\n📋 Next Steps:");
  console.log("1. Transfer reward tokens to MasterChef");
  console.log("2. Add farming pools");
  console.log("3. Update frontend");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// scripts/06-add-pools.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Adding Farming Pools ===");
  
  const deployment = JSON.parse(fs.readFileSync("dealix-complete-deployment.json", "utf8"));
  const masterChef = await hre.ethers.getContractAt("DealixMasterChef", deployment.masterChef);
  
  // Example pools configuration
  const pools = [
    {
      lpToken: "0x...", // Your LP token address
      allocPoint: 1000,
      depositFeeBP: 0, // No deposit fee
      harvestInterval: 0, // No harvest interval
      withdrawLockTime: 0, // No lock time
      rewarder: hre.ethers.constants.AddressZero
    },
    // Add more pools as needed
  ];
  
  for (const pool of pools) {
    console.log(`\nAdding pool for LP token: ${pool.lpToken}`);
    const tx = await masterChef.add(
      pool.allocPoint,
      pool.lpToken,
      pool.rewarder,
      pool.depositFeeBP,
      pool.harvestInterval,
      pool.withdrawLockTime,
      true // with update
    );
    await tx.wait();
    console.log("✅ Pool added");
  }
  
  console.log("\n✅ All pools added successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
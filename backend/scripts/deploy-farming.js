const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying farming contracts with:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Get network name
  const network = hre.network.name;
  console.log("Deploying to network:", network);

  // Load existing contract addresses from your previous deployment
  const deploymentPath = path.join(__dirname, `../.env.${network}`);
  require('dotenv').config({ path: deploymentPath });

  // Use your existing token address or deploy a new reward token
  let rewardTokenAddress;
  
  // Option 1: Use existing token (e.g., your WETH/WOPN)
  rewardTokenAddress = process.env.REACT_APP_WETH_ADDRESS || process.env.WETH_ADDRESS;
  console.log("Using existing WETH as reward token:", rewardTokenAddress);
  
  // Option 2: Deploy a new reward token (uncomment if needed)
  /*
  const RewardToken = await hre.ethers.getContractFactory("ERC20Mock");
  const rewardToken = await RewardToken.deploy("OPN Token", "OPN", hre.ethers.utils.parseUnits("1000000", 18));
  await rewardToken.deployed();
  rewardTokenAddress = rewardToken.address;
  console.log("Reward Token deployed to:", rewardTokenAddress);
  */

  // Deploy MasterChef
  console.log("\nDeploying MasterChef...");
  const MasterChef = await hre.ethers.getContractFactory("MasterChef");
  
  // Configure farming parameters
  const rewardPerBlock = hre.ethers.utils.parseUnits("1", 18); // 1 token per block
  const currentBlock = await hre.ethers.provider.getBlockNumber();
  const startBlock = currentBlock + 100; // Start farming in 100 blocks
  const endBlock = startBlock + 1000000; // Run for ~1 month (assuming 3s blocks)
  
  const masterChef = await MasterChef.deploy(
    rewardTokenAddress,
    rewardPerBlock,
    startBlock,
    endBlock
  );
  
  await masterChef.deployed();
  console.log("MasterChef deployed to:", masterChef.address);
  
  // Get LP token addresses from factory
const factoryAddress = process.env.REACT_APP_FACTORY_ADDRESS || process.env.FACTORY_ADDRESS;
  const factoryABI = [
    "function allPairsLength() external view returns (uint)",
    "function allPairs(uint) external view returns (address)"
  ];
  
  const factory = new hre.ethers.Contract(factoryAddress, factoryABI, deployer);
  const pairCount = await factory.allPairsLength();
  console.log(`\nFound ${pairCount} LP pairs`);
  
  // Add pools for each LP pair
  console.log("\nAdding pools to MasterChef...");
  const pools = [];
  
  for (let i = 0; i < pairCount; i++) {
    const lpTokenAddress = await factory.allPairs(i);
    
    // Get pair info
    const pairABI = [
      "function token0() view returns (address)",
      "function token1() view returns (address)",
      "function symbol() view returns (string)"
    ];
    const pair = new hre.ethers.Contract(lpTokenAddress, pairABI, deployer);
    
    try {
      const symbol = await pair.symbol();
      
      // Assign allocation points based on pair importance
      // You can customize this logic
      let allocPoint = 1000; // Default allocation
      let depositFee = 0; // No fee by default
      
      // Example: Give more rewards to specific pairs
      if (symbol.includes("WETH") || symbol.includes("WOPN")) {
        allocPoint = 4000; // 4x rewards for WETH pairs
      } else if (symbol.includes("USDC") || symbol.includes("DAI")) {
        allocPoint = 2000; // 2x rewards for stablecoin pairs
      }
      
      // Add the pool
      await masterChef.add(allocPoint, lpTokenAddress, depositFee, false);
      console.log(`Added pool ${i}: ${symbol} (${lpTokenAddress}) - ${allocPoint} points`);
      
      pools.push({
        lpToken: lpTokenAddress,
        symbol: symbol,
        allocPoint: allocPoint,
        depositFee: depositFee
      });
    } catch (error) {
      console.log(`Skipping pair ${i} - Error: ${error.message}`);
    }
  }
  
  // Transfer reward tokens to MasterChef
  console.log("\nSetting up reward tokens...");
const rewardTokenContract = await hre.ethers.getContractAt("contracts/interfaces/IERC20.sol:IERC20", rewardTokenAddress);
  const rewardBalance = await rewardTokenContract.balanceOf(deployer.address);
  console.log("Deployer reward token balance:", hre.ethers.utils.formatUnits(rewardBalance, 18));
  
  // Calculate required rewards (rough estimate)
  const blocksToRun = endBlock - startBlock;
  const totalRewardsNeeded = rewardPerBlock.mul(blocksToRun);
  console.log("Total rewards needed:", hre.ethers.utils.formatUnits(totalRewardsNeeded, 18));
  
  // Transfer rewards if you have them
  if (rewardBalance.gte(totalRewardsNeeded)) {
    console.log("Transferring reward tokens to MasterChef...");
    await rewardTokenContract.transfer(masterChef.address, totalRewardsNeeded);
    console.log("Transferred!");
  } else {
    console.log("\n⚠️  WARNING: Insufficient reward tokens!");
    console.log("You need to transfer reward tokens to MasterChef manually");
    console.log(`Required: ${hre.ethers.utils.formatUnits(totalRewardsNeeded, 18)}`);
    console.log(`Available: ${hre.ethers.utils.formatUnits(rewardBalance, 18)}`);
  }
  
  // Save deployment info
  const deploymentInfo = {
    network: network,
    masterChef: masterChef.address,
    rewardToken: rewardTokenAddress,
    rewardPerBlock: rewardPerBlock.toString(),
    startBlock: startBlock,
    endBlock: endBlock,
    pools: pools,
    deployedAt: new Date().toISOString()
  };
  
  // Save to JSON file
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const deploymentFile = path.join(deploymentsDir, `${network}-farming-deployment.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  
  // Update .env file
  const envPath = path.join(__dirname, `../.env.${network}`);
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Add or update MasterChef address
  if (envContent.includes('REACT_APP_MASTERCHEF_ADDRESS=')) {
    envContent = envContent.replace(/REACT_APP_MASTERCHEF_ADDRESS=.*/g, `REACT_APP_MASTERCHEF_ADDRESS=${masterChef.address}`);
  } else {
    envContent += `\n# Farming Contract\nREACT_APP_MASTERCHEF_ADDRESS=${masterChef.address}\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  
  // Also create/update frontend .env
  const frontendEnvPath = path.join(__dirname, '../../frontend/.env');
  fs.writeFileSync(frontendEnvPath, envContent);
  
  console.log("\n✅ Deployment complete!");
  console.log("=====================================");
  console.log("MasterChef:", masterChef.address);
  console.log("Reward Token:", rewardTokenAddress);
  console.log("Start Block:", startBlock);
  console.log("End Block:", endBlock);
  console.log("Pools Added:", pools.length);
  console.log("=====================================");
  console.log("\nEnvironment variables updated in:");
  console.log(`- ${envPath}`);
  console.log(`- ${frontendEnvPath}`);
  console.log("\nDeployment info saved to:");
  console.log(`- ${deploymentFile}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
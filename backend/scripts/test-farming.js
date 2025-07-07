const hre = require("hardhat");

async function main() {
  const [user] = await hre.ethers.getSigners();
  
  // Load addresses
  const masterChefAddress = process.env.REACT_APP_MASTERCHEF_ADDRESS;
  const factoryAddress = process.env.FACTORY_ADDRESS;
  
  console.log("Testing farming with user:", user.address);
  console.log("MasterChef:", masterChefAddress);
  
  // Get contracts
  const masterChef = await hre.ethers.getContractAt("MasterChef", masterChefAddress);
  const factory = await hre.ethers.getContractAt("IIOPNFactory", factoryAddress);
  
  // Get first LP token
  const lpToken = await factory.allPairs(0);
  const lpContract = await hre.ethers.getContractAt("IERC20", lpToken);
  
  console.log("\nLP Token:", lpToken);
  console.log("LP Balance:", hre.ethers.utils.formatUnits(await lpContract.balanceOf(user.address), 18));
  
  // Check pool info
  const poolInfo = await masterChef.poolInfo(0);
  console.log("\nPool Info:");
  console.log("- LP Token:", poolInfo.lpToken);
  console.log("- Alloc Points:", poolInfo.allocPoint.toString());
  console.log("- Deposit Fee:", poolInfo.depositFee.toString());
  
  // Check pending rewards
  const pending = await masterChef.pendingReward(0, user.address);
  console.log("\nPending Rewards:", hre.ethers.utils.formatUnits(pending, 18));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
// scripts/deploy-new-router-only.js
const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying ONLY the new Router...");
  
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  
  // Your existing contracts (DON'T CHANGE THESE)
  const EXISTING_FACTORY = "0x8E9f8751f1419b7D04DF68065bb8C5f0d870475E";
  const EXISTING_WETH = "0x4200000000000000000000000000000000000006";
  
  // Deploy ONLY the new router
  const Router = await hre.ethers.getContractFactory("DealixRouter02");
  const router = await Router.deploy(EXISTING_FACTORY, EXISTING_WETH);
  await router.deployed();
  
  console.log("✅ New Router deployed to:", router.address);
  
  // Update your .env file
  console.log("\n📝 Update your frontend .env:");
  console.log(`REACT_APP_ROUTER_ADDRESS=${router.address}`);
  console.log("\n📝 Update your DealixDEX if needed:");
  console.log(`New Router: ${router.address}`);
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
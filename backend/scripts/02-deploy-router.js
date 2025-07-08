// scripts/02-deploy-router-fixed.js
const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying DealixV2Router02...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Read factory address
  const factoryDeployment = JSON.parse(fs.readFileSync("factory-deployment.json", "utf8"));
  const FACTORY_ADDRESS = factoryDeployment.factory;
  const WETH_ADDRESS = "0x4200000000000000000000000000000000000006"; // WETH on Base
  
  console.log("Using Factory:", FACTORY_ADDRESS);
  console.log("Using WETH:", WETH_ADDRESS);
  
  // Load the Router artifact
  const routerArtifact = require("../artifacts/contracts/v2-periphery/contracts/DealixV2Router02.sol/DealixV2Router02.json");
  
  // Create contract factory
  const DealixV2Router02 = await hre.ethers.getContractFactory(
    routerArtifact.abi,
    routerArtifact.bytecode,
    deployer
  );
  
  // Deploy router
  console.log("Deploying Router...");
  const router = await DealixV2Router02.deploy(FACTORY_ADDRESS, WETH_ADDRESS);
  await router.deployed();
  
  console.log("DealixV2Router02 deployed to:", router.address);
  
  // Save complete deployment info
  const deployment = {
    factory: FACTORY_ADDRESS,
    router: router.address,
    weth: WETH_ADDRESS,
    initCodeHash: factoryDeployment.initCodeHash,
    deployer: deployer.address,
    network: "base",
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync("deployment-complete.json", JSON.stringify(deployment, null, 2));
  
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("Factory:", FACTORY_ADDRESS);
  console.log("Router:", router.address);
  console.log("WETH:", WETH_ADDRESS);
  console.log("===========================");
  
  console.log("\n🎉 Dealix V2 is now deployed on Base mainnet!");
  console.log("\nYou can verify the contracts on Basescan:");
  console.log(`Factory: https://basescan.org/address/${FACTORY_ADDRESS}`);
  console.log(`Router: https://basescan.org/address/${router.address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
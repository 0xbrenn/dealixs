const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Configuring Dealix System ===");
  
  const [deployer] = await hre.ethers.getSigners();
  const deployment = JSON.parse(fs.readFileSync("dealix-complete-deployment.json", "utf8"));
  
  // Get contract instances
  const dealixDEX = await hre.ethers.getContractAt("DealixDEX", deployment.dealixDEX);
  const liquidityManager = await hre.ethers.getContractAt("DealixLiquidityManager", deployment.liquidityManager);
  
  console.log("\n1. Verifying initial projects...");
  // Add some initial verified projects (example)
  const projectsToVerify = [
    // Add project addresses here
  ];
  
  for (const project of projectsToVerify) {
    console.log(`Verifying project: ${project}`);
    await dealixDEX.verifyProject(project);
  }
  
  console.log("\n✅ Configuration complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
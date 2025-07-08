const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Verifying Dealix Contracts ===");
  
  const deployment = JSON.parse(fs.readFileSync("dealix-deployment-complete.json", "utf8"));
  
  // Verify Factory
  console.log("\nVerifying Factory...");
  try {
    await hre.run("verify:verify", {
      address: deployment.factory,
      constructorArguments: [deployment.deployer],
      contract: "contracts/v2-core/contracts/DealixV2Factory.sol:DealixV2Factory"
    });
    console.log("✅ Factory verified!");
  } catch (error) {
    console.log("❌ Factory verification failed:", error.message);
  }
  
  // Verify Router
  console.log("\nVerifying Router...");
  try {
    await hre.run("verify:verify", {
      address: deployment.router,
      constructorArguments: [deployment.factory, deployment.weth],
      contract: "contracts/v2-periphery/contracts/DealixV2Router02.sol:DealixV2Router02"
    });
    console.log("✅ Router verified!");
  } catch (error) {
    console.log("❌ Router verification failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

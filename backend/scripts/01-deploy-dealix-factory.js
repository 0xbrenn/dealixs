const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("=== Deploying Dealix Factory ===");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Load the compiled contract artifacts
  const factoryArtifact = require("../artifacts/contracts/v2-core/contracts/DealixV2Factory.sol/DealixV2Factory.json");
  const pairArtifact = require("../artifacts/contracts/v2-core/contracts/DealixV2Pair.sol/DealixV2Pair.json");
  
  // Create contract factory
  const DealixV2Factory = await hre.ethers.getContractFactory(
    factoryArtifact.abi,
    factoryArtifact.bytecode,
    deployer
  );
  
  // Deploy factory with deployer as feeToSetter
  console.log("\nDeploying Dealix Factory...");
  const factory = await DealixV2Factory.deploy(deployer.address);
  await factory.deployed();
  
  console.log("✅ DealixV2Factory deployed to:", factory.address);
  
  // Get init code hash from the Pair bytecode
  const initCodeHash = hre.ethers.utils.keccak256(pairArtifact.bytecode);
  console.log("📝 Init code hash:", initCodeHash);
  
  // Save deployment info
  const deployment = {
    factory: factory.address,
    initCodeHash: initCodeHash,
    deployer: deployer.address,
    network: "base",
    contractName: "DealixV2Factory",
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync("dealix-factory-deployment.json", JSON.stringify(deployment, null, 2));
  
  console.log("\n===========================================");
  console.log("🎉 DEALIX FACTORY DEPLOYED SUCCESSFULLY!");
  console.log("===========================================");
  console.log("Factory:", factory.address);
  console.log("Init Hash:", initCodeHash);
  console.log("===========================================");
  console.log("\n⚠️  IMPORTANT: Update this init code hash in DealixV2Library.sol");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

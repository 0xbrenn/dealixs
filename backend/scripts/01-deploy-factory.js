// Option 1: Update your deployment scripts to use the contracts from the cloned repos directly
// Update scripts/01-deploy-factory.js

const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("Deploying DealixV2Factory...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // Get the contract factory - use the actual path to the cloned contract
  const DealixV2Factory = await hre.ethers.getContractFactory(
    "v2-core/contracts/DealixV2Factory.sol:DealixV2Factory"
  );
  
  // Deploy factory with deployer as feeToSetter
  const factory = await DealixV2Factory.deploy(deployer.address);
  await factory.deployed();
  
  console.log("DealixV2Factory deployed to:", factory.address);
  
  // Get init code hash
  const DealixV2Pair = await hre.ethers.getContractFactory(
    "v2-core/contracts/DealixV2Pair.sol:DealixV2Pair"
  );
  const initCodeHash = hre.ethers.utils.keccak256(DealixV2Pair.bytecode);
  console.log("Init code hash:", initCodeHash);
  
  // Save deployment info
  const deployment = {
    factory: factory.address,
    initCodeHash: initCodeHash,
    deployer: deployer.address,
    network: "base",
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync("factory-deployment.json", JSON.stringify(deployment, null, 2));
  
  console.log("\n===========================================");
  console.log("IMPORTANT: SAVE THIS INIT CODE HASH:");
  console.log(initCodeHash);
  console.log("===========================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
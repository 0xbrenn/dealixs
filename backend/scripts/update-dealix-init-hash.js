const fs = require("fs");
const path = require("path");

// Read the deployment file
const deployment = JSON.parse(fs.readFileSync("dealix-factory-deployment.json", "utf8"));
const initCodeHash = deployment.initCodeHash;

console.log("=== Update Dealix Init Code Hash ===");
console.log("Init code hash from deployment:", initCodeHash);
console.log("\nYou need to update this hash in:");
console.log("contracts/v2-periphery/contracts/libraries/DealixV2Library.sol");
console.log("\nFind this line (around line 24):");
console.log("hex'96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f'");
console.log("\nReplace it with:");
console.log("hex'" + initCodeHash.substring(2) + "'");
console.log("\n✅ After updating, run: npx hardhat compile");
console.log("Then deploy the router: npx hardhat run scripts/02-deploy-dealix-router.js --network base");

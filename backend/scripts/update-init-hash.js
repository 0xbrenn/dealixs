const fs = require("fs");
const path = require("path");

// Read the deployment file
const deployment = JSON.parse(fs.readFileSync("factory-deployment.json", "utf8"));
const initCodeHash = deployment.initCodeHash;

console.log("Init code hash from deployment:", initCodeHash);
console.log("\nYou need to update this hash in:");
console.log("contracts/v2-periphery/contracts/libraries/DealixV2Library.sol");
console.log("\nFind this line (around line 24):");
console.log("hex'96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f'");
console.log("\nReplace it with:");
console.log("hex'" + initCodeHash.substring(2) + "'");

// Optionally auto-update (uncomment if you want automatic update)
/*
const libraryPath = path.join(__dirname, "../contracts/v2-periphery/contracts/libraries/DealixV2Library.sol");
let libraryContent = fs.readFileSync(libraryPath, "utf8");
libraryContent = libraryContent.replace(
  /hex'[0-9a-fA-F]{64}'/,
  "hex'" + initCodeHash.substring(2) + "'"
);
fs.writeFileSync(libraryPath, libraryContent);
console.log("\n✅ Updated DealixV2Library.sol automatically!");
*/

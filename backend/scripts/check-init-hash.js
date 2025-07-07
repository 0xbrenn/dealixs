// backend/scripts/check-init-hash.js
const hre = require("hardhat");

async function main() {
  console.log("🔍 Checking Init Code Hash\n");
  
  // Get the DealixPair bytecode to calculate init code hash
  const DealixPair = await hre.ethers.getContractFactory("DealixPair");
  const initCodeHash = hre.ethers.utils.keccak256(DealixPair.bytecode);
  
  console.log("Calculated init code hash:", initCodeHash);
  console.log("\nThis hash should be in DealixLibrary.sol in the pairFor function.");
  console.log("\nCheck contracts/libraries/DealixLibrary.sol and look for hex'...'");
  
  // Try to read the current hash from the library
  const fs = require('fs');
  const path = require('path');
  
  try {
    const libraryPath = path.join(__dirname, '../contracts/libraries/DealixLibrary.sol');
    const libraryContent = fs.readFileSync(libraryPath, 'utf8');
    
    // Find the hex value in pairFor function
    const hexMatch = libraryContent.match(/hex['"]([a-f0-9]{64})['"]|hex'([a-f0-9]{64})'|0x([a-f0-9]{64})/i);
    
    if (hexMatch) {
      const currentHash = '0x' + (hexMatch[1] || hexMatch[2] || hexMatch[3]);
      console.log("\nCurrent hash in DealixLibrary:", currentHash);
      console.log("Hashes match:", currentHash.toLowerCase() === initCodeHash.toLowerCase());
      
      if (currentHash.toLowerCase() !== initCodeHash.toLowerCase()) {
        console.log("\n❌ INIT CODE HASH MISMATCH!");
        console.log("\nTo fix:");
        console.log("1. Update DealixLibrary.sol with the correct hash");
        console.log("2. Redeploy the router");
        
        // Show what needs to be replaced
        console.log("\nReplace this line in DealixLibrary.sol:");
        console.log(`hex'${(hexMatch[1] || hexMatch[2] || hexMatch[3])}'`);
        console.log("\nWith:");
        console.log(`hex'${initCodeHash.slice(2)}'`);
      } else {
        console.log("\n✅ Init code hash is correct!");
      }
    } else {
      console.log("\n⚠️  Could not find hex value in DealixLibrary.sol");
    }
  } catch (e) {
    console.log("Error reading library file:", e.message);
  }
  
  // Also check if pair exists
  const FACTORY = "0x8E9f8751f1419b7D04DF68065bb8C5f0d870475E";
  const TOKEN = "0xC47f07f912ebF94a522f267cD833A8e0b1CF3d16";
  const WETH = "0x4200000000000000000000000000000000000006";
  
  const factory = await hre.ethers.getContractAt([
    "function getPair(address,address) view returns (address)",
    "function allPairsLength() view returns (uint256)"
  ], FACTORY);
  
  console.log("\n=== Factory Info ===");
  const pairAddress = await factory.getPair(TOKEN, WETH);
  const pairsLength = await factory.allPairsLength();
  
  console.log("Total pairs:", pairsLength.toString());
  console.log("TOKEN/WETH pair:", pairAddress);
  console.log("Pair exists:", pairAddress !== hre.ethers.constants.AddressZero);
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
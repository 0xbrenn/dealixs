// backend/scripts/fix-token-exclusions.js
const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  const TOKEN = "0xC47f07f912ebF94a522f267cD833A8e0b1CF3d16";
  const ROUTER = "0x836cfa3347C78Ff4E96044AbFa2AD2ca0BA29d65";
  
  // Your token has different function names (no underscore)
  const token = await hre.ethers.getContractAt([
    "function isExcludedFromFees(address) view returns (bool)",  // No underscore!
    "function excludeFromFees(address,bool)",
    "function owner() view returns (address)"
  ], TOKEN);
  
  console.log("Fixing token fee exclusions...\n");
  
  // Check owner
  const owner = await token.owner();
  console.log("You are the owner:", owner);
  
  // Check router exclusion
  try {
    const routerExcluded = await token.isExcludedFromFees(ROUTER);
    console.log("Router excluded from fees:", routerExcluded);
    
    if (!routerExcluded) {
      console.log("\nExcluding router from fees...");
      const tx = await token.excludeFromFees(ROUTER, true);
      console.log("Tx hash:", tx.hash);
      await tx.wait();
      console.log("✅ Router excluded!");
    } else {
      console.log("✅ Router already excluded!");
    }
  } catch (e) {
    console.log("Error checking exclusion:", e.message);
  }
  
  console.log("\n✅ Done! Now try adding liquidity again.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
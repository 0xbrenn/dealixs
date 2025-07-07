// backend/scripts/fix-fee-exclusions.js
const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  const TOKEN = "0xC47f07f912ebF94a522f267cD833A8e0b1CF3d16";
  const ROUTER = "0x836cfa3347C78Ff4E96044AbFa2AD2ca0BA29d65";
  const FACTORY = "0x8E9f8751f1419b7D04DF68065bb8C5f0d870475E";
  
  const token = await hre.ethers.getContractAt([
    "function _isExcludedFromFees(address) view returns (bool)",
    "function excludeFromFees(address,bool)",
    "function owner() view returns (address)",
    "function tradingActive() view returns (bool)",
    "function enableTrading()"
  ], TOKEN);
  
  console.log("Checking token configuration...\n");
  
  // Check owner
  const owner = await token.owner();
  const isOwner = owner.toLowerCase() === signer.address.toLowerCase();
  console.log("Token owner:", owner);
  console.log("You are owner:", isOwner);
  
  if (!isOwner) {
    console.log("\n❌ You're not the owner. Ask the owner to run this script.");
    return;
  }
  
  // Check trading
  const tradingActive = await token.tradingActive();
  console.log("\nTrading active:", tradingActive);
  
  if (!tradingActive) {
    console.log("Enabling trading...");
    const tx1 = await token.enableTrading();
    await tx1.wait();
    console.log("✅ Trading enabled!");
  }
  
  // Check router exclusion
  const routerExcluded = await token._isExcludedFromFees(ROUTER);
  console.log("\nRouter excluded from fees:", routerExcluded);
  
  if (!routerExcluded) {
    console.log("Excluding router from fees...");
    const tx2 = await token.excludeFromFees(ROUTER, true);
    await tx2.wait();
    console.log("✅ Router excluded!");
  }
  
  // Check if pair exists and exclude it too
  const factory = await hre.ethers.getContractAt(["function getPair(address,address) view returns (address)"], FACTORY);
  const WETH = "0x4200000000000000000000000000000000000006";
  const pair = await factory.getPair(TOKEN, WETH);
  
  if (pair !== hre.ethers.constants.AddressZero) {
    const pairExcluded = await token._isExcludedFromFees(pair);
    console.log("\nPair address:", pair);
    console.log("Pair excluded from fees:", pairExcluded);
    
    if (!pairExcluded) {
      console.log("Excluding pair from fees...");
      const tx3 = await token.excludeFromFees(pair, true);
      await tx3.wait();
      console.log("✅ Pair excluded!");
    }
  } else {
    console.log("\nPair doesn't exist yet (will be created on first liquidity)");
  }
  
  console.log("\n✅ All checks complete! Your token should now work with the DEX.");
}

main().catch(console.error);
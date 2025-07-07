// backend/scripts/verify-exclusion.js
const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  console.log("🔍 Verifying Tax Exclusion\n");
  
  const TOKEN = "0xC47f07f912ebF94a522f267cD833A8e0b1CF3d16";
  const PAIR = "0xcB29e61e97c065c31DfFff0950624bc76f9A298D";
  const ROUTER = "0x836cfa3347C78Ff4E96044AbFa2AD2ca0BA29d65";
  
  // Get token contract
  const token = await hre.ethers.getContractAt([
    "function isExcludedFromFees(address) view returns (bool)",
    "function excludeFromFees(address,bool)",
    "function transfer(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function owner() view returns (address)",
    "function _isExcludedMaxTransactionAmount(address) view returns (bool)",
    "function excludeFromMaxTransaction(address,bool)"
  ], TOKEN);
  
  // Check exclusions
  console.log("=== Checking Exclusions ===");
  const routerExcluded = await token.isExcludedFromFees(ROUTER);
  const pairExcluded = await token.isExcludedFromFees(PAIR);
  
  console.log("Router excluded from fees:", routerExcluded);
  console.log("Pair excluded from fees:", pairExcluded);
  
  // Check max transaction exclusions
  try {
    const routerMaxExcluded = await token._isExcludedMaxTransactionAmount(ROUTER);
    const pairMaxExcluded = await token._isExcludedMaxTransactionAmount(PAIR);
    
    console.log("\nRouter excluded from max tx:", routerMaxExcluded);
    console.log("Pair excluded from max tx:", pairMaxExcluded);
    
    // If not excluded from max tx, exclude them
    const owner = await token.owner();
    if (owner.toLowerCase() === signer.address.toLowerCase()) {
      if (!routerMaxExcluded) {
        console.log("\nExcluding router from max tx...");
        const tx1 = await token.excludeFromMaxTransaction(ROUTER, true);
        await tx1.wait();
        console.log("✅ Router excluded from max tx!");
      }
      
      if (!pairMaxExcluded) {
        console.log("\nExcluding pair from max tx...");
        const tx2 = await token.excludeFromMaxTransaction(PAIR, true);
        await tx2.wait();
        console.log("✅ Pair excluded from max tx!");
      }
    }
  } catch (e) {
    console.log("\nCouldn't check max transaction exclusions");
  }
  
  // Test direct transfer to pair
  console.log("\n=== Testing Direct Transfer ===");
  const decimals = await token.decimals();
  const testAmount = hre.ethers.utils.parseUnits("10", decimals);
  
  const balanceBefore = await token.balanceOf(PAIR);
  console.log("Pair balance before:", hre.ethers.utils.formatUnits(balanceBefore, decimals));
  
  console.log("Transferring 10 tokens to pair...");
  const tx = await token.transfer(PAIR, testAmount);
  const receipt = await tx.wait();
  console.log("Tx hash:", tx.hash);
  console.log("Gas used:", receipt.gasUsed.toString());
  
  const balanceAfter = await token.balanceOf(PAIR);
  console.log("Pair balance after:", hre.ethers.utils.formatUnits(balanceAfter, decimals));
  
  const received = balanceAfter.sub(balanceBefore);
  console.log("Tokens received:", hre.ethers.utils.formatUnits(received, decimals));
  console.log("Expected:", hre.ethers.utils.formatUnits(testAmount, decimals));
  
  if (received.eq(testAmount)) {
    console.log("✅ Full amount received - no tax applied!");
  } else {
    const taxAmount = testAmount.sub(received);
    const taxPercent = taxAmount.mul(100).div(testAmount);
    console.log("❌ Tax was applied:", taxPercent.toString() + "%");
  }
  
  // Check transaction in detail
  console.log("\n=== Checking Transaction Events ===");
  const transferEvents = receipt.logs.filter(log => {
    try {
      const parsed = token.interface.parseLog(log);
      return parsed.name === 'Transfer';
    } catch {
      return false;
    }
  });
  
  console.log("Transfer events found:", transferEvents.length);
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
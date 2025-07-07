// backend/scripts/debug-pair.js
const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  console.log("🔍 Debugging Pair Contract\n");
  
  const PAIR = "0xcB29e61e97c065c31DfFff0950624bc76f9A298D";
  const TOKEN = "0xC47f07f912ebF94a522f267cD833A8e0b1CF3d16";
  const WETH = "0x4200000000000000000000000000000000000006";
  const ROUTER = "0x836cfa3347C78Ff4E96044AbFa2AD2ca0BA29d65";
  
  // Get pair contract
  const pair = await hre.ethers.getContractAt([
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function getReserves() view returns (uint112,uint112,uint32)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function factory() view returns (address)"
  ], PAIR);
  
  // Get token info
  console.log("=== Pair Info ===");
  const token0 = await pair.token0();
  const token1 = await pair.token1();
  const reserves = await pair.getReserves();
  const totalSupply = await pair.totalSupply();
  
  console.log("Token0:", token0);
  console.log("Token1:", token1);
  console.log("Reserve0:", reserves[0].toString());
  console.log("Reserve1:", reserves[1].toString());
  console.log("Total Supply:", totalSupply.toString());
  
  // Check which token is which
  const isToken0 = token0.toLowerCase() === TOKEN.toLowerCase();
  console.log("\nToken mapping:");
  console.log(`${isToken0 ? 'TOKEN' : 'WETH'} is token0`);
  console.log(`${isToken0 ? 'WETH' : 'TOKEN'} is token1`);
  
  // Check current balances
  console.log("\n=== Current Balances ===");
  const tokenContract = await hre.ethers.getContractAt([
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ], TOKEN);
  
  const wethContract = await hre.ethers.getContractAt([
    "function balanceOf(address) view returns (uint256)"
  ], WETH);
  
  const tokenBalance = await tokenContract.balanceOf(PAIR);
  const wethBalance = await wethContract.balanceOf(PAIR);
  const decimals = await tokenContract.decimals();
  
  console.log("Token balance in pair:", hre.ethers.utils.formatUnits(tokenBalance, decimals));
  console.log("WETH balance in pair:", hre.ethers.utils.formatEther(wethBalance));
  
  // Check if there's a mismatch
  const expectedTokenReserve = isToken0 ? reserves[0] : reserves[1];
  const expectedWethReserve = isToken0 ? reserves[1] : reserves[0];
  
  console.log("\n=== Balance Check ===");
  console.log("Token balance matches reserve:", tokenBalance.eq(expectedTokenReserve));
  console.log("WETH balance matches reserve:", wethBalance.eq(expectedWethReserve));
  
  if (!tokenBalance.eq(expectedTokenReserve)) {
    console.log("❌ Token balance mismatch!");
    console.log("Difference:", tokenBalance.sub(expectedTokenReserve).toString());
  }
  
  // Check if router is excluded from fees in token
  console.log("\n=== Fee Exclusion Check ===");
  const token = await hre.ethers.getContractAt([
    "function isExcludedFromFees(address) view returns (bool)"
  ], TOKEN);
  
  const routerExcluded = await token.isExcludedFromFees(ROUTER);
  const pairExcluded = await token.isExcludedFromFees(PAIR);
  
  console.log("Router excluded from fees:", routerExcluded);
  console.log("Pair excluded from fees:", pairExcluded);
  
  if (!pairExcluded) {
    console.log("\n❌ PAIR NOT EXCLUDED FROM FEES!");
    console.log("This is likely the issue. The pair needs to be excluded from token fees.");
    
    // Check if we're the owner
    const tokenWithOwner = await hre.ethers.getContractAt([
      "function owner() view returns (address)",
      "function excludeFromFees(address,bool)"
    ], TOKEN);
    
    const owner = await tokenWithOwner.owner();
    if (owner.toLowerCase() === signer.address.toLowerCase()) {
      console.log("\n🔧 Fixing: Excluding pair from fees...");
      const tx = await tokenWithOwner.excludeFromFees(PAIR, true);
      console.log("Tx:", tx.hash);
      await tx.wait();
      console.log("✅ Pair excluded from fees!");
    } else {
      console.log("\n⚠️  You need to exclude the pair from fees:");
      console.log(`Call excludeFromFees("${PAIR}", true) on the token contract`);
    }
  }
  
  // Try to simulate adding liquidity
  console.log("\n=== Simulating Liquidity Addition ===");
  console.log("This would add 100 TOKEN + 0.001 ETH to the existing pool");
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
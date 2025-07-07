// backend/scripts/final-liquidity-test.js
const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  console.log("🔍 Final Liquidity Test\n");
  
  const ROUTER = "0x836cfa3347C78Ff4E96044AbFa2AD2ca0BA29d65";
  const TOKEN = "0xC47f07f912ebF94a522f267cD833A8e0b1CF3d16";
  const WETH = "0x4200000000000000000000000000000000000006";
  const PAIR = "0xcB29e61e97c065c31DfFff0950624bc76f9A298D";
  const FACTORY = "0x8E9f8751f1419b7D04DF68065bb8C5f0d870475E";
  
  // Get library address to check computation
  const DealixLibrary = await hre.ethers.getContractFactory("DealixLibrary");
  
  // Check if the router can compute the correct pair address
  console.log("=== Verifying Pair Address Calculation ===");
  console.log("Actual pair address:", PAIR);
  
  // Try to compute pair address using library
  const token0 = TOKEN.toLowerCase() < WETH.toLowerCase() ? TOKEN : WETH;
  const token1 = TOKEN.toLowerCase() < WETH.toLowerCase() ? WETH : TOKEN;
  console.log("Token0:", token0);
  console.log("Token1:", token1);
  
  // Get router and check its view of things
  const router = await hre.ethers.getContractAt("IDealixRouter02", ROUTER);
  
  // Try the actual addLiquidityETH call but with callStatic to see what happens
  console.log("\n=== Testing Router Call (Static) ===");
  
  const token = await hre.ethers.getContractAt([
    "function approve(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ], TOKEN);
  
  // Ensure approval
  await token.approve(ROUTER, hre.ethers.constants.MaxUint256);
  
  const tokenAmount = hre.ethers.utils.parseEther("100");
  const ethAmount = hre.ethers.utils.parseEther("0.001");
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  
  try {
    // Try static call to see return values
    const result = await router.callStatic.addLiquidityETH(
      TOKEN,
      tokenAmount,
      0, // Accept any amount
      0, // Accept any amount
      signer.address,
      deadline,
      { value: ethAmount }
    );
    
    console.log("Static call successful!");
    console.log("Would receive:");
    console.log("- Token amount:", hre.ethers.utils.formatEther(result[0]));
    console.log("- ETH amount:", hre.ethers.utils.formatEther(result[1]));
    console.log("- Liquidity:", hre.ethers.utils.formatEther(result[2]));
    
    // If static call works, try the real thing
    console.log("\n=== Executing Real Transaction ===");
    const tx = await router.addLiquidityETH(
      TOKEN,
      tokenAmount,
      0,
      0,
      signer.address,
      deadline,
      { value: ethAmount, gasLimit: 500000 }
    );
    
    console.log("Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Success! Gas used:", receipt.gasUsed.toString());
    
  } catch (error) {
    console.log("❌ Error:", error.reason || error.message);
    
    // Try to decode the error
    if (error.data) {
      console.log("\nError data:", error.data);
      
      // Common router errors
      const errorSignatures = {
        "0x08c379a0": "Error(string)",
        "0xfb8f41b2": "InsufficientAmount()",
        "0x03eb8b54": "InsufficientLiquidity()",
        "0x8129fc1c": "Expired()"
      };
      
      const sig = error.data.slice(0, 10);
      if (errorSignatures[sig]) {
        console.log("Error type:", errorSignatures[sig]);
      }
    }
    
    // Last resort: check if we need to initialize the pair differently
    console.log("\n=== Checking Pair State ===");
    const pair = await hre.ethers.getContractAt([
      "function getReserves() view returns (uint112,uint112,uint32)",
      "function totalSupply() view returns (uint256)",
      "function factory() view returns (address)",
      "function token0() view returns (address)",
      "function token1() view returns (address)"
    ], PAIR);
    
    const pairFactory = await pair.factory();
    const pairToken0 = await pair.token0();
    const pairToken1 = await pair.token1();
    
    console.log("Pair's factory:", pairFactory);
    console.log("Expected factory:", FACTORY);
    console.log("Factory matches:", pairFactory.toLowerCase() === FACTORY.toLowerCase());
    
    console.log("\nPair's token0:", pairToken0);
    console.log("Pair's token1:", pairToken1);
    
    // One more test: try to call pair functions directly
    const reserves = await pair.getReserves();
    console.log("\nCurrent reserves:", reserves[0].toString(), reserves[1].toString());
    
    if (reserves[0].eq(0) && reserves[1].eq(0)) {
      console.log("\n💡 This is the first liquidity addition to this pair.");
      console.log("The router should handle this, but there might be an issue with:");
      console.log("1. Gas estimation");
      console.log("2. Router implementation");
      console.log("3. Base network specific issue");
      
      console.log("\n🔧 Workaround: Try adding liquidity through the Base DEX UI or");
      console.log("use the manual approach from the previous script.");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
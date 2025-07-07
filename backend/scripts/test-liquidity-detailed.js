// backend/scripts/test-liquidity-detailed.js
const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  console.log("🔍 Detailed Liquidity Test\n");
  
  const ROUTER = "0x836cfa3347C78Ff4E96044AbFa2AD2ca0BA29d65";
  const TOKEN = "0xC47f07f912ebF94a522f267cD833A8e0b1CF3d16";
  const WETH = "0x4200000000000000000000000000000000000006";
  const PAIR = "0xcB29e61e97c065c31DfFff0950624bc76f9A298D";
  
  // Get contracts
  const router = await hre.ethers.getContractAt("IDealixRouter02", ROUTER);
  
  const token = await hre.ethers.getContractAt([
    "function transfer(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)"
  ], TOKEN);
  
  const weth = await hre.ethers.getContractAt([
    "function deposit() payable",
    "function transfer(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ], WETH);
  
  const pair = await hre.ethers.getContractAt([
    "function getReserves() view returns (uint112,uint112,uint32)",
    "function totalSupply() view returns (uint256)",
    "function MINIMUM_LIQUIDITY() view returns (uint256)",
    "function mint(address) returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
  ], PAIR);
  
  // Test amounts
  const tokenAmount = hre.ethers.utils.parseEther("100");
  const ethAmount = hre.ethers.utils.parseEther("0.001");
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  
  console.log("=== Pre-Transaction State ===");
  const reserves = await pair.getReserves();
  console.log("Reserves before:", reserves[0].toString(), reserves[1].toString());
  console.log("Total supply before:", (await pair.totalSupply()).toString());
  
  // Check minimum liquidity
  const MINIMUM_LIQUIDITY = await pair.MINIMUM_LIQUIDITY();
  console.log("Minimum liquidity:", MINIMUM_LIQUIDITY.toString());
  
  // Since this is first liquidity, let's calculate expected LP tokens
  const expectedLiquidity = hre.ethers.BigNumber.from(tokenAmount).mul(ethAmount).div(hre.ethers.BigNumber.from(10).pow(18));
  const sqrtLiquidity = sqrt(expectedLiquidity);
  console.log("Expected liquidity (approx):", sqrtLiquidity.toString());
  
  // Try different approaches
  console.log("\n=== Testing Liquidity Addition ===");
  
  // Approach 1: Try with exact amounts (no slippage)
  try {
    console.log("\n1. Trying with 0 slippage...");
    const tx = await router.addLiquidityETH(
      TOKEN,
      tokenAmount,
      tokenAmount, // Expect exact amount
      ethAmount,   // Expect exact amount
      signer.address,
      deadline,
      { value: ethAmount, gasLimit: 500000 }
    );
    console.log("✅ Success! Tx:", tx.hash);
    await tx.wait();
    return;
  } catch (e) {
    console.log("❌ Failed with exact amounts:", e.reason || "Unknown error");
  }
  
  // Approach 2: Try with high slippage
  try {
    console.log("\n2. Trying with 50% slippage...");
    const tx = await router.addLiquidityETH(
      TOKEN,
      tokenAmount,
      tokenAmount.div(2), // 50% slippage
      ethAmount.div(2),   // 50% slippage
      signer.address,
      deadline,
      { value: ethAmount, gasLimit: 500000 }
    );
    console.log("✅ Success! Tx:", tx.hash);
    await tx.wait();
    return;
  } catch (e) {
    console.log("❌ Failed with slippage:", e.reason || "Unknown error");
  }
  
  // Approach 3: Try sending tokens manually first
  try {
    console.log("\n3. Trying manual approach...");
    
    // Send tokens to pair
    console.log("Sending tokens to pair...");
    const tokenTx = await token.transfer(PAIR, tokenAmount);
    await tokenTx.wait();
    
    // Wrap and send ETH
    console.log("Wrapping and sending ETH...");
    const wethTx = await weth.deposit({ value: ethAmount });
    await wethTx.wait();
    
    const wethTransferTx = await weth.transfer(PAIR, ethAmount);
    await wethTransferTx.wait();
    
    // Check balances
    const tokenBalance = await token.balanceOf(PAIR);
    const wethBalance = await weth.balanceOf(PAIR);
    console.log("Token in pair:", hre.ethers.utils.formatEther(tokenBalance));
    console.log("WETH in pair:", hre.ethers.utils.formatEther(wethBalance));
    
    // Call mint
    console.log("Calling mint...");
    const mintTx = await pair.mint(signer.address);
    await mintTx.wait();
    
    console.log("✅ Manual liquidity addition successful!");
    
    // Check results
    const lpBalance = await pair.balanceOf(signer.address);
    console.log("LP tokens received:", hre.ethers.utils.formatEther(lpBalance));
    
  } catch (e) {
    console.log("❌ Manual approach failed:", e.reason || e.message);
  }
}

// Helper function for square root
function sqrt(value) {
  const ONE = hre.ethers.BigNumber.from(1);
  const TWO = hre.ethers.BigNumber.from(2);
  
  let x = value;
  let y = x.add(ONE).div(TWO);
  
  while (y.lt(x)) {
    x = y;
    y = x.add(value.div(x)).div(TWO);
  }
  
  return x;
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
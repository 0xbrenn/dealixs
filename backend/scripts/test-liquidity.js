// backend/scripts/test-liquidity-simple.js
const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("🧪 Simple Liquidity Test for Dealix DEX\n");
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("📍 Testing with account:", signer.address);
  
  // Contract addresses
  const ROUTER_ADDRESS = "0x836cfa3347C78Ff4E96044AbFa2AD2ca0BA29d65";
  const FACTORY_ADDRESS = "0x8E9f8751f1419b7D04DF68065bb8C5f0d870475E";
  const WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
  
  // Choose your token here
  // const TOKEN_ADDRESS = "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA"; // USDbC
  const TOKEN_ADDRESS = "0xC47f07f912ebF94a522f267cD833A8e0b1CF3d16"; // Your Testing123 token (CORRECT ADDRESS)
  
  console.log("Testing with token:", TOKEN_ADDRESS);
  
  // Basic ERC20 ABI
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
    "function allowance(address,address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)"
  ];
  
  // Router ABI (minimal)
  const ROUTER_ABI = [
    "function addLiquidityETH(address,uint256,uint256,uint256,address,uint256) payable returns (uint256,uint256,uint256)",
    "function factory() view returns (address)",
    "function WETH() view returns (address)"
  ];
  
  try {
    // Check if contract exists
    const code = await ethers.provider.getCode(TOKEN_ADDRESS);
    if (code === "0x") {
      console.log("❌ No contract at this address!");
      return;
    }
    
    // Get contracts
    const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);
    const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
    
    // Get token info
    console.log("\n=== Token Information ===");
    const [symbol, decimals, balance] = await Promise.all([
      token.symbol().catch(() => "???"),
      token.decimals().catch(() => 18),
      token.balanceOf(signer.address).catch(() => ethers.BigNumber.from(0))
    ]);
    
    console.log(`Token: ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Your balance: ${ethers.utils.formatUnits(balance, decimals)} ${symbol}`);
    
    if (balance.eq(0)) {
      console.log("❌ You have no tokens! Get some first.");
      return;
    }
    
    // Check ETH balance
    const ethBalance = await signer.getBalance();
    console.log(`Your ETH balance: ${ethers.utils.formatEther(ethBalance)} ETH`);
    
    // Check allowance
    console.log("\n=== Checking Approval ===");
    const allowance = await token.allowance(signer.address, ROUTER_ADDRESS);
    console.log(`Current allowance: ${ethers.utils.formatUnits(allowance, decimals)} ${symbol}`);
    
    // Amounts for testing
    const tokenAmount = ethers.utils.parseUnits("100", decimals); // 100 tokens
    const ethAmount = ethers.utils.parseEther("0.001"); // 0.001 ETH
    
    // Approve if needed
    if (allowance.lt(tokenAmount)) {
      console.log("📝 Approving router...");
      const approveTx = await token.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256);
      console.log("Approve tx:", approveTx.hash);
      await approveTx.wait();
      console.log("✅ Approved!");
    }
    
    // Try to add liquidity
    console.log("\n=== Testing Add Liquidity ===");
    console.log(`Adding: ${ethers.utils.formatUnits(tokenAmount, decimals)} ${symbol} + ${ethers.utils.formatEther(ethAmount)} ETH`);
    
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    
    // First try gas estimation
    try {
      const gasEstimate = await router.estimateGas.addLiquidityETH(
        TOKEN_ADDRESS,
        tokenAmount,
        0, // Accept any amount
        0, // Accept any amount
        signer.address,
        deadline,
        { value: ethAmount }
      );
      
      console.log("✅ Gas estimate successful:", gasEstimate.toString());
      
      // Now try the actual transaction
      console.log("\n💸 Sending transaction...");
      const tx = await router.addLiquidityETH(
        TOKEN_ADDRESS,
        tokenAmount,
        0,
        0,
        signer.address,
        deadline,
        { 
          value: ethAmount,
          gasLimit: gasEstimate.mul(120).div(100)
        }
      );
      
      console.log("📤 Tx sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("✅ Success! Gas used:", receipt.gasUsed.toString());
      
    } catch (error) {
      console.error("\n❌ Failed!");
      console.error("Error:", error.reason || error.message);
      
      // Common errors
      if (error.message.includes("INSUFFICIENT")) {
        console.log("\n💡 Hint: This token might have transfer fees. The owner needs to exclude the router from fees.");
        console.log(`   Router address: ${ROUTER_ADDRESS}`);
      }
    }
    
  } catch (error) {
    console.error("Script error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
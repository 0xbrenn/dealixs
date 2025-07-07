// backend/scripts/add-first-liquidity.js
const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  console.log("💧 Adding First Liquidity Manually\n");
  
  const TOKEN = "0xC47f07f912ebF94a522f267cD833A8e0b1CF3d16";
  const WETH = "0x4200000000000000000000000000000000000006";
  const PAIR = "0xcB29e61e97c065c31DfFff0950624bc76f9A298D";
  
  // Amounts
  const tokenAmount = hre.ethers.utils.parseEther("10000"); // 10,000 tokens
  const ethAmount = hre.ethers.utils.parseEther("0.005");     // 0.1 ETH
  
  console.log("Adding liquidity:");
  console.log("- Token amount:", hre.ethers.utils.formatEther(tokenAmount));
  console.log("- ETH amount:", hre.ethers.utils.formatEther(ethAmount));
  
  // Get contracts
  const token = await hre.ethers.getContractAt([
    "function transfer(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)"
  ], TOKEN);
  
  const weth = await hre.ethers.getContractAt([
    "function deposit() payable",
    "function transfer(address,uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ], WETH);
  
  const pair = await hre.ethers.getContractAt([
    "function mint(address) returns (uint256)",
    "function getReserves() view returns (uint112,uint112,uint32)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function sync()"
  ], PAIR);
  
  try {
    // Step 1: Check initial state
    console.log("\n=== Initial State ===");
    const reserves = await pair.getReserves();
    console.log("Reserves:", reserves[0].toString(), reserves[1].toString());
    
    // Step 2: Transfer tokens to pair
    console.log("\n=== Transferring Tokens ===");
    console.log("Sending tokens to pair...");
    const tokenTx = await token.transfer(PAIR, tokenAmount);
    await tokenTx.wait();
    console.log("✅ Tokens sent");
    
    // Step 3: Wrap ETH and send to pair
    console.log("\nWrapping ETH...");
    const wethTx = await weth.deposit({ value: ethAmount });
    await wethTx.wait();
    console.log("✅ ETH wrapped");
    
    console.log("\nSending WETH to pair...");
    const wethTransferTx = await weth.transfer(PAIR, ethAmount);
    await wethTransferTx.wait();
    console.log("✅ WETH sent");
    
    // Step 4: Check balances
    console.log("\n=== Checking Balances ===");
    const tokenBalance = await token.balanceOf(PAIR);
    const wethBalance = await weth.balanceOf(PAIR);
    console.log("Token in pair:", hre.ethers.utils.formatEther(tokenBalance));
    console.log("WETH in pair:", hre.ethers.utils.formatEther(wethBalance));
    
    // Step 5: Call sync to update reserves
    console.log("\n=== Syncing Pair ===");
    const syncTx = await pair.sync();
    await syncTx.wait();
    console.log("✅ Pair synced");
    
    // Step 6: Mint LP tokens
    console.log("\n=== Minting LP Tokens ===");
    const mintTx = await pair.mint(signer.address);
    const mintReceipt = await mintTx.wait();
    console.log("✅ LP tokens minted");
    console.log("Tx hash:", mintTx.hash);
    
    // Step 7: Check results
    console.log("\n=== Results ===");
    const lpBalance = await pair.balanceOf(signer.address);
    const totalSupply = await pair.totalSupply();
    const newReserves = await pair.getReserves();
    
    console.log("Your LP balance:", hre.ethers.utils.formatEther(lpBalance));
    console.log("Total LP supply:", hre.ethers.utils.formatEther(totalSupply));
    console.log("New reserves:", 
      hre.ethers.utils.formatEther(newReserves[0]), "WETH,",
      hre.ethers.utils.formatEther(newReserves[1]), "TOKEN"
    );
    
    console.log("\n🎉 First liquidity added successfully!");
    console.log("The router should work for future liquidity additions now.");
    
  } catch (error) {
    console.error("\n❌ Error:", error.reason || error.message);
    
    // If mint fails, try to recover funds
    if (error.message.includes("mint")) {
      console.log("\n🔧 Trying to recover funds...");
      const tokenBalance = await token.balanceOf(PAIR);
      const wethBalance = await weth.balanceOf(PAIR);
      
      if (tokenBalance.gt(0) || wethBalance.gt(0)) {
        console.log("Funds are in the pair. You may need to:");
        console.log("1. Call pair.sync() first");
        console.log("2. Then call pair.mint(your_address)");
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
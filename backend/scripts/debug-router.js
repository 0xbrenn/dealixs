// backend/scripts/debug-router.js
const hre = require("hardhat");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  
  console.log("🔍 Debugging Router Contract\n");
  
  const ROUTER = "0x836cfa3347C78Ff4E96044AbFa2AD2ca0BA29d65";
  const FACTORY = "0x8E9f8751f1419b7D04DF68065bb8C5f0d870475E";
  const WETH = "0x4200000000000000000000000000000000000006";
  
  // Check if contracts exist
  console.log("=== Checking Contracts ===");
  
  const routerCode = await hre.ethers.provider.getCode(ROUTER);
  const factoryCode = await hre.ethers.provider.getCode(FACTORY);
  
  console.log("Router has code:", routerCode !== "0x");
  console.log("Factory has code:", factoryCode !== "0x");
  
  if (routerCode === "0x" || factoryCode === "0x") {
    console.log("\n❌ DEX contracts not deployed properly!");
    return;
  }
  
  // Get router contract
  const router = await hre.ethers.getContractAt([
    "function factory() view returns (address)",
    "function WETH() view returns (address)"
  ], ROUTER);
  
  // Check router configuration
  console.log("\n=== Router Configuration ===");
  try {
    const routerFactory = await router.factory();
    const routerWETH = await router.WETH();
    
    console.log("Router's factory:", routerFactory);
    console.log("Expected factory:", FACTORY);
    console.log("Factory matches:", routerFactory.toLowerCase() === FACTORY.toLowerCase());
    
    console.log("\nRouter's WETH:", routerWETH);
    console.log("Expected WETH:", WETH);
    console.log("WETH matches:", routerWETH.toLowerCase() === WETH.toLowerCase());
    
    if (routerFactory.toLowerCase() !== FACTORY.toLowerCase()) {
      console.log("\n❌ Router is pointing to wrong factory!");
    }
    
    if (routerWETH.toLowerCase() !== WETH.toLowerCase()) {
      console.log("\n❌ Router is pointing to wrong WETH!");
    }
  } catch (e) {
    console.log("❌ Error reading router config:", e.message);
  }
  
  // Try a direct call to see the actual revert reason
  console.log("\n=== Testing Direct Call ===");
  
  const iface = new hre.ethers.utils.Interface([
    "function addLiquidityETH(address,uint256,uint256,uint256,address,uint256) payable returns (uint256,uint256,uint256)"
  ]);
  
  const TOKEN = "0xC47f07f912ebF94a522f267cD833A8e0b1CF3d16";
  const tokenAmount = hre.ethers.utils.parseEther("100");
  const ethAmount = hre.ethers.utils.parseEther("0.001");
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  
  const calldata = iface.encodeFunctionData("addLiquidityETH", [
    TOKEN,
    tokenAmount,
    0,
    0,
    signer.address,
    deadline
  ]);
  
  try {
    // Try static call first to get revert reason
    const result = await signer.call({
      to: ROUTER,
      data: calldata,
      value: ethAmount
    });
    console.log("Static call succeeded (unexpected)");
  } catch (e) {
    console.log("Revert reason:", e.reason || e.message);
    
    // Try to decode the error
    if (e.data && e.data !== "0x") {
      try {
        // Common error signatures
        const errors = [
          "0x08c379a0", // Error(string)
          "0x4e487b71", // Panic(uint256)
        ];
        
        if (e.data.startsWith("0x08c379a0")) {
          const reason = hre.ethers.utils.defaultAbiCoder.decode(["string"], "0x" + e.data.slice(10));
          console.log("Decoded error:", reason[0]);
        }
      } catch {}
    }
  }
  
  console.log("\n💡 Suggestions:");
  console.log("1. The router might be an old version");
  console.log("2. The factory might not be set up correctly");
  console.log("3. There might be an init code hash mismatch");
  console.log("\nTry redeploying the router with the correct factory and WETH addresses.");
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
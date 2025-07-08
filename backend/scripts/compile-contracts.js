const hre = require("hardhat");

async function main() {
  console.log("Compiling contracts...");
  
  await hre.run("compile");
  
  console.log("Compilation complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

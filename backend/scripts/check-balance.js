// scripts/check-balance.js
async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await deployer.getBalance();
  console.log('Address:', deployer.address);
  console.log('Balance:', ethers.utils.formatEther(balance), 'Dealix');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
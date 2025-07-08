# Dealix DEX Deployment Checklist

## Pre-Deployment
- [ ] Ensure all contracts are renamed from Uniswap to Dealix
- [ ] Update contract comments and documentation
- [ ] Set up .env with PRIVATE_KEY
- [ ] Have enough ETH on Base for deployment (~0.1-0.2 ETH)

## Deployment Steps

### 1. Clean up old files
```bash
node scripts/00-cleanup.js
```

### 2. Compile contracts
```bash
npx hardhat clean
npx hardhat compile
```

### 3. Deploy Factory
```bash
npx hardhat run scripts/01-deploy-dealix-factory.js --network base
```

### 4. Update init code hash
```bash
node scripts/update-dealix-init-hash.js
# Manually update the hash in DealixV2Library.sol
# Then recompile:
npx hardhat compile
```

### 5. Deploy Router
```bash
npx hardhat run scripts/02-deploy-dealix-router.js --network base
```

### 6. Update frontend
```bash
node scripts/update-frontend-constants.js
# Copy the output to your frontend constants file
```

### 7. Verify contracts (optional)
```bash
npx hardhat run scripts/verify-dealix-contracts.js --network base
```

## Post-Deployment
- [ ] Test a small swap transaction
- [ ] Test adding liquidity
- [ ] Test removing liquidity
- [ ] Update any documentation with new addresses
- [ ] Share deployment info with team

## Troubleshooting
- If deployment fails, check gas prices and ETH balance
- If init code hash update fails, ensure you're updating the correct file
- If verification fails, wait a few minutes and try again

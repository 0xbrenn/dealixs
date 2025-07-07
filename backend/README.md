# IOPN DEX Deployment Guide

This guide walks you through deploying the IOPN DEX smart contracts with a seamless 2-step process.

## 🚀 Quick Start

```bash
# 1. Setup
./setup.sh

# 2. Deploy
./deploy.sh
```

## 📋 Prerequisites

- Node.js (v14 or higher)
- Yarn package manager
- IOPN tokens for gas (if deploying to testnet)
- Private key with deployment funds

## 🛠️ Detailed Setup

### 1. Initial Setup

Run the setup script to initialize your environment:

```bash
chmod +x setup.sh
./setup.sh
```

This will:
- Check dependencies
- Install packages
- Create configuration files
- Compile contracts

### 2. Configuration

#### Required: Set your private key

Edit `.env`:
```env
PRIVATE_KEY=your_actual_private_key_here
```

#### Optional: Use existing contracts

Edit `.env.deployment` if you want to use existing contracts:
```env
# Leave empty to deploy new contracts
EXISTING_WETH_ADDRESS=0x123...
EXISTING_FACTORY_ADDRESS=
EXISTING_ROUTER_ADDRESS=

# Set to true to skip deploying existing contracts
SKIP_EXISTING_CONTRACTS=true
```

### 3. Deploy

Run the deployment script:

```bash
chmod +x deploy.sh
./deploy.sh
```

The script will:
1. Ask you to select a network (localhost or IOPN testnet)
2. Deploy all contracts except the library
3. Show you the init code hash
4. **Wait for you to manually update the library**
5. Deploy the library
6. Show final deployment summary

## 🔧 Manual Library Update

**This is the critical manual step:**

1. After Step 1 of deployment, you'll see:
   ```
   🔑 Init code hash: 0x39d28fea0815dad38a3f94e283dc35bfd7319f91d66ca84150b20c149f9bc55b
   ```

2. Open `contracts/libraries/IOPNLibrary.sol`

3. Find the `pairFor` function and update the hex value:
   ```solidity
   hex'39d28fea0815dad38a3f94e283dc35bfd7319f91d66ca84150b20c149f9bc55b' // <- Update this
   ```

4. Save the file

5. Continue with the deployment script

## 📁 File Structure

```
backend/
├── setup.sh                    # Setup script
├── deploy.sh                   # Main deployment script
├── deployment.config.js        # Deployment configuration
├── .env                       # Hardhat configuration
├── .env.deployment            # Deployment settings
├── scripts/
│   ├── 1-deploy-all-except-library.js
│   └── 2-deploy-library.js
└── deployments/               # Deployment outputs
    ├── {network}-contracts-deployment.json
    ├── {network}-complete-deployment.json
    └── .env.{network}
```

## 🌐 Network Configuration

### IOPN Testnet
- RPC URL: https://testnet-rpc.iopn.tech
- Chain ID: 984
- Explorer: https://testnet-explorer.iopn.tech
- Faucet: [Get test IOPN tokens]

### Local Development
- RPC URL: http://localhost:8545
- Chain ID: 31337
- The script will auto-start a Hardhat node if needed

## 🔍 Deployment Outputs

After successful deployment, you'll find:

1. **Contract Addresses** in `deployments/{network}-complete-deployment.json`
2. **Frontend Environment** in `deployments/.env.{network}`
3. **Init Code Hash** for reference

## 🚨 Common Issues

### "Init code hash mismatch"
- Make sure you copied the exact hash (without 0x prefix) to IOPNLibrary.sol
- Recompile after updating: `yarn compile`

### "Insufficient funds"
- For testnet: Get IOPN from the faucet
- For localhost: The script uses the default Hardhat account

### "Library deployment failed"
- Double-check the init code hash update
- Ensure you saved the IOPNLibrary.sol file
- Try recompiling: `yarn compile`

## 🎯 Post-Deployment

1. **Verify Contracts** (if on testnet):
   ```bash
   npx hardhat verify --network iopnTestnet CONTRACT_ADDRESS
   ```

2. **Add Liquidity**:
   - Use the Router contract to add liquidity pairs
   - Approve tokens first, then call `addLiquidity`

3. **Frontend Integration**:
   - Copy `deployments/.env.{network}` to your frontend
   - The deployment script does this automatically if `../frontend` exists

## 📝 Advanced Usage

### Custom Configuration

Edit `deployment.config.js` for advanced settings:
```javascript
OPTIONS: {
  gasPrice: "20000000000", // Custom gas price
  confirmDeployment: false, // Skip confirmations
  verifyContracts: true     // Auto-verify on explorer
}
```

### Manual Deployment

If you prefer manual control:
```bash
# Step 1: Deploy contracts
npx hardhat run scripts/1-deploy-all-except-library.js --network iopnTestnet

# Update library manually

# Step 2: Deploy library
npx hardhat run scripts/2-deploy-library.js --network iopnTestnet
```

## ✅ Success Checklist

- [ ] Private key configured in `.env`
- [ ] Deployment script executed
- [ ] Init code hash updated in library
- [ ] Library deployed successfully
- [ ] Contract addresses saved
- [ ] Frontend env updated

## 🆘 Support

If you encounter issues:
1. Check the deployment logs in `deployments/`
2. Ensure all prerequisites are met
3. Try clearing cache: `yarn hardhat clean`
4. Redeploy from scratch if needed

---

Happy deploying! 🚀
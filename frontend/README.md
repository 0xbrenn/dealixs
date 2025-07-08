OPNswap - Decentralized Exchange on IOPN Network
<div align="center">
  <img src="https://i.ibb.co/dN1sMhw/logo.jpg" alt="OPNswap Logo" width="200"/>

A modern, secure, and user-friendly decentralized exchange built on the IOPN Network
Website | Documentation | Smart Contracts
</div>

🌟 Features

🔄 Token Swaps: Instant token exchanges with optimal pricing
💧 Liquidity Pools: Provide liquidity and earn trading fees
🔐 Secure: Audited smart contracts with comprehensive testing
📱 Responsive: Beautiful UI that works on all devices
🌙 Modern Design: Sleek dark theme with glassmorphic elements
⚡ Fast: Optimized for the IOPN Network's high throughput
🎯 User-Friendly: Simple interface for both beginners and experts

📋 Table of Contents

Getting Started

Prerequisites
Installation


Deployment Guide

Smart Contract Deployment
Frontend Deployment


Architecture
Smart Contracts
Development
Testing
Security
Contributing
License

🚀 Getting Started
Prerequisites

Node.js v16+ and npm/yarn
Git
MetaMask or any Web3 wallet
IOPN tokens for deployment (testnet or mainnet)

Installation

Clone the repository
bashgit clone https://github.com/yourusername/opnswap.git
cd opnswap

Install dependencies
bash# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

Set up environment variables
bash# Backend (.env)
PRIVATE_KEY=your_wallet_private_key
IOPN_RPC_URL=https://testnet-rpc.iopn.tech
IOPN_CHAIN_ID=984

# Frontend (.env)
REACT_APP_CHAIN_ID=984
REACT_APP_WETH_ADDRESS=deployed_weth_address
REACT_APP_FACTORY_ADDRESS=deployed_factory_address
REACT_APP_ROUTER_ADDRESS=deployed_router_address


📦 Deployment Guide
Smart Contract Deployment

Configure the network
Update hardhat.config.js with IOPN network details:
javascriptmodule.exports = {
  networks: {
    iopnTestnet: {
      url: "https://testnet-rpc.iopn.tech",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 984
    }
  }
};

Update the init code hash
Before deployment, you need to get the correct init code hash:
bashcd backend
npx hardhat run scripts/get-init-hash.js
Update contracts/libraries/IOPNLibrary.sol with the hash output.
Deploy the contracts
bashcd backend
npx hardhat run scripts/fresh-deploy-iopn.js --network iopnTestnet
This will:

Deploy WIOPN (Wrapped IOPN)
Deploy Factory contract
Deploy Router contract
Deploy test tokens (iUSDC, iDAI, iLINK)
Create initial liquidity pools
Save deployment addresses and create .env files


Verify deployment
bashnpx hardhat run scripts/test-iopn-deployment.js --network iopnTestnet


Frontend Deployment

Update environment variables
Copy the generated .env.iopn-testnet to frontend/.env:
bashcp backend/.env.iopn-testnet frontend/.env

Build the frontend
bashcd frontend
npm run build

Deploy to Netlify (Recommended)
bash# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=build
Or use the Netlify dashboard:

Connect your GitHub repository
Set build command: npm run build
Set publish directory: build
Add environment variables from .env



🏗️ Architecture
Smart Contracts Architecture
┌─────────────────┐     ┌─────────────────┐
│   IOPNRouter02  │────▶│   IOPNFactory   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │                       ▼
         │              ┌─────────────────┐
         │              │    IOPNPair     │
         │              └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│      WIOPN      │     │   ERC20 Tokens  │
└─────────────────┘     └─────────────────┘
Frontend Architecture
src/
├── components/          # React components
│   ├── swap/           # Swap interface
│   ├── liquidity/      # Liquidity interface
│   └── common/         # Shared components
├── hooks/              # Custom React hooks
├── services/           # Business logic
├── constants/          # Contract addresses & ABIs
├── utils/              # Helper functions
└── types/              # TypeScript definitions
📜 Smart Contracts
Core Contracts

IOPNFactory (0xCb999...365a)

Creates and manages liquidity pairs
Stores pair addresses
Controls fee recipient


IOPNRouter02 (0x752c...079f)

Handles token swaps
Manages liquidity addition/removal
Calculates optimal trade routes


IOPNPair

Automated Market Maker (AMM) logic
Liquidity pool management
LP token minting/burning


WIOPN (0x6E69...58d8)

Wrapped IOPN token
Allows IOPN to be traded like ERC20



Contract Addresses (IOPN Testnet)
WIOPN (Wrapped OPN): 0x6E69F778c8647473A74450d5CDE6f82a79b958d8
Factory: 0xCb999f66F537f5a2a8558Cd15Bb3e1d6CCd2365a
Router: 0x752cbAB6C0412F094c79EdEB20EAF594e241079f
iUSDC: 0x1285048D561a57572F5da854F8DCe04452E70cA5
iDAI: 0x6CB027AccF2C8f5D47C1CE22b0d60ed0Fd9F30A4
💻 Development
Local Development

Start local blockchain
bashcd backend
npx hardhat node

Deploy contracts locally
bashnpx hardhat run scripts/fresh-deploy-iopn.js --network localhost

Start frontend
bashcd frontend
npm start


Project Structure
opnswap/
├── backend/
│   ├── contracts/      # Solidity smart contracts
│   ├── scripts/        # Deployment scripts
│   ├── test/          # Contract tests
│   └── hardhat.config.js
├── frontend/
│   ├── src/           # React application
│   ├── public/        # Static assets
│   └── package.json
└── README.md
🧪 Testing
Smart Contract Tests
bashcd backend
npm test
Test Specific Functionality
bash# Test swaps
npx hardhat run scripts/test-swap.js --network iopnTestnet

# Test liquidity
npx hardhat run scripts/test-liquidity.js --network iopnTestnet
Frontend Tests
bashcd frontend
npm test
🔒 Security
Security Features

✅ Reentrancy protection
✅ Integer overflow/underflow protection (Solidity 0.8+)
✅ Access control for admin functions
✅ Slippage protection
✅ Deadline validation
✅ Minimum liquidity enforcement

Best Practices

Never share your private keys
Always verify contract addresses
Use hardware wallets for mainnet
Test thoroughly on testnet first
Keep dependencies updated

Audit Status
⚠️ Note: These contracts are forked from Uniswap V2 and modified for IOPN. While Uniswap V2 has been audited, these modifications have not been independently audited. Use at your own risk.
🤝 Contributing
We welcome contributions! Please see our Contributing Guidelines for details.

Fork the repository
Create your feature branch (git checkout -b feature/AmazingFeature)
Commit your changes (git commit -m 'Add some AmazingFeature')
Push to the branch (git push origin feature/AmazingFeature)
Open a Pull Request

OPNswap Deployment Checklist
Pre-Deployment Checklist

 Node.js v16+ installed
 Git repository cloned
 Private key with IOPN tokens ready
 RPC endpoint verified (https://testnet-rpc.iopn.tech)

Backend Deployment Steps
1. Environment Setup
bashcd backend
Create .env file:
envPRIVATE_KEY=your_private_key_here
IOPN_RPC_URL=https://testnet-rpc.iopn.tech
IOPN_CHAIN_ID=984
2. Install Dependencies
bashnpm install
3. Get Init Code Hash
bashnpx hardhat compile
Create scripts/get-init-hash.js:
javascriptconst { ethers } = require("hardhat");

async function main() {
  const IOPNPair = await ethers.getContractFactory("IOPNPair");
  const initCodeHash = ethers.utils.keccak256(IOPNPair.bytecode);
  console.log("Init Code Hash:", initCodeHash);
}

main();
Run it:
bashnpx hardhat run scripts/get-init-hash.js
4. Update IOPNLibrary.sol

 Open contracts/libraries/IOPNLibrary.sol
 Find the pairFor function
 Replace the hex value with your init code hash

5. Deploy Contracts
bashnpx hardhat run scripts/fresh-deploy-iopn.js --network iopnTestnet
6. Verify Deployment
bashnpx hardhat run scripts/test-iopn-deployment.js --network iopnTestnet
Frontend Deployment Steps
1. Copy Environment File
bashcp backend/.env.iopn-testnet frontend/.env
2. Install Dependencies
bashcd frontend
npm install
3. Update Configuration

 Verify .env has all contract addresses
 Check src/config/appkit.ts has correct network config
 Update src/constants/tokens.ts with deployed token addresses

4. Build Frontend
bashnpm run build
5. Deploy to Netlify
Option A: CLI Deployment
bashnpm install -g netlify-cli
netlify login
netlify deploy --prod --dir=build
Option B: Git Integration

Push code to GitHub
Login to Netlify
Click "New site from Git"
Select your repository
Configure:

Build command: npm run build
Publish directory: build


Add environment variables in Netlify dashboard

Post-Deployment Checklist

 Test swap functionality
 Test liquidity addition
 Test liquidity removal
 Verify all token balances display correctly
 Check wallet connection/disconnection
 Test on mobile devices
 Verify block explorer links work

Troubleshooting
Common Issues

"Library hash mismatch" error

Re-run get-init-hash.js
Update IOPNLibrary.sol
Recompile and redeploy


"Insufficient funds" error

Ensure wallet has IOPN tokens
Check gas price settings


Frontend not connecting

Verify RPC URL is correct
Check chain ID matches (984)
Ensure wallet is on IOPN network


Transactions failing

Check contract addresses in .env
Verify contracts are deployed
Ensure sufficient gas limit



Maintenance Tasks
Weekly

 Check for dependency updates
 Monitor gas prices
 Review transaction logs

Monthly

 Update documentation
 Review security advisories
 Backup deployment files

Emergency Procedures
If contracts need redeployment:

Save current deployment file
Deploy new contracts
Update frontend .env
Rebuild and redeploy frontend
Notify users of new addresses


import { createAppKit } from "@reown/appkit/react";
import { Ethers5Adapter } from "@reown/appkit-adapter-ethers5";

// Define IOPN testnet as a custom network
const iopnTestnet = {
  id: 984,
  name: 'IOPN Testnet',
  nativeCurrency: {
    name: 'OPN',
    symbol: 'OPN',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.iopn.tech'] },
  },
  blockExplorers: {
    default: { 
      name: 'IOPN Explorer', 
      url: 'https://explorer.iopn.network' 
    },
  },


  contracts: {
    // Add your deployed contracts here
    router: {
      address: '0x752cbAB6C0412F094c79EdEB20EAF594e241079f',
    },
    factory: {
      address: '0xCb999f66F537f5a2a8558Cd15Bb3e1d6CCd2365a',
    },
    wOPN: {
      address: '0x6E69F778c8647473A74450d5CDE6f82a79b958d8',
    },
  },
  testnet: true,
};

// 1. Get projectId from Reown Cloud
const projectId = "1b447b084c1a2827ef90a0686320bb11";

// 2. Create metadata
const metadata = {
  name: "OPNswap",
  description: "Decentralized Exchange on IOPn Network",
  url: "https://opnswap.netlify.app/", // Replace with your actual domain
  icons: ["https://i.ibb.co/dN1sMhw/logo.jpg"], // Replace with your actual logo
};

// 3. Create the AppKit instance
createAppKit({
  adapters: [new Ethers5Adapter()],
  metadata: metadata,
  networks: [iopnTestnet],
  projectId,
 
  features: {
    analytics: true,
  },
  defaultNetwork: iopnTestnet, // Set IOPN as default network
});

// Export the contract addresses for easy access
export const CONTRACTS = {
  ROUTER: '0x752cbAB6C0412F094c79EdEB20EAF594e241079f',
  FACTORY: '0xCb999f66F537f5a2a8558Cd15Bb3e1d6CCd2365a',
  WETH: '0x6E69F778c8647473A74450d5CDE6f82a79b958d8',
  USDC: '0x1285048D561a57572F5da854F8DCe04452E70cA5',
  DAI: '0x6CB027AccF2C8f5D47C1CE22b0d60ed0Fd9F30A4',
};



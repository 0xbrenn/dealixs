// frontend/src/config/appkit.ts
import { createAppKit } from "@reown/appkit/react";
import { Ethers5Adapter } from "@reown/appkit-adapter-ethers5";

// Define Base network manually to avoid the type issue
const baseNetwork = {
  id: 8453,
  name: 'Base',
  network: 'base',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://mainnet.base.org'],
    },
    public: {
      http: ['https://mainnet.base.org'],
    },
  },
  blockExplorers: {
    default: { 
      name: 'Basescan', 
      url: 'https://basescan.org' 
    },
  },
  testnet: false,
};

// 1. Get projectId from Reown Cloud
const projectId = "1b447b084c1a2827ef90a0686320bb11";

// 2. Create metadata
const metadata = {
  name: "DealixDex",
  description: "Decentralized Exchange on Base Network",
  url: "https://dealixdex.com", // Update with your actual domain
  icons: ["https://dealixdex.com/logo.png"], // Update with your actual logo
};

// 3. Create the AppKit instance
createAppKit({
  adapters: [new Ethers5Adapter()],
  metadata: metadata,
  networks: [baseNetwork],
  projectId,
  features: {
    analytics: true,
  },
  defaultNetwork: baseNetwork,
});

// Export the contract addresses for easy access
export const CONTRACTS = {
  ROUTER: '0x836cfa3347C78Ff4E96044AbFa2AD2ca0BA29d65',
  FACTORY: '0x8E9f8751f1419b7D04DF68065bb8C5f0d870475E',
  WETH: '0x4200000000000000000000000000000000000006',
  DEALIX: '0x47d1BF702763813D2087CB5292045d65d907c803', // Add Dealix address
  LIBRARY: '0xa4dE8f0c005F1c629B02D7AC833d232D5F25BB83',
};
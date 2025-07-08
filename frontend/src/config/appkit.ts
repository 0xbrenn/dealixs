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
  // Core DEX Contracts
  ROUTER: '0x261Fa8cbE85d9B742c54bf105832BA0cAaf23aC9',
  FACTORY: '0x9134C411b4E231Ee93410a091B71aBf4cdcA2694',
  WETH: '0x4200000000000000000000000000000000000006',
  
  
  // Dealix Contracts
  DEALIX_DEX: '0x33d7F3120E2E74202c338EF1A3A510d98B67A5aC',
  LIQUIDITY_MANAGER: '0x6cDa4371868e1E94fd317F480b568C4121c3203A',
};
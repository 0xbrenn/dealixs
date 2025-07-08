// Token related types
export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: string;
  isCustom?: boolean;
}

// Liquidity related types
export interface LiquidityPosition {
  pair: string;
  token0: Token;
  token1: Token;
  balance: string;
  totalSupply: string;
  reserve0: string;
  reserve1: string;
  poolShare: string;
  token0Deposited: string;
  token1Deposited: string;
}

// Props types for components
export interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  currentToken: Token;
  formatBalance: (balance: string | undefined) => string;
  otherToken?: Token; // Added to prevent same token selection
}

export interface FarmPool {
  pid: number;
  lpToken: string;
  lpSymbol: string;
  token0: Token;
  token1: Token;
  allocPoint: number;
  depositFee: number;
  totalStaked: string;
  apr: number;
  rewardPerBlock: string;
  userStaked?: string;
  pendingReward?: string;
}

export interface StakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  pool: FarmPool;
  mode: 'stake' | 'unstake';
  onConfirm: (amount: string) => void;
}
export interface DealixProfile {
  dealixId: number;
  totalVolume: string;
  tier: number;
  badges: number;
  socialPoints: number;
  swaps: number;
  streak: number;
  liquidityProvided: string;
  affiliateEarnings: string;
}

export interface DiscountPool {
  id: number;
  creator: string;
  tokenA: string;
  tokenB: string;
  tokenASymbol?: string;  // Add this
  tokenBSymbol?: string;  // Add this
  discountPercentage: number;
  minTradeSize: string;
  expirationTime: number;
  isActive: boolean;
}
// Tab types
export type TabType = 'swap' | 'liquidity' | 'pools' | 'farm'| 'dealix';
export type LiquidityTabType = 'add' | 'remove';
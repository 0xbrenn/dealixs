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
// Tab types
export type TabType = 'swap' | 'liquidity' | 'pools' | 'farm';
export type LiquidityTabType = 'add' | 'remove';
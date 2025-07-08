// frontend/src/types/dealix.ts

export interface DealixProfile {
  dealixId: number;
  totalVolume: string;
  tier: number;
  badgeCount: number;
  liquidityProvided: string;
  discountsCreated: number;
  swapCount: number;
  socialPoints: number;
  streak: number;
}

export interface Badge {
  id: number;
  name: string;
  description: string;
  requirement: number;
  badgeType: BadgeType;
  imageURI: string;
  points: number;
  active: boolean;
  earned: boolean;
}

export enum BadgeType {
  SWAP_VOLUME,
  SWAP_COUNT,
  LIQUIDITY_PROVIDER,
  DISCOUNT_CREATOR,
  DISCOUNT_USER,
  EARLY_ADOPTER,
  REFERRER,
  STREAK,
  WHALE,
  AFFILIATE,
  COMMUNITY
}

export interface DiscountPool {
  id: number;
  creator: string;
  tokenA: string;
  tokenB: string;
  tokenASymbol?: string;
  tokenBSymbol?: string;
  reserveA: string;
  reserveB: string;
  discountPercentage: number;
  minTradeSize: string;
  maxDiscountPerTrade: string;
  totalVolumeGenerated: string;
  expirationTime: number;
  isActive: boolean;
  useTokenReserves: boolean;
  lpTokenAmount?: string;
  lpToken?: string;
}

export interface AffiliateDiscount {
  id: number;
  affiliate: string;
  project: string;
  token: string;
  tokenSymbol?: string;
  discountPercentage: number;
  affiliateCommission: number;
  fundedAmount: string;
  remainingAmount: string;
  volumeGenerated: string;
  expirationTime: number;
  isActive: boolean;
}

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOutMin: string;
}

export interface CreateAffiliateParams {
  project: string;
  token: string;
  discountPercentage: number;
  affiliateCommission: number;
  duration: number;
  maxUsagePerUser: number;
}

export interface LiquidityParams {
  tokenA: string;
  tokenB: string;
  amountADesired: string;
  amountBDesired: string;
  amountAMin: string;
  amountBMin: string;
  discountReserveA?: string;
  discountReserveB?: string;
  discountPercentage?: number;
  minTradeSize?: string;
  duration?: number;
}

export interface DealixContextType {
  // State
  hasDealixId: boolean;
  dealixProfile: DealixProfile | null;
  userBadges: Badge[];
  availableDiscounts: DiscountPool[];
  affiliateDiscounts: AffiliateDiscount[];
  selectedDiscounts: number[];
  selectedAffiliateDiscount: number | null;
  isLoading: boolean;
  mintingFee: string;
  
  // Core Functions
  createDealixId: (referrer?: string) => Promise<void>;
  loadDealixProfile: () => Promise<void>;
  
  // Discount Functions
  loadAvailableDiscounts: (tokenA?: string, tokenB?: string) => Promise<void>;
  loadAffiliateDiscounts: (token: string) => Promise<void>;
  selectDiscount: (discountId: number) => void;
  deselectDiscount: (discountId: number) => void;
  selectAffiliateDiscount: (discountId: number | null) => void;
  calculateTotalDiscount: (amount: string) => number;
  
  // Affiliate Functions
  createAffiliateDiscount: (params: CreateAffiliateParams) => Promise<any>;
  fundAffiliateDiscount: (discountId: number, amount: string) => Promise<void>;
  
  // Swap Function
  swapWithDealix: (params: SwapParams) => Promise<any>;
  
  // Utility Functions
  refreshData: () => Promise<void>;
}

// Additional types for transactions and events
export interface DealixTransaction {
  hash: string;
  timestamp: number;
  type: 'swap' | 'liquidity' | 'discount_created' | 'discount_used';
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: string;
  amountOut?: string;
  discount?: string;
}

export interface DealixStats {
  totalUsers: number;
  totalVolume: string;
  totalDiscounts: number;
  totalLiquidity: string;
  topTraders: DealixProfile[];
}

// Event types
export interface DealixEvent {
  event: string;
  args: any;
  blockNumber: number;
  transactionHash: string;
}

// Error types
export interface DealixError {
  code: string;
  message: string;
  details?: any;
}

// Token metadata
export interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

// Notification types
export interface DealixNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  txHash?: string;
}
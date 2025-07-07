// Export Token interface to match imports in other files
export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: string;
  isCustom?: boolean;
  hasTax?: boolean;  // Add this flag
}
export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  isCustom?: boolean;
}

export interface TokenWithBalance extends TokenInfo {
  balance?: string;
  allowance?: string;
}

export interface TokenPair {
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  pairAddress?: string;
}
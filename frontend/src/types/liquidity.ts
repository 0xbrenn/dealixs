import { Token } from './token';

export interface LiquidityPair {
  address: string;
  token0: Token;
  token1: Token;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
}

export interface UserLiquidityInfo {
  pair: LiquidityPair;
  balance: string;
  share: number;
  token0Deposited: string;
  token1Deposited: string;
}

export interface AddLiquidityParams {
  tokenA: Token;
  tokenB: Token;
  amountADesired: string;
  amountBDesired: string;
  amountAMin: string;
  amountBMin: string;
  deadline: number;
}

export interface RemoveLiquidityParams {
  tokenA: Token;
  tokenB: Token;
  liquidity: string;
  amountAMin: string;
  amountBMin: string;
  deadline: number;
}
import { ethers } from 'ethers';

// Calculate output amount for a swap
export const calculateSwapOutput = (
  amountIn: string,
  reserveIn: string,
  reserveOut: string,
  fee: number = 997 // 0.3% fee
): string => {
  const amountInWithFee = ethers.BigNumber.from(amountIn).mul(fee);
  const numerator = amountInWithFee.mul(reserveOut);
  const denominator = ethers.BigNumber.from(reserveIn).mul(1000).add(amountInWithFee);
  return numerator.div(denominator).toString();
};

// Calculate price impact
export const calculatePriceImpact = (
  amountIn: string,
  amountOut: string,
  reserveIn: string,
  reserveOut: string
): number => {
  const exactQuote = ethers.BigNumber.from(amountIn)
    .mul(reserveOut)
    .div(reserveIn);
  
  const priceImpact = exactQuote.sub(amountOut)
    .mul(10000)
    .div(exactQuote)
    .toNumber() / 100;
  
  return priceImpact;
};

// Calculate share of liquidity pool
export const calculatePoolShare = (
  userLiquidity: string,
  totalLiquidity: string
): number => {
  if (totalLiquidity === '0') return 0;
  
  const share = ethers.BigNumber.from(userLiquidity)
    .mul(10000)
    .div(totalLiquidity)
    .toNumber() / 100;
  
  return share;
};

// Helper function to calculate square root of BigNumber
const sqrt = (value: ethers.BigNumber): ethers.BigNumber => {
  const ONE = ethers.BigNumber.from(1);
  const TWO = ethers.BigNumber.from(2);
  
  let x = value;
  let y = x.add(ONE).div(TWO);
  
  while (y.lt(x)) {
    x = y;
    y = x.add(value.div(x)).div(TWO);
  }
  
  return x;
};

// Calculate liquidity tokens to mint
export const calculateLiquidityMinted = (
  amount0: string,
  amount1: string,
  reserve0: string,
  reserve1: string,
  totalSupply: string
): string => {
  if (totalSupply === '0') {
    // First liquidity provider
    const product = ethers.BigNumber.from(amount0).mul(amount1);
    return sqrt(product).toString();
  }
  
  // Subsequent liquidity providers
  const liquidity0 = ethers.BigNumber.from(amount0)
    .mul(totalSupply)
    .div(reserve0);
  
  const liquidity1 = ethers.BigNumber.from(amount1)
    .mul(totalSupply)
    .div(reserve1);
  
  // Return minimum to maintain ratio
  return liquidity0.lt(liquidity1) ? liquidity0.toString() : liquidity1.toString();
};

// Export empty object to make this a module
export {};
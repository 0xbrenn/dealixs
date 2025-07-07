import { ethers } from 'ethers';

export const priceService = {
  // Calculate price impact
  calculatePriceImpact: (
    inputAmount: string,
    outputAmount: string,
    inputReserve: string,
    outputReserve: string
  ): number => {
    const spotPrice = parseFloat(outputReserve) / parseFloat(inputReserve);
    const executionPrice = parseFloat(outputAmount) / parseFloat(inputAmount);
    const priceImpact = ((spotPrice - executionPrice) / spotPrice) * 100;
    return Math.abs(priceImpact);
  },

  // Calculate minimum amount out with slippage
  calculateMinimumAmountOut: (
    expectedAmount: string,
    slippagePercent: string,
    decimals: number
  ): string => {
    const slippage = parseFloat(slippagePercent) / 100;
    const minAmount = parseFloat(expectedAmount) * (1 - slippage);
    return ethers.utils.parseUnits(minAmount.toString(), decimals).toString();
  },

  // Format price for display
  formatPrice: (price: number): string => {
    if (price < 0.01) return price.toExponential(2);
    if (price < 1) return price.toFixed(4);
    if (price < 1000) return price.toFixed(2);
    return price.toLocaleString();
  }
};
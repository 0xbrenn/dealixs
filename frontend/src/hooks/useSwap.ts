// iopn-dex/frontend/src/hooks/useSwap.ts
import { useState, useCallback, useMemo } from 'react';
import { ethers } from 'ethers';
import { useAppKitProvider, useAppKitAccount } from "@reown/appkit/react";
import { Token } from '../types';
import { SwapHandler } from '../services/SwapHandler';

export const useSwap = () => {
  const { address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const [loading, setLoading] = useState(false);

  // Create SwapHandler instance when wallet is connected
  const swapHandler = useMemo(() => {
    if (!walletProvider) return null;
    return new SwapHandler(walletProvider);
  }, [walletProvider]);

  const calculateSwapOutput = useCallback(async (
    fromToken: Token,
    toToken: Token,
    amount: string
  ): Promise<string> => {
    if (!swapHandler || !amount || parseFloat(amount) === 0) return '0';

    try {
      return await swapHandler.calculateSwapOutput(fromToken, toToken, amount);
    } catch (error) {
      console.error('Error calculating swap output:', error);
      return '0';
    }
  }, [swapHandler]);

  // In src/hooks/useSwap.ts, update the executeSwap function:

const executeSwap = useCallback(async (
  fromToken: Token,
  toToken: Token,
  fromAmount: string,
  toAmount: string,
  slippage: string,
  // Add these new parameters
  hasDealixId: boolean = false,
  selectedDiscounts: number[] = [],
  selectedAffiliateDiscount: number | null = null
) => {
  if (!swapHandler || !address) throw new Error('Wallet not connected');

  setLoading(true);
  try {
    const slippageTolerance = parseFloat(slippage);
    const receipt = await swapHandler.executeSwap(
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      address,
      slippageTolerance,
      // Pass the new parameters
      hasDealixId,
      selectedDiscounts,
      selectedAffiliateDiscount
    );
    
    return receipt;
  } catch (error) {
    console.error('Swap error:', error);
    throw error;
  } finally {
    setLoading(false);
  }
}, [address, swapHandler]);

  const estimateGas = useCallback(async (
    fromToken: Token,
    toToken: Token,
    amount: string
  ): Promise<ethers.BigNumber | null> => {
    if (!swapHandler || !address || !amount) return null;

    try {
      return await swapHandler.estimateSwapGas(fromToken, toToken, amount, address);
    } catch (error) {
      console.error('Gas estimation error:', error);
      return null;
    }
  }, [address, swapHandler]);

  return {
    calculateSwapOutput,
    executeSwap,
    estimateGas,
    loading
  };
};
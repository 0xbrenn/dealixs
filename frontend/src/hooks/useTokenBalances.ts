import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAppKitProvider, useAppKitAccount } from "@reown/appkit/react";
import { Token } from '../types';
import { DEFAULT_TOKENS } from '../constants/tokens';
import { ERC20_ABI } from '../constants/contracts';

export const useTokenBalances = () => {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const loadTokenBalances = useCallback(async () => {
    if (!address || !walletProvider) return;

    setLoading(true);
    try {
      const provider = new ethers.providers.Web3Provider(walletProvider as any);
      const balances: Record<string, string> = {};

      // Get ETH balance
      const ethBalance = await provider.getBalance(address);
      balances['0x0000000000000000000000000000000000000000'] = ethers.utils.formatEther(ethBalance);

      // Get custom tokens from localStorage
      const savedTokens = localStorage.getItem('customTokens');
      const customTokens: Token[] = savedTokens ? JSON.parse(savedTokens) : [];
      const allTokens = [...DEFAULT_TOKENS, ...customTokens];

      // Get ERC20 token balances
      for (const token of allTokens) {
        if (token.address !== '0x0000000000000000000000000000000000000000' && token.address) {
          try {
            const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
            const balance = await tokenContract.balanceOf(address);
            balances[token.address] = ethers.utils.formatUnits(balance, token.decimals);
          } catch (error) {
            console.error(`Error loading balance for ${token.symbol}:`, error);
            balances[token.address] = '0';
          }
        }
      }

      setTokenBalances(balances);
    } catch (error) {
      console.error('Error loading token balances:', error);
    } finally {
      setLoading(false);
    }
  }, [address, walletProvider]);

  useEffect(() => {
    if (isConnected) {
      loadTokenBalances();
    }
  }, [isConnected, loadTokenBalances]);

  return { tokenBalances, loadTokenBalances, loading };
};
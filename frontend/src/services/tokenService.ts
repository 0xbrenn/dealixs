import { ethers } from 'ethers';
import { Token } from '../types';
import { ERC20_ABI } from '../constants/contracts';

export const tokenService = {
  // Get token information
  getTokenInfo: async (
    tokenAddress: string,
    provider: ethers.providers.Provider
  ): Promise<Token> => {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    
    const [symbol, name, decimals] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.name(),
      tokenContract.decimals()
    ]);

    return {
      address: tokenAddress,
      symbol,
      name,
      decimals,
      isCustom: true
    };
  },

  // Get token balance
  getTokenBalance: async (
    tokenAddress: string,
    userAddress: string,
    provider: ethers.providers.Provider
  ): Promise<string> => {
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      const balance = await provider.getBalance(userAddress);
      return ethers.utils.formatEther(balance);
    }

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(userAddress);
    const decimals = await tokenContract.decimals();
    return ethers.utils.formatUnits(balance, decimals);
  },

  // Check if token exists
  isValidToken: async (
    tokenAddress: string,
    provider: ethers.providers.Provider
  ): Promise<boolean> => {
    try {
      const code = await provider.getCode(tokenAddress);
      if (code === '0x') return false;
      
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      await tokenContract.symbol();
      return true;
    } catch {
      return false;
    }
  }
};
import { ethers } from 'ethers';

// Format balance to specified decimal places
export const formatBalance = (balance: string | undefined, decimals: number = 4): string => {
  if (!balance) return '0.0000';
  const num = parseFloat(balance);
  if (isNaN(num)) return '0.0000';
  return num.toFixed(decimals);
};

// Format token amount with proper decimals
export const formatTokenAmount = (amount: string, decimals: number): string => {
  try {
    return ethers.utils.formatUnits(amount, decimals);
  } catch {
    return '0';
  }
};

// Parse token amount to wei
export const parseTokenAmount = (amount: string, decimals: number): string => {
  try {
    return ethers.utils.parseUnits(amount, decimals).toString();
  } catch {
    return '0';
  }
};

// Format percentage
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

// Truncate address for display
export const truncateAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
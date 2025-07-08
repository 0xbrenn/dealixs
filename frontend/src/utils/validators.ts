// Validate Ethereum address
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Validate positive number input
export const isValidAmount = (amount: string): boolean => {
  if (!amount || amount === '0') return false;
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
};

// Validate slippage percentage
export const isValidSlippage = (slippage: string): boolean => {
  const num = parseFloat(slippage);
  return !isNaN(num) && num >= 0 && num <= 50;
};

// Check if amount exceeds balance
export const exceedsBalance = (amount: string, balance: string): boolean => {
  if (!amount || !balance) return false;
  try {
    const amountNum = parseFloat(amount);
    const balanceNum = parseFloat(balance);
    return amountNum > balanceNum;
  } catch {
    return false;
  }
};
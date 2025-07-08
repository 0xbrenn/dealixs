import { ethers } from 'ethers';

export const contractService = {
  // Get contract instance
  getContract: (address: string, abi: any[], signerOrProvider: ethers.Signer | ethers.providers.Provider) => {
    return new ethers.Contract(address, abi, signerOrProvider);
  },

  // Approve token spending
  approveToken: async (
    tokenContract: ethers.Contract,
    spender: string,
    amount: string
  ): Promise<ethers.ContractTransaction> => {
    return await tokenContract.approve(spender, amount);
  },

  // Check allowance
  checkAllowance: async (
    tokenContract: ethers.Contract,
    owner: string,
    spender: string
  ): Promise<string> => {
    return await tokenContract.allowance(owner, spender);
  },

  // Wait for transaction
  waitForTransaction: async (
    tx: ethers.ContractTransaction,
    confirmations: number = 1
  ): Promise<ethers.ContractReceipt> => {
    return await tx.wait(confirmations);
  }
};
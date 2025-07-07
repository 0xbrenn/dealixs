import { useMemo } from 'react';
import { ethers } from 'ethers';
import { useAppKitProvider } from "@reown/appkit/react";

export const useContract = (address: string | undefined, abi: any[]) => {
  const { walletProvider } = useAppKitProvider("eip155");

  const contract = useMemo(() => {
    if (!address || !walletProvider || !abi) return null;
    
    try {
      const provider = new ethers.providers.Web3Provider(walletProvider as any);
      const signer = provider.getSigner();
      return new ethers.Contract(address, abi, signer);
    } catch (error) {
      console.error('Error creating contract:', error);
      return null;
    }
  }, [address, abi, walletProvider]);

  return contract;
};
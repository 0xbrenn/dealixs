// frontend/src/contexts/DealixContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import toast from 'react-hot-toast';
import { CONTRACTS } from '../config/appkit';
import { DEALIX_ABI } from '../constants/contracts';

// Dealix Types
export interface DealixProfile {
  dealixId: number;
  totalVolume: string;
  tier: number;
  badges: number;
  socialPoints: number;
  swaps: number;
  streak: number;
  liquidityProvided: string;
  affiliateEarnings: string;
}

export interface Badge {
  id: number;
  name: string;
  description: string;
  imageUri: string;
  owned: boolean;
}

export interface DiscountPool {
  id: number;
  creator: string;
  tokenA: string;
  tokenB: string;
  tokenASymbol?: string;
  tokenBSymbol?: string;
  discountPercentage: number;
  minTradeSize: string;
  expirationTime: number;
  isActive: boolean;
}

export interface AffiliateDiscount {
  id: number;
  affiliate: string;
  token: string;
  tokenSymbol?: string;
  discountPercentage: number;
  remainingAmount: string;
  expirationTime: number;
  isActive: boolean;
}

interface DealixContextType {
  // State
  hasDealixId: boolean;
  dealixProfile: DealixProfile | null;
  userBadges: Badge[];
  availableDiscounts: DiscountPool[];
  affiliateDiscounts: AffiliateDiscount[];
  selectedDiscounts: number[];
  selectedAffiliateDiscount: number | null;
  isLoading: boolean;
  mintingFee: string;
  
  // Actions
  createDealixId: (referrer?: string) => Promise<void>;
  loadDealixProfile: () => Promise<void>;
  loadAvailableDiscounts: (tokenA: string, tokenB: string) => Promise<void>;
  selectDiscount: (discountId: number) => void;
  deselectDiscount: (discountId: number) => void;
  selectAffiliateDiscount: (discountId: number | null) => void;
  calculateTotalDiscount: (amount: string) => number;
  refreshData: () => Promise<void>;
}

const DealixContext = createContext<DealixContextType | undefined>(undefined);

export const DealixProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  
  // State
  const [hasDealixId, setHasDealixId] = useState(false);
  const [dealixProfile, setDealixProfile] = useState<DealixProfile | null>(null);
  const [userBadges, setUserBadges] = useState<Badge[]>([]);
  const [availableDiscounts, setAvailableDiscounts] = useState<DiscountPool[]>([]);
  const [affiliateDiscounts, setAffiliateDiscounts] = useState<AffiliateDiscount[]>([]);
  const [selectedDiscounts, setSelectedDiscounts] = useState<number[]>([]);
  const [selectedAffiliateDiscount, setSelectedAffiliateDiscount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [mintingFee, setMintingFee] = useState('0.0005');
  
  // Get contract instance
  const getDealixContract = useCallback(() => {
    if (!walletProvider) return null;
    const provider = new ethers.providers.Web3Provider(walletProvider as any);
    const signer = provider.getSigner();
    return new ethers.Contract(CONTRACTS.DEALIX_DEX, DEALIX_ABI, signer);
  }, [walletProvider]);
  
  // Load user's Dealix ID
  const checkDealixId = useCallback(async () => {
    if (!address || !walletProvider) return;
    
    try {
      const contract = getDealixContract();
      if (!contract) return;
      
      const dealixId = await contract.userToDealixID(address);
      const hasId = dealixId.gt(0);
      setHasDealixId(hasId);
      
      if (hasId) {
        await loadDealixProfile();
      }
    } catch (error) {
      console.error('Error checking Dealix ID:', error);
    }
  }, [address, walletProvider, getDealixContract]);
  
  // Load minting fee
  const loadMintingFee = useCallback(async () => {
    try {
      const contract = getDealixContract();
      if (!contract) return;
      
      const fee = await contract.mintingFee();
      setMintingFee(ethers.utils.formatEther(fee));
    } catch (error) {
      console.error('Error loading minting fee:', error);
    }
  }, [getDealixContract]);
  
  // Create Dealix ID
  const createDealixId = useCallback(async (referrer: string = ethers.constants.AddressZero) => {
    if (!address || !walletProvider) {
      toast.error('Please connect your wallet');
      return;
    }
    
    setIsLoading(true);
    try {
      const contract = getDealixContract();
      if (!contract) throw new Error('Contract not initialized');
      
      const fee = await contract.mintingFee();
      const tx = await contract.createDealixID(referrer, { value: fee });
      
      toast.loading('Creating your Dealix ID...', { id: 'create-dealix' });
      const receipt = await tx.wait();
      
      toast.success('Dealix ID created successfully!', { id: 'create-dealix' });
      
      // Reload data
      await checkDealixId();
    } catch (error: any) {
      console.error('Error creating Dealix ID:', error);
      toast.error(error.message || 'Failed to create Dealix ID', { id: 'create-dealix' });
    } finally {
      setIsLoading(false);
    }
  }, [address, walletProvider, getDealixContract, checkDealixId]);
  
  // Load Dealix Profile
  const loadDealixProfile = useCallback(async () => {
    if (!address || !walletProvider) return;
    
    try {
      const contract = getDealixContract();
      if (!contract) return;
      
      const profile = await contract.getDealixProfile(address);
      
      setDealixProfile({
        dealixId: profile.dealixID.toNumber(),
        totalVolume: ethers.utils.formatEther(profile.totalVolume),
        tier: profile.discountTier.toNumber(),
        badges: profile.badgeCount.toNumber(),
        socialPoints: profile.socialPoints.toNumber(),
        swaps: profile.swapCount.toNumber(),
        streak: profile.activityStreak.toNumber(),
        liquidityProvided: ethers.utils.formatEther(profile.liquidityProvided),
        affiliateEarnings: '0' // This would come from affiliate earnings
      });
      
      // Load user badges separately
      await loadUserBadges(profile.dealixID.toNumber());
    } catch (error) {
      console.error('Error loading Dealix profile:', error);
    }
  }, [address, walletProvider, getDealixContract]);
  
  // Load user badges
  const loadUserBadges = useCallback(async (dealixId: number) => {
    try {
      const contract = getDealixContract();
      if (!contract) return;
      
      // For now, we'll create mock badges since the contract doesn't have getUserBadges
      // In production, you'd query badge ownership from the contract
      const mockBadges: Badge[] = [
        { id: 1, name: "Early Adopter", description: "One of the first users", imageUri: "", owned: dealixId <= 1000 },
        { id: 2, name: "Trader", description: "Complete 10 swaps", imageUri: "", owned: false },
        { id: 3, name: "Liquidity Provider", description: "Provide liquidity", imageUri: "", owned: false },
      ];
      
      setUserBadges(mockBadges);
    } catch (error) {
      console.error('Error loading user badges:', error);
    }
  }, [getDealixContract]);
  
  // Load available discounts
  // Replace the loadAvailableDiscounts function in your DealixContext.tsx with this:

  // Load available discounts
  const loadAvailableDiscounts = useCallback(async (tokenA: string, tokenB: string) => {
    if (!walletProvider) return;
    
    try {
      const contract = getDealixContract();
      if (!contract) return;
      
      // Define WETH address
      const WETH_ADDRESS = '0x4200000000000000000000000000000000000006';
      const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
      
      // Helper function to normalize ETH/WETH addresses
      const normalizeToken = (address: string) => {
        return address === ETH_ADDRESS ? WETH_ADDRESS : address;
      };
      
      // Normalize input tokens (convert ETH to WETH)
      const normalizedTokenA = normalizeToken(tokenA);
      const normalizedTokenB = normalizeToken(tokenB);
      
      console.log('Loading discounts for:', {
        originalTokenA: tokenA,
        originalTokenB: tokenB,
        normalizedTokenA,
        normalizedTokenB
      });
      
      // Instead of using getActiveDiscountPools, let's scan for pools directly
      // This is more reliable if the function doesn't exist
      const discounts: DiscountPool[] = [];
      const maxPoolId = 100; // Scan first 100 pools
      
      for (let poolId = 1; poolId <= maxPoolId; poolId++) {
        try {
          const poolData = await contract.discountPools(poolId);
          
          // Check if pool exists and is active
          if (poolData && poolData.isActive && poolData.expirationTime.gt(Math.floor(Date.now() / 1000))) {
            // Normalize pool tokens for comparison
            const poolTokenA = normalizeToken(poolData.tokenA);
            const poolTokenB = normalizeToken(poolData.tokenB);
            
            // Check if this pool matches our token pair (considering ETH/WETH equivalence)
            const matchesForward = 
              (poolTokenA.toLowerCase() === normalizedTokenA.toLowerCase() && 
               poolTokenB.toLowerCase() === normalizedTokenB.toLowerCase());
            
            const matchesReverse = 
              (poolTokenA.toLowerCase() === normalizedTokenB.toLowerCase() && 
               poolTokenB.toLowerCase() === normalizedTokenA.toLowerCase());
            
            if (matchesForward || matchesReverse) {
              console.log(`Found matching pool #${poolId}:`, {
                tokenA: poolData.tokenA,
                tokenB: poolData.tokenB,
                discount: poolData.discountPercentage.toNumber() / 100,
                active: poolData.isActive
              });
              
              discounts.push({
                id: poolId,
                creator: poolData.creator,
                tokenA: poolData.tokenA,
                tokenB: poolData.tokenB,
                discountPercentage: poolData.discountPercentage.toNumber(),
                minTradeSize: ethers.utils.formatEther(poolData.minTradeSize),
                expirationTime: poolData.expirationTime.toNumber(),
                isActive: poolData.isActive,
              });
            }
          }
        } catch (error) {
          // Pool doesn't exist, continue to next
          continue;
        }
      }
      
      console.log(`Found ${discounts.length} active discount pools`);
      setAvailableDiscounts(discounts);
    } catch (error) {
      console.error('Error loading available discounts:', error);
      setAvailableDiscounts([]); // Clear discounts on error
    }
  }, [walletProvider, getDealixContract]);
  
  // Select/deselect discount
const selectDiscount = useCallback((discountId: number) => {
  console.log('[DealixContext] Selecting discount:', discountId);
  setSelectedDiscounts(prev => {
    const newDiscounts = [...prev, discountId];
    console.log('[DealixContext] New selected discounts:', newDiscounts);
    return newDiscounts;
  });
}, []);
  
const deselectDiscount = useCallback((discountId: number) => {
  console.log('[DealixContext] Deselecting discount:', discountId);
  setSelectedDiscounts(prev => {
    const newDiscounts = prev.filter(id => id !== discountId);
    console.log('[DealixContext] New selected discounts:', newDiscounts);
    return newDiscounts;
  });
}, []);
  const selectAffiliateDiscount = useCallback((discountId: number | null) => {
    setSelectedAffiliateDiscount(discountId);
  }, []);
  
  // Calculate total discount
  const calculateTotalDiscount = useCallback((amount: string) => {
    if (!dealixProfile || !amount || parseFloat(amount) === 0) return 0;
    
    let totalPercentage = 0;
    
    // Base tier discount
    totalPercentage += dealixProfile.tier * 0.05;
    
    // Streak bonus (max 2%)
    totalPercentage += Math.min(dealixProfile.streak * 0.05, 2);
    
    // Pool discounts
    selectedDiscounts.forEach(discountId => {
      const discount = availableDiscounts.find(d => d.id === discountId);
      if (discount) {
        totalPercentage += discount.discountPercentage / 100;
      }
    });
    
    // Cap at 5%
    return Math.min(totalPercentage, 5);
  }, [dealixProfile, selectedDiscounts, availableDiscounts]);
  
  // Refresh all data
  const refreshData = useCallback(async () => {
    await checkDealixId();
    await loadMintingFee();
  }, [checkDealixId, loadMintingFee]);
  
  // Initial load
  useEffect(() => {
    if (isConnected && address) {
      refreshData();
    }
  }, [isConnected, address, refreshData]);
  
  const value: DealixContextType = {
    hasDealixId,
    dealixProfile,
    userBadges,
    availableDiscounts,
    affiliateDiscounts,
    selectedDiscounts,
    selectedAffiliateDiscount,
    isLoading,
    mintingFee,
    createDealixId,
    loadDealixProfile,
    loadAvailableDiscounts,
    selectDiscount,
    deselectDiscount,
    selectAffiliateDiscount,
    calculateTotalDiscount,
    refreshData
  };
  
  return (
    <DealixContext.Provider value={value}>
      {children}
    </DealixContext.Provider>
  );
};

export const useDealix = () => {
  const context = useContext(DealixContext);
  if (!context) {
    throw new Error('useDealix must be used within DealixProvider');
  }
  return context;
};
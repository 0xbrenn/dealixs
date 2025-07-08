// frontend/src/contexts/DealixContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import toast from 'react-hot-toast';
import { CONTRACTS } from '../config/appkit';
import { DEALIX_DEX_ABI } from '../constants/contracts';

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
  discountPercentage: number;
  minTradeSize: string;
  expirationTime: number;
  isActive: boolean;
}

export interface AffiliateDiscount {
  id: number;
  affiliate: string;
  token: string;
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
    return new ethers.Contract(CONTRACTS.DEALIX_DEX, DEALIX_DEX_ABI, signer);
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
      await checkDealixId();
    } catch (error: any) {
      console.error('Error creating Dealix ID:', error);
      toast.error(error.message || 'Failed to create Dealix ID', { id: 'create-dealix' });
    } finally {
      setIsLoading(false);
    }
  }, [address, walletProvider, getDealixContract, checkDealixId]);
  
  // Load Dealix profile
  const loadDealixProfile = useCallback(async () => {
    if (!address || !walletProvider) return;
    
    try {
      const contract = getDealixContract();
      if (!contract) return;
      
      const dealixId = await contract.userToDealixID(address);
      if (dealixId.eq(0)) return;
      
      const profileData = await contract.dealixIDs(dealixId);
      
      const profile: DealixProfile = {
        dealixId: dealixId.toNumber(),
        totalVolume: ethers.utils.formatEther(profileData.totalVolume),
        tier: profileData.discountTier.toNumber(),
        badges: profileData.badgeCount.toNumber(),
        socialPoints: profileData.socialPoints.toNumber(),
        swaps: profileData.swapCount.toNumber(),
        streak: profileData.activityStreak.toNumber(),
        liquidityProvided: ethers.utils.formatEther(profileData.liquidityProvided),
        affiliateEarnings: ethers.utils.formatEther(profileData.affiliateEarnings),
      };
      
      setDealixProfile(profile);
      
      // Load user badges
      await loadUserBadges(dealixId);
    } catch (error) {
      console.error('Error loading Dealix profile:', error);
    }
  }, [address, walletProvider, getDealixContract]);
  
  // Load user badges
  const loadUserBadges = useCallback(async (dealixId: ethers.BigNumber) => {
    try {
      const contract = getDealixContract();
      if (!contract) return;
      
      const badgeIds = await contract.getUserBadges(dealixId);
      const badges: Badge[] = [];
      
      for (const badgeId of badgeIds) {
        const badgeData = await contract.badges(badgeId);
        badges.push({
          id: badgeId.toNumber(),
          name: badgeData.name,
          description: badgeData.description,
          imageUri: badgeData.imageURI,
          owned: true,
        });
      }
      
      setUserBadges(badges);
    } catch (error) {
      console.error('Error loading user badges:', error);
    }
  }, [getDealixContract]);
  
  // Load available discounts
  const loadAvailableDiscounts = useCallback(async (tokenA: string, tokenB: string) => {
    if (!walletProvider) return;
    
    try {
      const contract = getDealixContract();
      if (!contract) return;
      
      const discountPoolIds = await contract.getActiveDiscountPools(tokenA, tokenB);
      const discounts: DiscountPool[] = [];
      
      for (const poolId of discountPoolIds) {
        const poolData = await contract.discountPools(poolId);
        
        if (poolData.isActive && poolData.expirationTime.gt(Math.floor(Date.now() / 1000))) {
          discounts.push({
            id: poolId.toNumber(),
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
      
      setAvailableDiscounts(discounts);
    } catch (error) {
      console.error('Error loading available discounts:', error);
    }
  }, [walletProvider, getDealixContract]);
  
  // Select/deselect discount
  const selectDiscount = useCallback((discountId: number) => {
    setSelectedDiscounts(prev => [...prev, discountId]);
  }, []);
  
  const deselectDiscount = useCallback((discountId: number) => {
    setSelectedDiscounts(prev => prev.filter(id => id !== discountId));
  }, []);
  
  const selectAffiliateDiscount = useCallback((discountId: number | null) => {
    setSelectedAffiliateDiscount(discountId);
  }, []);
  
  // Calculate total discount
  const calculateTotalDiscount = useCallback((amount: string) => {
    let totalDiscount = 0;
    
    // Add selected discount pool percentages
    for (const discountId of selectedDiscounts) {
      const discount = availableDiscounts.find(d => d.id === discountId);
      if (discount) {
        totalDiscount += discount.discountPercentage;
      }
    }
    
    // Add affiliate discount if selected
    if (selectedAffiliateDiscount) {
      const affiliateDiscount = affiliateDiscounts.find(d => d.id === selectedAffiliateDiscount);
      if (affiliateDiscount) {
        totalDiscount += affiliateDiscount.discountPercentage;
      }
    }
    
    // Add tier-based discount
    if (dealixProfile) {
      totalDiscount += dealixProfile.tier * 0.25; // 0.25% per tier
    }
    
    return Math.min(totalDiscount, 50); // Cap at 50%
  }, [selectedDiscounts, selectedAffiliateDiscount, availableDiscounts, affiliateDiscounts, dealixProfile]);
  
  // Refresh all data
  const refreshData = useCallback(async () => {
    await checkDealixId();
    await loadMintingFee();
  }, [checkDealixId, loadMintingFee]);
  
  // Effects
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
    refreshData,
  };
  
  return <DealixContext.Provider value={value}>{children}</DealixContext.Provider>;
};

export const useDealix = () => {
  const context = useContext(DealixContext);
  if (!context) {
    throw new Error('useDealix must be used within a DealixProvider');
  }
  return context;
};
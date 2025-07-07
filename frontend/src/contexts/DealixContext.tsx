import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import toast from 'react-hot-toast';

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

// Import your Dealix contract ABI here
const DEALIX_ABI = [
  "function userToDealixID(address) view returns (uint256)",
  "function getDealixProfile(address) view returns (uint256 dealixID, uint256 totalVolume, uint256 tier, uint256 badges, uint256 socialPoints, uint256 swaps, uint256 streak, uint256 liquidityProvided, uint256 affiliateEarnings)",
  "function getUserBadges(uint256) view returns (uint256[])",
  "function badges(uint256) view returns (string name, string description, uint256 requirement, uint8 badgeType, string imageURI, uint256 points, bool active)",
  "function getActiveDiscountPools(address, address) view returns (uint256[])",
  "function discountPools(uint256) view returns (uint256 id, address creator, address tokenA, address tokenB, uint256 discountPercentage, uint256 minTradeSize, uint256 maxDiscountPerTrade, uint256 totalVolumeGenerated, uint256 expirationTime, bool isActive)",
  "function getAffiliateDiscounts(address) view returns (uint256[])",
  "function affiliateDiscounts(uint256) view returns (address affiliate, address project, address token, uint256 discountPercentage, uint256 affiliateCommission, uint256 fundedAmount, uint256 remainingAmount, uint256 volumeGenerated, uint256 expirationTime, bool isActive)",
  "function createDealixID(address) payable",
  "function mintingFee() view returns (uint256)",
  "function nextBadgeID() view returns (uint256)"
];

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
  const [mintingFee, setMintingFee] = useState("0.05");
  const [dealixContract, setDealixContract] = useState<ethers.Contract | null>(null);

  // Initialize contract
  useEffect(() => {
    if (walletProvider && process.env.REACT_APP_DEALIX_ADDRESS) {
      const provider = new ethers.providers.Web3Provider(walletProvider);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(
        process.env.REACT_APP_DEALIX_ADDRESS,
        DEALIX_ABI,
        signer
      );
      setDealixContract(contract);
      
      // Load minting fee
      contract.mintingFee().then((fee: ethers.BigNumber) => {
        setMintingFee(ethers.utils.formatEther(fee));
      });
    }
  }, [walletProvider]);

  // Check if user has Dealix ID
  useEffect(() => {
    if (address && dealixContract) {
      checkDealixId();
    }
  }, [address, dealixContract]);

  const checkDealixId = async () => {
    if (!address || !dealixContract) return;
    
    try {
      const dealixId = await dealixContract.userToDealixID(address);
      setHasDealixId(dealixId.toNumber() > 0);
      
      if (dealixId.toNumber() > 0) {
        await loadDealixProfile();
      }
    } catch (error) {
      console.error("Error checking Dealix ID:", error);
    }
  };

  const createDealixId = async (referrer?: string) => {
    if (!dealixContract) {
      toast.error("Dealix contract not initialized");
      return;
    }

    setIsLoading(true);
    try {
      const fee = await dealixContract.mintingFee();
      const tx = await dealixContract.createDealixID(referrer || ethers.constants.AddressZero, {
        value: fee
      });
      
      toast.loading("Creating your Dealix ID...", { id: 'create-dealix' });
      await tx.wait();
      
      toast.success("Dealix ID created successfully! 🎉", { id: 'create-dealix' });
      await checkDealixId();
      await loadDealixProfile();
    } catch (error: any) {
      console.error("Error creating Dealix ID:", error);
      toast.error(error.message || "Failed to create Dealix ID", { id: 'create-dealix' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadDealixProfile = async () => {
    if (!address || !dealixContract) return;

    try {
      const profile = await dealixContract.getDealixProfile(address);
      
      setDealixProfile({
        dealixId: profile.dealixID.toNumber(),
        totalVolume: ethers.utils.formatEther(profile.totalVolume),
        tier: profile.tier.toNumber(),
        badges: profile.badges.toNumber(),
        socialPoints: profile.socialPoints.toNumber(),
        swaps: profile.swaps.toNumber(),
        streak: profile.streak.toNumber(),
        liquidityProvided: ethers.utils.formatEther(profile.liquidityProvided),
        affiliateEarnings: ethers.utils.formatEther(profile.affiliateEarnings)
      });

      // Load user badges
      if (profile.dealixID.toNumber() > 0) {
        await loadUserBadges(profile.dealixID.toNumber());
      }
    } catch (error) {
      console.error("Error loading Dealix profile:", error);
    }
  };

  const loadUserBadges = async (dealixId: number) => {
    if (!dealixContract) return;

    try {
      const ownedBadgeIds = await dealixContract.getUserBadges(dealixId);
      const totalBadges = await dealixContract.nextBadgeID();
      
      const badges: Badge[] = [];
      
      for (let i = 1; i < totalBadges.toNumber(); i++) {
        const badge = await dealixContract.badges(i);
        badges.push({
          id: i,
          name: badge.name,
          description: badge.description,
          imageUri: badge.imageURI,
          owned: ownedBadgeIds.some((id: ethers.BigNumber) => id.toNumber() === i)
        });
      }
      
      setUserBadges(badges);
    } catch (error) {
      console.error("Error loading badges:", error);
    }
  };

  const loadAvailableDiscounts = async (tokenA: string, tokenB: string) => {
    if (!dealixContract) return;

    try {
      // Load discount pools
      const poolIds = await dealixContract.getActiveDiscountPools(tokenA, tokenB);
      const pools: DiscountPool[] = [];
      
      for (const poolId of poolIds) {
        const pool = await dealixContract.discountPools(poolId);
        pools.push({
          id: poolId.toNumber(),
          creator: pool.creator,
          tokenA: pool.tokenA,
          tokenB: pool.tokenB,
          discountPercentage: pool.discountPercentage.toNumber(),
          minTradeSize: ethers.utils.formatEther(pool.minTradeSize),
          expirationTime: pool.expirationTime.toNumber(),
          isActive: pool.isActive
        });
      }
      
      setAvailableDiscounts(pools);
      
      // Load affiliate discounts for tokenB (the token being bought)
      const affiliateIds = await dealixContract.getAffiliateDiscounts(tokenB);
      const affiliates: AffiliateDiscount[] = [];
      
      for (const discountId of affiliateIds) {
        const discount = await dealixContract.affiliateDiscounts(discountId);
        affiliates.push({
          id: discountId.toNumber(),
          affiliate: discount.affiliate,
          token: discount.token,
          discountPercentage: discount.discountPercentage.toNumber(),
          remainingAmount: ethers.utils.formatEther(discount.remainingAmount),
          expirationTime: discount.expirationTime.toNumber(),
          isActive: discount.isActive
        });
      }
      
      setAffiliateDiscounts(affiliates);
    } catch (error) {
      console.error("Error loading discounts:", error);
    }
  };

  const selectDiscount = (discountId: number) => {
    setSelectedDiscounts(prev => [...prev, discountId]);
  };

  const deselectDiscount = (discountId: number) => {
    setSelectedDiscounts(prev => prev.filter(id => id !== discountId));
  };

  const selectAffiliateDiscount = (discountId: number | null) => {
    setSelectedAffiliateDiscount(discountId);
  };

  const calculateTotalDiscount = (amount: string) => {
    if (!hasDealixId || !dealixProfile) return 0;
    
    let totalPercentage = 0;
    
    // Add selected pool discounts
    selectedDiscounts.forEach(poolId => {
      const pool = availableDiscounts.find(p => p.id === poolId);
      if (pool && parseFloat(amount) >= parseFloat(pool.minTradeSize)) {
        totalPercentage += pool.discountPercentage / 100;
      }
    });
    
    // Add affiliate discount
    if (selectedAffiliateDiscount) {
      const affiliate = affiliateDiscounts.find(a => a.id === selectedAffiliateDiscount);
      if (affiliate) {
        totalPercentage += affiliate.discountPercentage / 100;
      }
    }
    
    // Add tier bonus (0.05% per tier)
    totalPercentage += dealixProfile.tier * 0.05;
    
    // Add streak bonus (0.05% per day)
    totalPercentage += Math.min(dealixProfile.streak * 0.05, 2); // Cap at 2%
    
    // Cap total discount at 50%
    return Math.min(totalPercentage, 50);
  };

  const refreshData = async () => {
    await Promise.all([
      checkDealixId(),
      loadDealixProfile()
    ]);
  };

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
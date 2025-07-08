import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaTag, FaClock, FaCoins, FaExchangeAlt } from 'react-icons/fa';
import { ethers } from 'ethers';
import { useAppKitProvider } from "@reown/appkit/react";
import { CONTRACTS } from '../../config/appkit';
import { Icon } from '../common/Icon';
import { formatBalance } from '../../utils/formatters';
import toast from 'react-hot-toast';

// Add the correct ABI for the functions we need
const DEALIX_ABI = [
  "function getActiveDiscountPools(address tokenA, address tokenB) view returns (uint256[])",
  "function discountPools(uint256) view returns (uint256 id, address creator, address tokenA, address tokenB, uint256 reserveA, uint256 reserveB, uint256 discountPercentage, uint256 minTradeSize, uint256 maxDiscountPerTrade, uint256 totalVolumeGenerated, uint256 expirationTime, bool isActive, bool useTokenReserves, uint256 lpTokenAmount, address lpToken)",
  "function userDiscountPools(address user, uint256 index) view returns (uint256)",
  "function getUserDiscountPoolCount(address user) view returns (uint256)"
];

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)"
];

interface DiscountPool {
  id: number;
  creator: string;
  tokenA: string;
  tokenB: string;
  tokenASymbol?: string;
  tokenBSymbol?: string;
  reserveA: string;
  reserveB: string;
  discountPercentage: number;
  minTradeSize: string;
  maxDiscountPerTrade: string;
  totalVolumeGenerated: string;
  expirationTime: number;
  isActive: boolean;
  useTokenReserves: boolean;
}

interface ActiveDiscountPoolsProps {
  userAddress?: string;
  filterByUser?: boolean;
}

export const ActiveDiscountPools: React.FC<ActiveDiscountPoolsProps> = ({ 
  userAddress, 
  filterByUser = false 
}) => {
  const { walletProvider } = useAppKitProvider("eip155");
  const [pools, setPools] = useState<DiscountPool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTokenSymbol = async (tokenAddress: string, provider: ethers.providers.Provider): Promise<string> => {
    try {
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      const symbol = await contract.symbol();
      return symbol;
    } catch {
      return tokenAddress.slice(0, 6) + '...' + tokenAddress.slice(-4);
    }
  };

  const loadPools = async () => {
    if (!walletProvider) {
      setError('Please connect your wallet');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const provider = new ethers.providers.Web3Provider(walletProvider as any);
      const contract = new ethers.Contract(CONTRACTS.DEALIX_DEX, DEALIX_ABI, provider);
      
      const loadedPools: DiscountPool[] = [];

      if (filterByUser && userAddress) {
        // Load user's created pools
        try {
          // Get user's pool count
          let poolIndex = 0;
          const maxPools = 100; // Safety limit
          
          while (poolIndex < maxPools) {
            try {
              const poolId = await contract.userDiscountPools(userAddress, poolIndex);
              const poolData = await contract.discountPools(poolId);
              
              if (poolData.isActive) {
                const [tokenASymbol, tokenBSymbol] = await Promise.all([
                  loadTokenSymbol(poolData.tokenA, provider),
                  loadTokenSymbol(poolData.tokenB, provider)
                ]);

                loadedPools.push({
                  id: poolId.toNumber(),
                  creator: poolData.creator,
                  tokenA: poolData.tokenA,
                  tokenB: poolData.tokenB,
                  tokenASymbol,
                  tokenBSymbol,
                  reserveA: ethers.utils.formatEther(poolData.reserveA),
                  reserveB: ethers.utils.formatEther(poolData.reserveB),
                  discountPercentage: poolData.discountPercentage.toNumber(),
                  minTradeSize: ethers.utils.formatEther(poolData.minTradeSize),
                  maxDiscountPerTrade: ethers.utils.formatEther(poolData.maxDiscountPerTrade),
                  totalVolumeGenerated: ethers.utils.formatEther(poolData.totalVolumeGenerated),
                  expirationTime: poolData.expirationTime.toNumber(),
                  isActive: poolData.isActive,
                  useTokenReserves: poolData.useTokenReserves
                });
              }
              
              poolIndex++;
            } catch (error) {
              // No more pools for this user
              break;
            }
          }
        } catch (error) {
          console.error('Error loading user pools:', error);
        }
      } else {
        // Load all active pools (scan through pool IDs)
        // This is a simple implementation - in production, you'd want events or a different approach
        const maxPoolId = 50; // Check first 50 pools
        
        for (let poolId = 1; poolId <= maxPoolId; poolId++) {
          try {
            const poolData = await contract.discountPools(poolId);
            
            if (poolData.isActive && poolData.expirationTime.gt(Math.floor(Date.now() / 1000))) {
              const [tokenASymbol, tokenBSymbol] = await Promise.all([
                loadTokenSymbol(poolData.tokenA, provider),
                loadTokenSymbol(poolData.tokenB, provider)
              ]);

              loadedPools.push({
                id: poolId,
                creator: poolData.creator,
                tokenA: poolData.tokenA,
                tokenB: poolData.tokenB,
                tokenASymbol,
                tokenBSymbol,
                reserveA: ethers.utils.formatEther(poolData.reserveA),
                reserveB: ethers.utils.formatEther(poolData.reserveB),
                discountPercentage: poolData.discountPercentage.toNumber(),
                minTradeSize: ethers.utils.formatEther(poolData.minTradeSize),
                maxDiscountPerTrade: ethers.utils.formatEther(poolData.maxDiscountPerTrade),
                totalVolumeGenerated: ethers.utils.formatEther(poolData.totalVolumeGenerated),
                expirationTime: poolData.expirationTime.toNumber(),
                isActive: poolData.isActive,
                useTokenReserves: poolData.useTokenReserves
              });
            }
          } catch (error) {
            // Pool doesn't exist, continue
            continue;
          }
        }
      }

      setPools(loadedPools);
    } catch (error: any) {
      console.error('Error loading discount pools:', error);
      setError('Failed to load discount pools');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPools();
  }, [walletProvider, userAddress, filterByUser]);

  const getTimeRemaining = (expirationTime: number) => {
    const now = Math.floor(Date.now() / 1000);
    const remaining = expirationTime - now;
    
    if (remaining <= 0) return 'Expired';
    
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  const getDiscountPercentage = (basisPoints: number) => {
    return (basisPoints / 100).toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="glass rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-white/10 rounded"></div>
            <div className="h-20 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-xl p-6">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (pools.length === 0) {
    return (
      <div className="glass rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">
          {filterByUser ? 'My Discount Pools' : 'Active Discount Pools'}
        </h3>
        <p className="text-gray-400">
          {filterByUser 
            ? 'You haven\'t created any discount pools yet.' 
            : 'No active discount pools found. Be the first to create one!'}
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white">
          {filterByUser ? 'My Discount Pools' : 'Active Discount Pools'}
        </h3>
        <button
          onClick={loadPools}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm transition-all"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {pools.map((pool) => (
          <motion.div
            key={pool.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-lg p-4 hover:bg-white/5 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                  <Icon icon={FaTag} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="text-white font-semibold">
                      {pool.tokenASymbol || 'Token'} ↔ {pool.tokenBSymbol || 'Token'}
                    </p>
                    <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">
                      {getDiscountPercentage(pool.discountPercentage)}% OFF
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm">Pool #{pool.id}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm flex items-center">
                  <Icon icon={FaClock} className="mr-1" />
                  {getTimeRemaining(pool.expirationTime)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-gray-400">Min Trade</p>
                <p className="text-white">{formatBalance(pool.minTradeSize, 2)}</p>
              </div>
              <div>
                <p className="text-gray-400">Reserves</p>
                <p className="text-white">
                  {formatBalance(pool.reserveA, 2)} / {formatBalance(pool.reserveB, 2)}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Volume</p>
                <p className="text-white">{formatBalance(pool.totalVolumeGenerated, 2)}</p>
              </div>
              <div>
                <p className="text-gray-400">Max/Trade</p>
                <p className="text-white">{formatBalance(pool.maxDiscountPerTrade, 2)}</p>
              </div>
            </div>

            {filterByUser && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-xs text-gray-400">
                  Created by you • {pool.isActive ? 'Active' : 'Inactive'}
                </p>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {pools.length > 0 && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-400">
            Showing {pools.length} active pool{pools.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
};
import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FACTORY_ADDRESS, FACTORY_ABI, PAIR_ABI, ERC20_ABI } from '../../constants/contracts';
import { DEFAULT_TOKENS } from '../../constants/tokens';

interface Pool {
  address: string;
  token0: {
    address: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
    logoURI?: string;
  };
  reserve0: string;
  reserve1: string;
  tvl: number;
  volume24h: number;
  volume7d: number;
  fees24h: number;
  apr: number;
  token0Amount: string;
  token1Amount: string;
}

interface PoolsInterfaceProps {
  walletProvider: any;
  onSelectPool?: (tokenAAddress: string, tokenBAddress: string) => void;
}

export const PoolsInterface: React.FC<PoolsInterfaceProps> = ({ walletProvider, onSelectPool }) => {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideSmallPools, setHideSmallPools] = useState(false);

  // Calculate TVL in USD (mock prices for demo)
  const calculateTVL = (reserve0: string, reserve1: string, token0: any, token1: any): number => {
    const mockPrices: { [key: string]: number } = {
      'WOPN': 2000,
      'OPN': 2000,
      'WETH': 2000,
      'iUSDC': 1,
      'iDAI': 1,
      'iLINK': 15,
    };
    
    const price0 = mockPrices[token0.symbol] || 1;
    const price1 = mockPrices[token1.symbol] || 1;
    
    const value0 = parseFloat(ethers.utils.formatUnits(reserve0, token0.decimals)) * price0;
    const value1 = parseFloat(ethers.utils.formatUnits(reserve1, token1.decimals)) * price1;
    
    return value0 + value1;
  };

  const loadPoolData = async (factory: ethers.Contract, index: number): Promise<Pool | null> => {
    try {
      const provider = new ethers.providers.Web3Provider(walletProvider);
      const pairAddress = await factory.allPairs(index);
      const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      
      const [token0Address, token1Address, reserves] = await Promise.all([
        pairContract.token0(),
        pairContract.token1(),
        pairContract.getReserves()
      ]);
      
      const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
      const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);
      
      const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
        token0Contract.symbol(),
        token1Contract.symbol(),
        token0Contract.decimals(),
        token1Contract.decimals()
      ]);
      
      const token0Info = DEFAULT_TOKENS.find(t => t.address.toLowerCase() === token0Address.toLowerCase());
      const token1Info = DEFAULT_TOKENS.find(t => t.address.toLowerCase() === token1Address.toLowerCase());
      
      const token0 = {
        address: token0Address,
        symbol: symbol0,
        decimals: decimals0,
        logoURI: token0Info?.logoURI || 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png'
      };
      
      const token1 = {
        address: token1Address,
        symbol: symbol1,
        decimals: decimals1,
        logoURI: token1Info?.logoURI || 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png'
      };
      
      const tvl = calculateTVL(reserves[0].toString(), reserves[1].toString(), token0, token1);
      
      // Mock data for demo
      const volume24h = Math.random() * tvl * 0.1;
      const volume7d = volume24h * 7 * (0.8 + Math.random() * 0.4);
      const fees24h = volume24h * 0.003;
      const apr = tvl > 0 ? (fees24h * 365 / tvl) * 100 : 0;
      
      return {
        address: pairAddress,
        token0,
        token1,
        reserve0: reserves[0].toString(),
        reserve1: reserves[1].toString(),
        tvl,
        volume24h,
        volume7d,
        fees24h,
        apr,
        token0Amount: ethers.utils.formatUnits(reserves[0], decimals0),
        token1Amount: ethers.utils.formatUnits(reserves[1], decimals1)
      };
    } catch (error) {
      console.error(`Error loading pool ${index}:`, error);
      return null;
    }
  };

  const loadAllPools = useCallback(async () => {
    if (!walletProvider) return;
    
    setLoading(true);
    try {
      const provider = new ethers.providers.Web3Provider(walletProvider);
      const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      
      const totalPairs = await factoryContract.allPairsLength();
      const poolPromises = [];
      
      for (let i = 0; i < totalPairs.toNumber(); i++) {
        poolPromises.push(loadPoolData(factoryContract, i));
      }
      
      const poolsData = await Promise.all(poolPromises);
      setPools(poolsData.filter(p => p !== null) as Pool[]);
    } catch (error) {
      console.error('Error loading pools:', error);
      toast.error('Failed to load pools');
    } finally {
      setLoading(false);
    }
  }, [walletProvider]);

  useEffect(() => {
    loadAllPools();
  }, [loadAllPools]);

  const filteredPools = React.useMemo(() => {
    let filtered = pools;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(pool => 
        pool.token0.symbol.toLowerCase().includes(query) ||
        pool.token1.symbol.toLowerCase().includes(query)
      );
    }
    
    // Hide small pools filter
    if (hideSmallPools) {
      filtered = filtered.filter(pool => pool.tvl >= 1000);
    }
    
    // Sort by TVL by default
    return filtered.sort((a, b) => b.tvl - a.tvl);
  }, [pools, searchQuery, hideSmallPools]);

  const formatCompactNumber = (num: number): string => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num.toFixed(0)}`;
  };

  const handleNewPosition = () => {
    if (onSelectPool) {
      onSelectPool('', '');
    }
  };

  const handlePoolClick = (pool: Pool) => {
    if (onSelectPool) {
      onSelectPool(pool.token0.address, pool.token1.address);
      toast.success('Pool selected! Switch to Liquidity tab.', {
        style: {
          background: 'rgba(10, 10, 11, 0.95)',
          color: '#fff',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          boxShadow: '0 4px 12px rgba(8, 145, 178, 0.15)',
        },
      });
    }
  };

  // Mobile Card Component
  const MobilePoolCard: React.FC<{ pool: Pool }> = ({ pool }) => (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className="bg-gray-900/30 backdrop-blur-sm rounded-xl border border-white/5 p-4 hover:border-emerald-500/30 transition-all duration-300"
      onClick={() => handlePoolClick(pool)}
    >
      {/* Pool Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <img
              src={pool.token0.logoURI}
              alt={pool.token0.symbol}
              className="w-8 h-8 rounded-full border-2 border-gray-900 bg-white"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png';
              }}
            />
            <img
              src={pool.token1.logoURI}
              alt={pool.token1.symbol}
              className="w-8 h-8 rounded-full border-2 border-gray-900 bg-white"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">
                {pool.token0.symbol}/{pool.token1.symbol}
              </span>
              <span className="text-xs text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded">
                0.3%
              </span>
            </div>
          </div>
        </div>
        <span className="text-lg font-semibold bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
          {formatCompactNumber(pool.tvl)}
        </span>
      </div>

      {/* Pool Stats Grid */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-gray-500 text-xs">24h Volume</p>
          <p className="text-white font-medium">{formatCompactNumber(pool.volume24h)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">7d Volume</p>
          <p className="text-white font-medium">{formatCompactNumber(pool.volume7d)}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">24h Fees</p>
          <p className="text-emerald-400 font-medium">{formatCompactNumber(pool.fees24h)}</p>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 pb-20 pools-interface">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-semibold text-white mb-2">Pools</h1>
          <p className="text-sm md:text-base text-gray-400">Add liquidity to pools and earn fees on swaps.</p>
        </div>

        {/* Top Actions Bar */}
        <div className="space-y-4 mb-6">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or paste address"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-10 bg-gray-900/50 backdrop-blur-sm rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-white/5 text-sm md:text-base transition-all duration-200"
            />
            <svg className="w-5 h-5 text-gray-500 absolute left-3 top-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          {/* Actions Row - Fixed for mobile */}
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideSmallPools}
                onChange={(e) => setHideSmallPools(e.target.checked)}
                className="w-4 h-4 text-emerald-600 bg-gray-900 border-gray-600 rounded focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-white text-sm md:text-base">Hide small pools</span>
            </label>
            
            <button
              onClick={handleNewPosition}
              className="px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-xl text-white font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all whitespace-nowrap text-sm md:text-base"
            >
              + New Position
            </button>
          </div>
        </div>

        {/* Desktop Table (hidden on mobile) */}
        <div className="hidden lg:block bg-gray-900/30 backdrop-blur-sm rounded-2xl border border-white/5 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/5 text-sm text-gray-400">
            <div className="col-span-4">Pool</div>
            <div className="col-span-2 text-right">TVL</div>
            <div className="col-span-2 text-right">24h Volume</div>
            <div className="col-span-2 text-right">7d Volume</div>
            <div className="col-span-2 text-right">24h Fees</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="px-6 py-20 text-center">
                <div className="inline-flex items-center gap-2 text-gray-400">
                  <svg className="animate-spin h-5 w-5 text-emerald-500" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading pools...
                </div>
              </div>
            ) : filteredPools.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <p className="text-gray-400 mb-4">No pools found</p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              filteredPools.map((pool) => (
                <motion.div
                  key={pool.address}
                  whileHover={{ backgroundColor: 'rgba(16, 185, 129, 0.05)' }}
                  className="grid grid-cols-12 gap-4 px-6 py-4 cursor-pointer transition-all hover:border-l-2 hover:border-l-emerald-500"
                  onClick={() => handlePoolClick(pool)}
                >
                  {/* Pool Info */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="flex -space-x-2">
                      <img
                        src={pool.token0.logoURI}
                        alt={pool.token0.symbol}
                        className="w-8 h-8 rounded-full border-2 border-gray-900 bg-white"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png';
                        }}
                      />
                      <img
                        src={pool.token1.logoURI}
                        alt={pool.token1.symbol}
                        className="w-8 h-8 rounded-full border-2 border-gray-900 bg-white"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png';
                        }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">
                          {pool.token0.symbol}/{pool.token1.symbol}
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded">
                          0.3%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* TVL */}
                  <div className="col-span-2 text-right">
                    <p className="text-white font-medium bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent">
                      {formatCompactNumber(pool.tvl)}
                    </p>
                  </div>

                  {/* 24h Volume */}
                  <div className="col-span-2 text-right">
                    <p className="text-white">{formatCompactNumber(pool.volume24h)}</p>
                  </div>

                  {/* 7d Volume */}
                  <div className="col-span-2 text-right">
                    <p className="text-white">{formatCompactNumber(pool.volume7d)}</p>
                  </div>

                  {/* 24h Fees */}
                  <div className="col-span-2 text-right">
                    <p className="text-emerald-400">{formatCompactNumber(pool.fees24h)}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Mobile Cards (visible on mobile) */}
        <div className="lg:hidden space-y-3">
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center gap-2 text-gray-400">
                <svg className="animate-spin h-5 w-5 text-emerald-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading pools...
              </div>
            </div>
          ) : filteredPools.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 mb-4">No pools found</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            filteredPools.map((pool) => (
              <MobilePoolCard key={pool.address} pool={pool} />
            ))
          )}
        </div>

        {/* Bottom Summary */}
        {!loading && pools.length > 0 && (
          <div className="mt-6 flex items-center justify-between text-xs md:text-sm text-gray-400">
            <p>Showing {filteredPools.length} of {pools.length} pools</p>
            <button
              onClick={() => loadAllPools()}
              className="flex items-center gap-2 hover:text-emerald-400 transition-colors px-3 py-1 rounded-lg hover:bg-white/5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
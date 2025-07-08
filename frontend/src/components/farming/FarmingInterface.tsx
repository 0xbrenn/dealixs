import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FarmPool } from '../../types';
import { formatBalance } from '../../utils/formatters';
import { StakeModal } from './StakeModal';
import { PAIR_ABI, ERC20_ABI } from '../../constants/contracts';
import { DEFAULT_TOKENS } from '../../constants/tokens';

// Add your MasterChef contract address and ABI here
const MASTERCHEF_ADDRESS = process.env.REACT_APP_MASTERCHEF_ADDRESS || '';
const MASTERCHEF_ABI = [
  "function poolLength() external view returns (uint256)",
  "function poolInfo(uint256) external view returns (address lpToken, uint256 allocPoint, uint256 lastRewardBlock, uint256 accRewardPerShare, uint256 depositFee)",
  "function userInfo(uint256, address) external view returns (uint256 amount, uint256 rewardDebt)",
  "function pendingReward(uint256 _pid, address _user) external view returns (uint256)",
  "function deposit(uint256 _pid, uint256 _amount) external",
  "function withdraw(uint256 _pid, uint256 _amount) external",
  "function emergencyWithdraw(uint256 _pid) external",
  "function rewardPerBlock() external view returns (uint256)",
  "function totalAllocPoint() external view returns (uint256)"
];

interface FarmingInterfaceProps {
  walletProvider: any;
  address?: string;
  isConnected: boolean;
}

// Set this to true when farming is ready
const FARMING_ENABLED = false;

export const FarmingInterface: React.FC<FarmingInterfaceProps> = ({
  walletProvider,
  address,
  isConnected
}) => {
  const [pools, setPools] = useState<FarmPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPool, setSelectedPool] = useState<FarmPool | null>(null);
  const [modalMode, setModalMode] = useState<'stake' | 'unstake'>('stake');
  const [showModal, setShowModal] = useState(false);
  
  // Add refs to prevent duplicate loading
  const isLoadingRef = useRef(false);
  const hasInitialLoadRef = useRef(false);

  // Helper function to format LP token amounts
  const formatLPBalance = (balance: string, decimals: number = 18): string => {
    try {
      const formatted = parseFloat(ethers.utils.formatUnits(balance, decimals));
      if (formatted === 0) return '0.0000';
      if (formatted < 0.0001 && formatted > 0) return '<0.0001';
      if (formatted < 1) return formatted.toFixed(4);
      if (formatted < 1000) return formatted.toFixed(4);
      if (formatted < 1000000) return (formatted / 1000).toFixed(2) + 'K';
      return (formatted / 1000000).toFixed(2) + 'M';
    } catch {
      return '0.0000';
    }
  };

  // Define loadPoolData before using it in loadFarmPools
  const loadPoolData = useCallback(async (
    masterChef: ethers.Contract,
    pid: number,
    rewardPerBlock: ethers.BigNumber,
    totalAllocPoint: ethers.BigNumber,
    provider: ethers.providers.Web3Provider
  ): Promise<FarmPool | null> => {
    try {
      const poolInfo = await masterChef.poolInfo(pid);
      const lpToken = poolInfo.lpToken;
      const allocPoint = poolInfo.allocPoint;
      const depositFee = poolInfo.depositFee;
      
      // Get LP token info
      const lpContract = new ethers.Contract(lpToken, PAIR_ABI, provider);
      const [token0Address, token1Address] = await Promise.all([
        lpContract.token0(),
        lpContract.token1()
      ]);
      
      // Get token symbols
      const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
      const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);
      
      const [symbol0, symbol1] = await Promise.all([
        token0Contract.symbol(),
        token1Contract.symbol()
      ]);
      
      // Find token info from DEFAULT_TOKENS
      const token0Info = DEFAULT_TOKENS.find(t => t.address.toLowerCase() === token0Address.toLowerCase());
      const token1Info = DEFAULT_TOKENS.find(t => t.address.toLowerCase() === token1Address.toLowerCase());
      
      // Calculate total staked
      const totalStaked = await lpContract.balanceOf(MASTERCHEF_ADDRESS);
      
      // Get user info if connected
      let userStaked = '0';
      let pendingReward = '0';
      
      if (address) {
        const userInfo = await masterChef.userInfo(pid, address);
        userStaked = userInfo.amount.toString();
        pendingReward = (await masterChef.pendingReward(pid, address)).toString();
      }
      
      // Calculate APR (simplified - you should use actual token prices)
      const poolRewardPerBlock = rewardPerBlock.mul(allocPoint).div(totalAllocPoint);
      const yearlyRewards = poolRewardPerBlock.mul(10512000); // blocks per year (3s blocks)
      const apr = totalStaked.gt(0) 
        ? yearlyRewards.mul(10000).div(totalStaked).toNumber() / 100 
        : 0;
      
      return {
        pid,
        lpToken,
        lpSymbol: `${symbol0}-${symbol1}`,
        token0: { 
          address: token0Address, 
          symbol: symbol0, 
          name: symbol0,
          decimals: 18,
          balance: '0',
          logoURI: token0Info?.logoURI
        },
        token1: { 
          address: token1Address, 
          symbol: symbol1, 
          name: symbol1,
          decimals: 18,
          balance: '0',
          logoURI: token1Info?.logoURI
        },
        allocPoint: allocPoint.toNumber(),
        depositFee: depositFee.toNumber(),
        totalStaked: totalStaked.toString(),
        apr,
        rewardPerBlock: poolRewardPerBlock.toString(),
        userStaked,
        pendingReward
      };
    } catch (error) {
      console.error(`Error loading pool ${pid}:`, error);
      return null;
    }
  }, [address]);

  // Load farm pools with duplicate prevention
  const loadFarmPools = useCallback(async () => {
    // Skip loading if farming is not enabled
    if (!FARMING_ENABLED) {
      setLoading(false);
      return;
    }

    if (!walletProvider || !MASTERCHEF_ADDRESS) {
      toast.error('Farming not configured', {
        style: {
          background: 'rgba(10, 10, 11, 0.95)',
          color: '#fff',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        },
      });
      setLoading(false);
      return;
    }

    // Prevent duplicate loading
    if (isLoadingRef.current) {
      return;
    }

    isLoadingRef.current = true;
    const loadingToast = toast.loading('Loading farms...', {
      style: {
        background: 'rgba(10, 10, 11, 0.95)',
        color: '#fff',
        border: '1px solid rgba(0, 255, 77, 0.3)',
      },
    });

    try {
      const provider = new ethers.providers.Web3Provider(walletProvider);
      const masterChef = new ethers.Contract(MASTERCHEF_ADDRESS, MASTERCHEF_ABI, provider);
      
      const poolLength = await masterChef.poolLength();
      const rewardPerBlock = await masterChef.rewardPerBlock();
      const totalAllocPoint = await masterChef.totalAllocPoint();
      
      const poolPromises = [];
      
      for (let i = 0; i < poolLength.toNumber(); i++) {
        poolPromises.push(loadPoolData(masterChef, i, rewardPerBlock, totalAllocPoint, provider));
      }
      
      const poolsData = await Promise.all(poolPromises);
      const validPools = poolsData.filter(p => p !== null) as FarmPool[];
      setPools(validPools);
      
      toast.success(`Loaded ${validPools.length} farms`, { 
        id: loadingToast,
        style: {
          background: 'rgba(10, 10, 11, 0.95)',
          color: '#fff',
          border: '1px solid rgba(0, 255, 77, 0.3)',
          boxShadow: '0 4px 12px rgba(6, 182, 212, 0.15)',
        },
      });
    } catch (error: any) {
      console.error('Error loading farms:', error);
      toast.error('Failed to load farms', { id: loadingToast });
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [walletProvider, loadPoolData]);

  // Initial load - only run once
  useEffect(() => {
    if (!hasInitialLoadRef.current) {
      hasInitialLoadRef.current = true;
      loadFarmPools();
    }
  }, []); // Empty dependency array - only runs once on mount

  // Reload when address changes (after initial load)
  useEffect(() => {
    if (hasInitialLoadRef.current && address && FARMING_ENABLED) {
      loadFarmPools();
    }
  }, [address, loadFarmPools]);

  const handleStake = async (pool: FarmPool, amount: string) => {
    if (!walletProvider || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    const loadingToast = toast.loading('Staking LP tokens...');

    try {
      const provider = new ethers.providers.Web3Provider(walletProvider);
      const signer = provider.getSigner();
      const masterChef = new ethers.Contract(MASTERCHEF_ADDRESS, MASTERCHEF_ABI, signer);
      
      // Approve LP tokens first
      const lpContract = new ethers.Contract(pool.lpToken, ERC20_ABI, signer);
      const amountWei = ethers.utils.parseUnits(amount, 18);
      
      const allowance = await lpContract.allowance(address, MASTERCHEF_ADDRESS);
      if (allowance.lt(amountWei)) {
        const approveTx = await lpContract.approve(MASTERCHEF_ADDRESS, ethers.constants.MaxUint256);
        await approveTx.wait();
      }
      
      // Stake
      const tx = await masterChef.deposit(pool.pid, amountWei);
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        toast.success('Successfully staked!', { 
          id: loadingToast,
          style: {
            background: 'rgba(10, 10, 11, 0.95)',
            color: '#fff',
            border: '1px solid rgba(0, 255, 77, 0.3)',
            boxShadow: '0 4px 12px rgba(6, 182, 212, 0.15)',
          },
        });
        await loadFarmPools();
        setShowModal(false);
      }
    } catch (error: any) {
      console.error('Stake error:', error);
      toast.error(error?.message || 'Failed to stake', { id: loadingToast });
    }
  };

  const handleUnstake = async (pool: FarmPool, amount: string) => {
    if (!walletProvider || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    const loadingToast = toast.loading('Unstaking LP tokens...');

    try {
      const provider = new ethers.providers.Web3Provider(walletProvider);
      const signer = provider.getSigner();
      const masterChef = new ethers.Contract(MASTERCHEF_ADDRESS, MASTERCHEF_ABI, signer);
      
      const amountWei = ethers.utils.parseUnits(amount, 18);
      const tx = await masterChef.withdraw(pool.pid, amountWei);
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        toast.success('Successfully unstaked!', { 
          id: loadingToast,
          style: {
            background: 'rgba(10, 10, 11, 0.95)',
            color: '#fff',
            border: '1px solid rgba(0, 255, 77, 0.3)',
            boxShadow: '0 4px 12px rgba(6, 182, 212, 0.15)',
          },
        });
        await loadFarmPools();
        setShowModal(false);
      }
    } catch (error: any) {
      console.error('Unstake error:', error);
      toast.error(error?.message || 'Failed to unstake', { id: loadingToast });
    }
  };

  const handleHarvest = async (pool: FarmPool) => {
    if (!walletProvider || !address) {
      toast.error('Please connect your wallet');
      return;
    }

    const loadingToast = toast.loading('Harvesting rewards...');

    try {
      const provider = new ethers.providers.Web3Provider(walletProvider);
      const signer = provider.getSigner();
      const masterChef = new ethers.Contract(MASTERCHEF_ADDRESS, MASTERCHEF_ABI, signer);
      
      // Withdraw 0 to harvest
      const tx = await masterChef.withdraw(pool.pid, 0);
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        toast.success('Successfully harvested!', { 
          id: loadingToast,
          style: {
            background: 'rgba(10, 10, 11, 0.95)',
            color: '#fff',
            border: '1px solid rgba(0, 255, 77, 0.3)',
            boxShadow: '0 4px 12px rgba(6, 182, 212, 0.15)',
          },
        });
        await loadFarmPools();
      }
    } catch (error: any) {
      console.error('Harvest error:', error);
      toast.error(error?.message || 'Failed to harvest', { id: loadingToast });
    }
  };

  // Coming Soon Component
  const ComingSoonContent = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-[60vh] flex items-center justify-center"
    >
      <div className="text-center max-w-2xl mx-auto px-4">
        {/* Animated Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ 
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: 0.1 
          }}
          className="mb-8"
        >
          <div className="w-32 h-32 mx-auto relative">
            {/* Outer glow ring */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#00FF4D] to-cyan-500 rounded-full blur-2xl opacity-50 animate-pulse"></div>
            
            {/* Main icon container */}
            <div className="relative w-full h-full bg-gradient-to-br from-[#00FF4D]/20 to-cyan-500/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-[#00FF4D]/30">
              {/* Animated rings */}
              <div className="absolute inset-0 rounded-full border-2 border-[#00FF4D]/30 animate-ping"></div>
              <div className="absolute inset-2 rounded-full border-2 border-cyan-500/30 animate-ping animation-delay-200"></div>
              
              {/* Farm icon */}
              <svg className="w-16 h-16 text-[#00FF4D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-4xl md:text-5xl font-bold text-white mb-4"
        >
          Yield Farming
          <span className="block text-2xl md:text-3xl bg-gradient-to-r from-[#00FF4D] to-cyan-500 bg-clip-text text-transparent mt-2">
            Coming Soon
          </span>
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-gray-400 text-lg md:text-xl mb-8 leading-relaxed"
        >
          Get ready to earn <span className="text-[#00FF4D] font-semibold">DLX rewards</span> by staking your LP tokens. 
          Our yield farming pools will offer competitive APRs with bonus multipliers for Dealix ID holders.
        </motion.p>

        {/* Features */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
        >
          <div className="glass rounded-xl p-4 border border-[#00FF4D]/20">
            <div className="text-[#00FF4D] text-2xl mb-2">🚀</div>
            <h3 className="text-white font-semibold mb-1">High APR</h3>
            <p className="text-gray-400 text-sm">Competitive yields on your favorite pairs</p>
          </div>
          <div className="glass rounded-xl p-4 border border-cyan-500/20">
            <div className="text-cyan-400 text-2xl mb-2">⚡</div>
            <h3 className="text-white font-semibold mb-1">Boost System</h3>
            <p className="text-gray-400 text-sm">Up to 3x boost with Dealix ID</p>
          </div>
          <div className="glass rounded-xl p-4 border border-[#00FF4D]/20">
            <div className="text-[#00FF4D] text-2xl mb-2">🎁</div>
            <h3 className="text-white font-semibold mb-1">Bonus Rewards</h3>
            <p className="text-gray-400 text-sm">Extra tokens for early farmers</p>
          </div>
        </motion.div>

        {/* Notification Form */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-6 border border-white/10 max-w-md mx-auto"
        >
          <h3 className="text-white font-semibold mb-3">Get Notified</h3>
          <p className="text-gray-400 text-sm mb-4">Be the first to know when farming goes live!</p>
          
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#00FF4D]/50 transition-colors"
            />
            <button
              onClick={() => toast.success('You\'ll be notified when farming launches!', {
                style: {
                  background: 'rgba(10, 10, 11, 0.95)',
                  color: '#fff',
                  border: '1px solid rgba(0, 255, 77, 0.3)',
                },
              })}
              className="px-6 py-2 bg-gradient-to-r from-[#00FF4D] to-cyan-500 rounded-lg text-white font-semibold hover:shadow-lg hover:shadow-[#00FF4D]/25 transition-all"
            >
              Notify Me
            </button>
          </div>
        </motion.div>

        {/* Launch Timeline */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 text-gray-400 text-sm"
        >
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-[#00FF4D] rounded-full animate-pulse"></div>
            <span>Estimated Launch: Q4 2025</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );

  // Mobile Farm Card Component (keeping for when farming is enabled)
  const MobileFarmCard: React.FC<{ pool: FarmPool }> = ({ pool }) => {
    const hasStaked = parseFloat(pool.userStaked || '0') > 0;
    const pendingRewards = parseFloat(ethers.utils.formatUnits(pool.pendingReward || '0', 18));
    
    return (
      <div className="glass rounded-xl p-4 border border-white/10 hover:border-[#00FF4D]/30 transition-all duration-300">
        {/* Pool Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {pool.token0.logoURI ? (
                <img 
                  src={pool.token0.logoURI} 
                  alt={pool.token0.symbol}
                  className="w-10 h-10 rounded-full border-2 border-gray-900"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-[#00FF4D] to-cyan-500 rounded-full flex items-center justify-center border-2 border-gray-900">
                  <span className="text-white text-xs font-bold">{pool.token0.symbol[0]}</span>
                </div>
              )}
              {pool.token1.logoURI ? (
                <img 
                  src={pool.token1.logoURI} 
                  alt={pool.token1.symbol}
                  className="w-10 h-10 rounded-full border-2 border-gray-900"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-[#00FF4D] rounded-full flex items-center justify-center border-2 border-gray-900">
                  <span className="text-white text-xs font-bold">{pool.token1.symbol[0]}</span>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-white font-semibold">{pool.lpSymbol}</h3>
              <p className="text-gray-400 text-xs">
                Earn DLX • Fee: {pool.depositFee / 100}%
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold bg-gradient-to-r from-[#00FF4D] to-cyan-500 bg-clip-text text-transparent">
              {pool.apr.toFixed(2)}%
            </div>
            <p className="text-gray-500 text-xs uppercase">APR</p>
          </div>
        </div>

        {/* Pool Stats */}
        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Total Staked</span>
            <span className="text-white font-medium">{formatLPBalance(pool.totalStaked)} LP</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Your Stake</span>
            <span className="text-white font-medium">{formatLPBalance(pool.userStaked || '0')} LP</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Pending Rewards</span>
            <span className="bg-gradient-to-r from-[#00FF4D] to-cyan-400 bg-clip-text text-transparent font-medium">
              {pendingRewards.toFixed(6)} DLX
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!hasStaked ? (
            <button
              onClick={() => {
                setSelectedPool(pool);
                setModalMode('stake');
                setShowModal(true);
              }}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-[#00FF4D] to-cyan-500 rounded-xl text-white font-semibold text-sm hover:shadow-lg transition-all"
              style={{
                boxShadow: '0 4px 20px rgba(0, 255, 77, 0.3)'
              }}
            >
              Stake LP
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setSelectedPool(pool);
                  setModalMode('stake');
                  setShowModal(true);
                }}
                className="flex-1 py-2 px-3 glass glass-hover rounded-lg text-white font-medium border border-white/10 hover:border-[#00FF4D]/30 text-sm transition-all"
              >
                Stake More
              </button>
              <button
                onClick={() => {
                  setSelectedPool(pool);
                  setModalMode('unstake');
                  setShowModal(true);
                }}
                className="flex-1 py-2 px-3 glass glass-hover rounded-lg text-white font-medium border border-white/10 hover:border-[#00FF4D]/30 text-sm transition-all"
              >
                Unstake
              </button>
              {pendingRewards > 0.0001 && (
                <button
                  onClick={() => handleHarvest(pool)}
                  className="px-3 py-2 glass rounded-lg text-[#00FF4D] font-medium border border-[#00FF4D]/30 hover:border-[#00FF4D]/50 text-sm transition-all"
                >
                  Harvest
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // Desktop Farm Card
  const FarmCard: React.FC<{ pool: FarmPool }> = ({ pool }) => {
    const hasStaked = parseFloat(pool.userStaked || '0') > 0;
    const pendingRewards = parseFloat(ethers.utils.formatUnits(pool.pendingReward || '0', 18));
    
    return (
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="glass rounded-2xl p-6 border border-white/10 hover:border-[#00FF4D]/20 transition-all"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex -space-x-2">
              {pool.token0.logoURI ? (
                <img 
                  src={pool.token0.logoURI} 
                  alt={pool.token0.symbol}
                  className="w-10 h-10 rounded-full border-2 border-gray-900"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-[#00FF4D] to-cyan-500 rounded-full flex items-center justify-center border-2 border-gray-900">
                  <span className="text-white text-xs font-bold">{pool.token0.symbol[0]}</span>
                </div>
              )}
              {pool.token1.logoURI ? (
                <img 
                  src={pool.token1.logoURI} 
                  alt={pool.token1.symbol}
                  className="w-10 h-10 rounded-full border-2 border-gray-900"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-[#00FF4D] rounded-full flex items-center justify-center border-2 border-gray-900">
                  <span className="text-white text-xs font-bold">{pool.token1.symbol[0]}</span>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg">{pool.lpSymbol}</h3>
              <p className="text-gray-400 text-sm">
                Earn DLX • Fee: {pool.depositFee / 100}%
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold bg-gradient-to-r from-[#00FF4D] to-cyan-500 bg-clip-text text-transparent">
              {pool.apr.toFixed(2)}%
            </div>
            <p className="text-gray-500 text-xs uppercase">APR</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Total Staked</span>
            <span className="text-white font-medium">{formatLPBalance(pool.totalStaked)} LP</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Your Stake</span>
            <span className="text-white font-medium">{formatLPBalance(pool.userStaked || '0')} LP</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Pending Rewards</span>
            <span className="bg-gradient-to-r from-[#00FF4D] to-cyan-400 bg-clip-text text-transparent font-medium">
              {pendingRewards.toFixed(6)} DLX
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          {!hasStaked ? (
            <button
              onClick={() => {
                setSelectedPool(pool);
                setModalMode('stake');
                setShowModal(true);
              }}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-[#00FF4D] to-cyan-500 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              style={{
                boxShadow: '0 4px 20px rgba(0, 255, 77, 0.3)'
              }}
            >
              Stake LP
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setSelectedPool(pool);
                  setModalMode('stake');
                  setShowModal(true);
                }}
                className="flex-1 py-3 px-4 glass glass-hover rounded-xl text-white font-medium border border-white/10 hover:border-[#00FF4D]/30 transition-all"
              >
                Stake More
              </button>
              <button
                onClick={() => {
                  setSelectedPool(pool);
                  setModalMode('unstake');
                  setShowModal(true);
                }}
                className="flex-1 py-3 px-4 glass glass-hover rounded-xl text-white font-medium border border-white/10 hover:border-[#00FF4D]/30 transition-all"
              >
                Unstake
              </button>
              {pendingRewards > 0.0001 && (
                <button
                  onClick={() => handleHarvest(pool)}
                  className="px-4 glass rounded-xl text-[#00FF4D] font-medium border border-[#00FF4D]/30 hover:border-[#00FF4D]/50 transition-all"
                >
                  Harvest
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    );
  };

  // If farming is not enabled, show coming soon
  if (!FARMING_ENABLED) {
    return (
      <div className="w-full max-w-[1200px] mx-auto px-4 pb-20">
        <ComingSoonContent />
      </div>
    );
  }

  // Otherwise show the normal farming interface
  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">Yield Farming</h1>
          <p className="text-gray-400 text-sm md:text-lg">Stake LP tokens to earn DLX rewards</p>
        </div>

        {/* Stats Cards - Mobile Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="glass rounded-xl p-4 md:p-5 border border-white/10">
            <p className="text-gray-400 text-xs md:text-sm mb-1">Total Value Locked</p>
            <p className="text-xl md:text-2xl font-bold text-white">
              ${pools.reduce((sum, p) => {
                const staked = parseFloat(ethers.utils.formatUnits(p.totalStaked || '0', 18));
                return sum + (staked * 0.1);
              }, 0).toFixed(0)}
            </p>
          </div>
          <div className="glass rounded-xl p-4 md:p-5 border border-white/10">
            <p className="text-gray-400 text-xs md:text-sm mb-1">Your Total Staked</p>
            <p className="text-xl md:text-2xl font-bold text-white">
              ${pools.reduce((sum, p) => {
                const staked = parseFloat(ethers.utils.formatUnits(p.userStaked || '0', 18));
                return sum + (staked * 0.1);
              }, 0).toFixed(2)}
            </p>
          </div>
          <div className="glass rounded-xl p-4 md:p-5 border border-white/10">
            <p className="text-gray-400 text-xs md:text-sm mb-1">Total Rewards</p>
            <p className="text-xl md:text-2xl font-bold bg-gradient-to-r from-[#00FF4D] to-cyan-500 bg-clip-text text-transparent">
              {pools.reduce((sum, p) => sum + parseFloat(ethers.utils.formatUnits(p.pendingReward || '0', 18)), 0).toFixed(4)} DLX
            </p>
          </div>
        </div>

        {/* Farm Pools - Mobile vs Desktop */}
        <div className="block lg:hidden">
          {/* Mobile View - Single Column */}
          <div className="space-y-4">
            {loading ? (
              <>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="glass rounded-xl p-4 animate-pulse border border-white/10">
                    <div className="h-16 bg-gray-700/30 rounded mb-3"></div>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-700/30 rounded w-full"></div>
                      <div className="h-3 bg-gray-700/30 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-700/30 rounded w-1/2"></div>
                    </div>
                    <div className="h-10 bg-gray-700/30 rounded mt-3"></div>
                  </div>
                ))}
              </>
            ) : pools.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#00FF4D]/20 to-cyan-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-[#00FF4D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No farms available</h3>
                <p className="text-gray-400">Check back later for farming opportunities</p>
              </div>
            ) : (
              pools.map(pool => (
                <MobileFarmCard key={pool.pid} pool={pool} />
              ))
            )}
          </div>
        </div>

        {/* Desktop View - Grid */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-6">
          {loading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass rounded-2xl p-6 animate-pulse border border-white/10">
                  <div className="h-20 bg-gray-700/30 rounded mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-gray-700/30 rounded w-full"></div>
                    <div className="h-4 bg-gray-700/30 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-700/30 rounded w-1/2"></div>
                  </div>
                  <div className="h-12 bg-gray-700/30 rounded mt-4"></div>
                </div>
              ))}
            </>
          ) : pools.length === 0 ? (
            <div className="col-span-full text-center py-20">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#00FF4D]/20 to-cyan-500/20 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-[#00FF4D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No farms available</h3>
              <p className="text-gray-400">Check back later for farming opportunities</p>
            </div>
          ) : (
            pools.map(pool => (
              <FarmCard key={pool.pid} pool={pool} />
            ))
          )}
        </div>

        {/* Footer */}
        {!loading && pools.length > 0 && (
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-2 text-[#00FF4D] text-sm">
              <div className="w-2 h-2 bg-[#00FF4D] rounded-full animate-pulse"></div>
              <span>Loaded {pools.length} farms</span>
            </div>
          </div>
        )}

        {!isConnected && (
          <div className="mt-8 text-center glass rounded-xl p-6 md:p-8 border border-white/10">
            <p className="text-gray-400 text-sm md:text-lg">Connect your wallet to start farming</p>
          </div>
        )}
      </motion.div>

      {/* Stake/Unstake Modal */}
      {selectedPool && (
        <StakeModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          pool={selectedPool}
          mode={modalMode}
          onConfirm={(amount) => {
            if (modalMode === 'stake') {
              handleStake(selectedPool, amount);
            } else {
              handleUnstake(selectedPool, amount);
            }
          }}
          walletProvider={walletProvider}
        />
      )}

      {/* Add the animation styles */}
      <style>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        
        .animate-ping {
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        
        .animation-delay-200 {
          animation-delay: 200ms;
        }
      `}</style>
    </div>
  );
};
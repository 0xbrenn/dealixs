import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaIdCard, FaTrophy, FaChartLine, FaUsers, FaGift, FaRocket, FaPlus, FaTag, FaHandshake, FaChevronDown } from 'react-icons/fa';
import { ethers } from 'ethers';
import { useDealix } from '../../contexts/DealixContext';
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { DealixIDCard } from '../dealix/DealixIDCard';
import { CreateDealixModal } from '../dealix/CreateDealixModal';
import { TokenSelectModal } from './TokenSelectModal';
import { ActiveDiscountPools } from './ActiveDiscountPools';
import { Icon } from '../common/Icon';
import toast from 'react-hot-toast';
import { CONTRACTS } from '../../config/appkit';
import { ERC20_ABI } from '../../constants/contracts';
import { DEFAULT_TOKENS } from '../../constants/tokens';
import { formatBalance } from '../../utils/formatters';
import { Token } from '../../types';

// Add the correct ABI for createTokenDiscountPool
const DEALIX_ABI = [
  // Include the correct function signature
  "function createTokenDiscountPool(tuple(address tokenA, address tokenB, uint256 amountA, uint256 amountB, uint256 discountPercentage, uint256 minTradeSize, uint256 duration)) returns (uint256)",
  "function userToDealixID(address user) view returns (uint256)",
  "function dealixIDs(uint256) view returns (uint256 tokenId, address owner, uint256 totalVolume, uint256 discountTier, uint256 badgeCount, uint256 liquidityProvided, uint256 discountsCreated, uint256 swapCount, uint256 socialPoints, uint256 lastActivityTimestamp, uint256 activityStreak, uint256 affiliateEarnings, uint256 volumeInCurrentBlock, uint256 lastVolumeUpdateBlock)",
  "event DiscountPoolCreated(uint256 indexed poolId, address indexed creator, address tokenA, address tokenB, uint256 discountPercentage)"
];

interface CreateDiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CreateAffiliateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateDiscountModal: React.FC<CreateDiscountModalProps> = ({ isOpen, onClose }) => {
  const { address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const [tokenA, setTokenA] = useState<Token>({
    address: '', // Empty address - user must select
    symbol: 'Select Token',
    name: 'Select a token',
    decimals: 18,
    logoURI: ''
  });
  const [tokenB, setTokenB] = useState<Token>({
    address: '', // Empty address - user must select
    symbol: 'Select Token',
    name: 'Select a token',
    decimals: 18,
    logoURI: ''
  });
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('5');
  const [minTradeSize, setMinTradeSize] = useState('100');
  const [duration, setDuration] = useState('7');
  const [isCreating, setIsCreating] = useState(false);
  const [showTokenASelect, setShowTokenASelect] = useState(false);
  const [showTokenBSelect, setShowTokenBSelect] = useState(false);

  const handleCreateDiscountPool = async () => {
    if (!address || !walletProvider) {
      toast.error('Please connect your wallet');
      return;
    }

    // Validate inputs
    if (!tokenA.address || tokenA.address === '' || tokenA.address === '0x0000000000000000000000000000000000000000') {
      toast.error('Please select a valid Token A (ETH not supported directly - use WETH)');
      return;
    }

    if (!tokenB.address || tokenB.address === '' || tokenB.address === '0x0000000000000000000000000000000000000000') {
      toast.error('Please select a valid Token B (ETH not supported directly - use WETH)');
      return;
    }

    if (tokenA.address.toLowerCase() === tokenB.address.toLowerCase()) {
      toast.error('Token A and Token B must be different');
      return;
    }

    if (!amountA && !amountB) {
      toast.error('Please provide at least one token amount');
      return;
    }

    if (parseFloat(discountPercentage) <= 0 || parseFloat(discountPercentage) > 50) {
      toast.error('Discount percentage must be between 0.1 and 50');
      return;
    }

    if (parseFloat(minTradeSize) <= 0) {
      toast.error('Minimum trade size must be greater than 0');
      return;
    }

    setIsCreating(true);
    try {
      const provider = new ethers.providers.Web3Provider(walletProvider as any);
      const signer = provider.getSigner();
      
      // Make sure we're using the correct contract address
      console.log('Using Dealix contract at:', CONTRACTS.DEALIX_DEX);
      
      const dealixContract = new ethers.Contract(CONTRACTS.DEALIX_DEX, DEALIX_ABI, signer);

      // Log parameters for debugging
      console.log('Creating discount pool with params:', {
        tokenA: tokenA.address,
        tokenB: tokenB.address,
        amountA,
        amountB,
        discountPercentage: parseFloat(discountPercentage || '5'),
        minTradeSize,
        duration: parseInt(duration || '7'),
        contract: CONTRACTS.DEALIX_DEX
      });

      // Approve tokens first
      if (amountA && parseFloat(amountA) > 0) {
        const tokenAContract = new ethers.Contract(tokenA.address, ERC20_ABI, signer);
        const amountAWei = ethers.utils.parseUnits(amountA, tokenA.decimals);
        const allowance = await tokenAContract.allowance(address, CONTRACTS.DEALIX_DEX);
        
        if (allowance.lt(amountAWei)) {
          const approveTx = await tokenAContract.approve(CONTRACTS.DEALIX_DEX, amountAWei);
          toast.loading('Approving token A...', { id: 'approve-a' });
          await approveTx.wait();
          toast.success('Token A approved!', { id: 'approve-a' });
        }
      }

      if (amountB && parseFloat(amountB) > 0) {
        const tokenBContract = new ethers.Contract(tokenB.address, ERC20_ABI, signer);
        const amountBWei = ethers.utils.parseUnits(amountB, tokenB.decimals);
        const allowance = await tokenBContract.allowance(address, CONTRACTS.DEALIX_DEX);
        
        if (allowance.lt(amountBWei)) {
          const approveTx = await tokenBContract.approve(CONTRACTS.DEALIX_DEX, amountBWei);
          toast.loading('Approving token B...', { id: 'approve-b' });
          await approveTx.wait();
          toast.success('Token B approved!', { id: 'approve-b' });
        }
      }

      // Create discount pool
      // Debug logging
      console.log('Raw values:', {
        amountA,
        amountB,
        tokenA,
        tokenB,
        discountPercentage,
        minTradeSize,
        duration
      });

      // Ensure we have valid amounts with proper error handling
      let amountAWei = ethers.BigNumber.from(0);
      let amountBWei = ethers.BigNumber.from(0);
      
      try {
        if (amountA && amountA.trim() !== '' && parseFloat(amountA) > 0) {
          const decimalsA = tokenA.decimals || 18;
          amountAWei = ethers.utils.parseUnits(amountA, decimalsA);
        }
      } catch (e) {
        console.error('Error parsing amountA:', e);
      }
      
      try {
        if (amountB && amountB.trim() !== '' && parseFloat(amountB) > 0) {
          const decimalsB = tokenB.decimals || 18;
          amountBWei = ethers.utils.parseUnits(amountB, decimalsB);
        }
      } catch (e) {
        console.error('Error parsing amountB:', e);
      }

      // Ensure all values are defined with safe defaults
      const discountPercentageValue = discountPercentage || '5';
      const minTradeSizeValue = minTradeSize || '100';
      const durationValue = duration || '7';
      
      // Parse values safely
      let discountBasisPoints = 500; // Default 5%
      try {
        discountBasisPoints = Math.floor(parseFloat(discountPercentageValue) * 100);
        if (isNaN(discountBasisPoints) || discountBasisPoints <= 0) {
          discountBasisPoints = 500;
        }
      } catch (e) {
        console.error('Error parsing discount percentage:', e);
      }
      
      let minTradeSizeWei = ethers.utils.parseUnits('100', 18); // Default
      try {
        if (minTradeSizeValue && parseFloat(minTradeSizeValue) > 0) {
          minTradeSizeWei = ethers.utils.parseUnits(minTradeSizeValue, 18);
        }
      } catch (e) {
        console.error('Error parsing min trade size:', e);
      }
      
      let durationSeconds = 7 * 24 * 60 * 60; // Default 7 days
      try {
        const days = parseInt(durationValue);
        if (!isNaN(days) && days > 0 && days <= 365) {
          durationSeconds = days * 24 * 60 * 60;
        }
      } catch (e) {
        console.error('Error parsing duration:', e);
      }

      // Create the struct parameter - matching the exact contract structure
      const poolParams = {
        tokenA: tokenA.address || ethers.constants.AddressZero,
        tokenB: tokenB.address || ethers.constants.AddressZero,
        amountA: amountAWei,
        amountB: amountBWei,
        discountPercentage: ethers.BigNumber.from(discountBasisPoints),
        minTradeSize: minTradeSizeWei,
        duration: ethers.BigNumber.from(durationSeconds)
      };

      console.log('Pool params (processed):', {
        tokenA: poolParams.tokenA,
        tokenB: poolParams.tokenB,
        amountA: poolParams.amountA.toString(),
        amountB: poolParams.amountB.toString(),
        discountPercentage: poolParams.discountPercentage.toString(),
        minTradeSize: poolParams.minTradeSize.toString(),
        duration: poolParams.duration.toString()
      });

      const tx = await dealixContract.createTokenDiscountPool(poolParams);
      toast.loading('Creating discount pool...', { id: 'create-pool' });
      const receipt = await tx.wait();
      
      toast.success('Discount pool created successfully!', { id: 'create-pool' });
      onClose();
    } catch (error: any) {
      console.error('Error creating discount pool:', error);
      
      // Parse error message for better user feedback
      let errorMessage = 'Failed to create discount pool';
      
      if (error.message) {
        if (error.message.includes('execution reverted')) {
          errorMessage = 'Transaction failed. Please check your parameters and try again.';
          
          // Common revert reasons
          if (error.message.includes('Insufficient balance')) {
            errorMessage = 'Insufficient token balance';
          } else if (error.message.includes('Invalid parameters')) {
            errorMessage = 'Invalid parameters provided';
          } else if (error.message.includes('Pool already exists')) {
            errorMessage = 'A discount pool already exists for this token pair';
          } else if (error.message.includes('onlyDealixHolder')) {
            errorMessage = 'You need a Dealix ID to create discount pools';
          } else if (error.message.includes('Must provide tokens')) {
            errorMessage = 'You must provide at least one token amount';
          } else if (error.message.includes('Invalid duration')) {
            errorMessage = 'Duration must be between 1 and 365 days';
          } else if (error.message.includes('Same token')) {
            errorMessage = 'Token A and Token B must be different';
          } else if (error.message.includes('Blacklisted token')) {
            errorMessage = 'One of the selected tokens is blacklisted';
          }
        } else if (error.message.includes('user rejected')) {
          errorMessage = 'Transaction cancelled by user';
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
              onClick={onClose}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
            >
              <div className="glass rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Create Discount Pool</h2>
                  <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <Icon icon={FaPlus} className="rotate-45" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Token Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Token A</label>
                      <button
                        onClick={() => setShowTokenASelect(true)}
                        className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          {tokenA.logoURI && (
                            <img src={tokenA.logoURI} alt={tokenA.symbol} className="w-6 h-6 rounded-full" />
                          )}
                          <div className="text-left">
                            <p className="font-semibold">{tokenA.symbol}</p>
                            <p className="text-xs text-gray-400">{tokenA.name}</p>
                          </div>
                        </div>
                        <Icon icon={FaChevronDown} className="text-gray-400" />
                      </button>
                      <input
                        type="number"
                        value={amountA}
                        onChange={(e) => setAmountA(e.target.value)}
                        placeholder="Amount (optional)"
                        className="w-full mt-2 p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Token B</label>
                      <button
                        onClick={() => setShowTokenBSelect(true)}
                        className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          {tokenB.logoURI && (
                            <img src={tokenB.logoURI} alt={tokenB.symbol} className="w-6 h-6 rounded-full" />
                          )}
                          <div className="text-left">
                            <p className="font-semibold">{tokenB.symbol}</p>
                            <p className="text-xs text-gray-400">{tokenB.name}</p>
                          </div>
                        </div>
                        <Icon icon={FaChevronDown} className="text-gray-400" />
                      </button>
                      <input
                        type="number"
                        value={amountB}
                        onChange={(e) => setAmountB(e.target.value)}
                        placeholder="Amount (optional)"
                        className="w-full mt-2 p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500"
                      />
                    </div>
                  </div>

                  {/* Discount Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Discount %</label>
                      <input
                        type="number"
                        value={discountPercentage}
                        onChange={(e) => setDiscountPercentage(e.target.value)}
                        placeholder="5"
                        min="0.1"
                        max="50"
                        step="0.1"
                        className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Min Trade Size</label>
                      <input
                        type="number"
                        value={minTradeSize}
                        onChange={(e) => setMinTradeSize(e.target.value)}
                        placeholder="100"
                        className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Duration (days)</label>
                      <input
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        placeholder="7"
                        min="1"
                        max="365"
                        className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white"
                      />
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <p className="text-sm text-blue-400">
                      💡 Create a discount pool to incentivize trading of your token pair. 
                      Traders will receive {discountPercentage}% off when trading between {tokenA.symbol} and {tokenB.symbol}.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={onClose}
                      className="px-6 py-3 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateDiscountPool}
                      disabled={isCreating}
                      className="px-6 py-3 rounded-lg bg-gradient-to-r from-green-400 to-blue-500 text-white font-semibold hover:shadow-lg hover:shadow-green-400/30 transition-all disabled:opacity-50"
                    >
                      {isCreating ? 'Creating...' : 'Create Pool'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Token Select Modals */}
      <TokenSelectModal
        isOpen={showTokenASelect}
        onClose={() => setShowTokenASelect(false)}
        onSelect={(token: Token) => {
          setTokenA(token);
          setShowTokenASelect(false);
        }}
        selectedToken={tokenA}
      />
      <TokenSelectModal
        isOpen={showTokenBSelect}
        onClose={() => setShowTokenBSelect(false)}
        onSelect={(token: Token) => {
          setTokenB(token);
          setShowTokenBSelect(false);
        }}
        selectedToken={tokenB}
      />
    </>
  );
};

const CreateAffiliateModal: React.FC<CreateAffiliateModalProps> = ({ isOpen, onClose }) => {
  const { address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const [projectAddress, setProjectAddress] = useState('');
  const [token, setToken] = useState<Token>(DEFAULT_TOKENS[0] || {
    address: '',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logoURI: ''
  });
  const [discountPercentage, setDiscountPercentage] = useState('10');
  const [affiliateCommission, setAffiliateCommission] = useState('30');
  const [duration, setDuration] = useState('30');
  const [maxUsagePerUser, setMaxUsagePerUser] = useState('5');
  const [isCreating, setIsCreating] = useState(false);
  const [showTokenSelect, setShowTokenSelect] = useState(false);

  const handleCreateAffiliate = async () => {
    if (!address || !walletProvider) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!ethers.utils.isAddress(projectAddress)) {
      toast.error('Please enter a valid project address');
      return;
    }

    setIsCreating(true);
    try {
      const provider = new ethers.providers.Web3Provider(walletProvider as any);
      const signer = provider.getSigner();
      
      // Use liquidity manager for affiliate discounts
      const liquidityManagerContract = new ethers.Contract(
        CONTRACTS.LIQUIDITY_MANAGER, 
        DEALIX_ABI, // This should be LIQUIDITY_MANAGER_ABI when available
        signer
      );

      const params = {
        project: projectAddress,
        token: token.address,
        discountPercentage: parseFloat(discountPercentage) * 100, // Convert to basis points
        affiliateCommission: parseFloat(affiliateCommission) * 100, // Convert to basis points
        duration: parseInt(duration) * 24 * 60 * 60, // Convert days to seconds
        maxUsagePerUser: parseInt(maxUsagePerUser)
      };

      const tx = await liquidityManagerContract.createAffiliateDiscount(params);
      toast.loading('Creating affiliate discount...', { id: 'create-affiliate' });
      const receipt = await tx.wait();
      
      toast.success('Affiliate discount created successfully!', { id: 'create-affiliate' });
      onClose();
    } catch (error: any) {
      console.error('Error creating affiliate discount:', error);
      toast.error(error.message || 'Failed to create affiliate discount');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
              onClick={onClose}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
            >
              <div className="glass rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white">Create Affiliate Discount</h2>
                  <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <Icon icon={FaPlus} className="rotate-45" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Project Address */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Project Address</label>
                    <input
                      type="text"
                      value={projectAddress}
                      onChange={(e) => setProjectAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500"
                    />
                  </div>

                  {/* Token Selection */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Discount Token</label>
                    <button
                      onClick={() => setShowTokenSelect(true)}
                      className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        {token.logoURI && (
                          <img src={token.logoURI} alt={token.symbol} className="w-6 h-6 rounded-full" />
                        )}
                        <div className="text-left">
                          <p className="font-semibold">{token.symbol}</p>
                          <p className="text-xs text-gray-400">{token.name}</p>
                        </div>
                      </div>
                      <Icon icon={FaChevronDown} className="text-gray-400" />
                    </button>
                  </div>

                  {/* Discount Settings */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Discount %</label>
                      <input
                        type="number"
                        value={discountPercentage}
                        onChange={(e) => setDiscountPercentage(e.target.value)}
                        placeholder="10"
                        min="1"
                        max="50"
                        className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Your Commission %</label>
                      <input
                        type="number"
                        value={affiliateCommission}
                        onChange={(e) => setAffiliateCommission(e.target.value)}
                        placeholder="30"
                        min="10"
                        max="50"
                        className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Duration (days)</label>
                      <input
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        placeholder="30"
                        min="1"
                        max="365"
                        className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Max Uses Per User</label>
                      <input
                        type="number"
                        value={maxUsagePerUser}
                        onChange={(e) => setMaxUsagePerUser(e.target.value)}
                        placeholder="5"
                        min="1"
                        max="100"
                        className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-white"
                      />
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                    <p className="text-sm text-purple-400">
                      💰 Create an affiliate discount for the project. Users get {discountPercentage}% off, 
                      and you earn {affiliateCommission}% of the discount amount as commission!
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={onClose}
                      className="px-6 py-3 rounded-lg bg-white/5 text-white hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateAffiliate}
                      disabled={isCreating}
                      className="px-6 py-3 rounded-lg bg-gradient-to-r from-purple-400 to-pink-500 text-white font-semibold hover:shadow-lg hover:shadow-purple-400/30 transition-all disabled:opacity-50"
                    >
                      {isCreating ? 'Creating...' : 'Create Affiliate'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Token Select Modal */}
      <TokenSelectModal
        isOpen={showTokenSelect}
        onClose={() => setShowTokenSelect(false)}
        onSelect={(selectedToken: Token) => {
          setToken(selectedToken);
          setShowTokenSelect(false);
        }}
        selectedToken={token}
      />
    </>
  );
};

export const DealixHub: React.FC = () => {
  const { hasDealixId, dealixProfile, userBadges } = useDealix();
  const { address } = useAppKitAccount();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showAffiliateModal, setShowAffiliateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'discounts' | 'affiliate'>('overview');

  if (!hasDealixId) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {/* Welcome Section for Non-ID Holders */}
          <div className="text-center mb-12">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-bold text-white mb-4"
            >
              Welcome to Dealix
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-gray-400"
            >
              Your gateway to social trading and exclusive rewards
            </motion.p>
          </div>

          {/* Hero Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-3xl p-8 md:p-12 text-center mb-8"
          >
            <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
              <Icon icon={FaIdCard} className="text-white text-6xl" />
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-4">Create Your Dealix ID</h2>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
              Join thousands of traders who are already earning rewards, unlocking discounts, 
              and building their on-chain reputation with Dealix.
            </p>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-green-400 to-blue-500 text-white font-bold text-lg hover:shadow-lg hover:shadow-green-400/30 transition-all transform hover:scale-105"
            >
              Create Dealix ID →
            </button>
          </motion.div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-2xl p-6 text-center"
            >
              <Icon icon={FaGift} className="text-green-400 text-4xl mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Trading Discounts</h3>
              <p className="text-gray-400">Save 2-5% on every trade with tier-based discounts</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass rounded-2xl p-6 text-center"
            >
              <Icon icon={FaTrophy} className="text-yellow-400 text-4xl mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Earn Badges</h3>
              <p className="text-gray-400">Collect achievements and show off your trading skills</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="glass rounded-2xl p-6 text-center"
            >
              <Icon icon={FaUsers} className="text-purple-400 text-4xl mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Join Community</h3>
              <p className="text-gray-400">Access exclusive deals and affiliate programs</p>
            </motion.div>
          </div>

          {/* Stats Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="glass rounded-2xl p-8 text-center"
          >
            <h3 className="text-2xl font-bold text-white mb-6">Platform Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="text-4xl font-bold text-green-400">0</p>
                <p className="text-gray-400 mt-2">Active Traders</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-blue-400">$0</p>
                <p className="text-gray-400 mt-2">Total Volume</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-purple-400">0</p>
                <p className="text-gray-400 mt-2">Badges Earned</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <CreateDealixModal 
          isOpen={showCreateModal} 
          onClose={() => setShowCreateModal(false)} 
        />
      </>
    );
  }

  // Content for users WITH Dealix ID
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Dealix Dashboard</h1>
        <p className="text-gray-400">Manage your trading identity and rewards</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center mb-8">
        <div className="glass rounded-lg p-1 flex space-x-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'overview' 
                ? 'bg-white/10 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('discounts')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'discounts' 
                ? 'bg-white/10 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Discounts
          </button>
          <button
            onClick={() => setActiveTab('affiliate')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'affiliate' 
                ? 'bg-white/10 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Affiliate
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Profile Card */}
            <div className="mb-8">
              <DealixIDCard />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="glass rounded-xl p-6">
                <h3 className="text-gray-400 text-sm mb-2">Total Volume</h3>
                <p className="text-2xl font-bold text-white">
                  ${dealixProfile ? formatBalance(dealixProfile.totalVolume, 2) : '0'}
                </p>
              </div>
              <div className="glass rounded-xl p-6">
                <h3 className="text-gray-400 text-sm mb-2">Trading Streak</h3>
                <p className="text-2xl font-bold text-orange-400">
                  {dealixProfile?.streak || 0} Days
                </p>
              </div>
              <div className="glass rounded-xl p-6">
                <h3 className="text-gray-400 text-sm mb-2">Badges Earned</h3>
                <p className="text-2xl font-bold text-purple-400">
                  {dealixProfile?.badges || 0}
                </p>
              </div>
            </div>

            {/* Badges Section */}
            {userBadges.length > 0 && (
              <div className="glass rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Your Badges</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {userBadges.filter((b: any) => b.owned).map((badge: any) => (
                    <div key={badge.id} className="text-center">
                      <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-gradient-to-r from-purple-400 to-pink-500 flex items-center justify-center">
                        <Icon icon={FaTrophy} className="text-white text-2xl" />
                      </div>
                      <p className="text-sm text-white">{badge.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions - Now part of overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowDiscountModal(true)}
                className="glass rounded-xl p-6 text-left hover:bg-white/5 transition-all"
              >
                <Icon icon={FaTag} className="text-green-400 text-3xl mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Create Discount</h3>
                <p className="text-gray-400 text-sm">Launch a new discount pool</p>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAffiliateModal(true)}
                className="glass rounded-xl p-6 text-left hover:bg-white/5 transition-all"
              >
                <Icon icon={FaHandshake} className="text-purple-400 text-3xl mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Affiliate Program</h3>
                <p className="text-gray-400 text-sm">Partner with projects</p>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="glass rounded-xl p-6 text-left hover:bg-white/5 transition-all"
              >
                <Icon icon={FaRocket} className="text-orange-400 text-3xl mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Boost Trading</h3>
                <p className="text-gray-400 text-sm">Coming soon...</p>
              </motion.button>
            </div>
          </motion.div>
        )}

        {activeTab === 'discounts' && (
          <motion.div
            key="discounts"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowDiscountModal(true)}
                className="glass rounded-xl p-6 text-left hover:bg-white/5 transition-all"
              >
                <Icon icon={FaTag} className="text-green-400 text-3xl mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Create Discount Pool</h3>
                <p className="text-gray-400">Incentivize trading with token discounts</p>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="glass rounded-xl p-6 text-left hover:bg-white/5 transition-all opacity-50 cursor-not-allowed"
              >
                <Icon icon={FaChartLine} className="text-blue-400 text-3xl mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">My Discount Pools</h3>
                <p className="text-gray-400">Manage your active discount pools</p>
              </motion.button>
            </div>

            {/* Active Discounts */}
            <ActiveDiscountPools />
            
            {/* My Discount Pools */}
            <div className="mt-6">
              <ActiveDiscountPools userAddress={address} filterByUser={true} />
            </div>
          </motion.div>
        )}

        {activeTab === 'affiliate' && (
          <motion.div
            key="affiliate"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAffiliateModal(true)}
                className="glass rounded-xl p-6 text-left hover:bg-white/5 transition-all"
              >
                <Icon icon={FaHandshake} className="text-purple-400 text-3xl mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Create Affiliate Program</h3>
                <p className="text-gray-400">Partner with projects and earn commissions</p>
              </motion.button>

              <motion.div className="glass rounded-xl p-6">
                <Icon icon={FaRocket} className="text-orange-400 text-3xl mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Affiliate Earnings</h3>
                <p className="text-3xl font-bold text-green-400">
                  ${dealixProfile ? formatBalance(dealixProfile.affiliateEarnings, 2) : '0'}
                </p>
              </motion.div>
            </div>

            {/* Active Programs */}
            <div className="glass rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Your Affiliate Programs</h3>
              <p className="text-gray-400">No active affiliate programs yet. Create one to start earning!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <CreateDiscountModal isOpen={showDiscountModal} onClose={() => setShowDiscountModal(false)} />
      <CreateAffiliateModal isOpen={showAffiliateModal} onClose={() => setShowAffiliateModal(false)} />
    </motion.div>
  );
};
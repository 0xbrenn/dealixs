import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { Token } from '../../types';
import { TokenInput } from '../common/TokenInput';
import { useAppKit } from '@reown/appkit/react';
import { calculatePoolShare, calculateLiquidityMinted } from '../../utils/calculations';
import { FACTORY_ADDRESS, FACTORY_ABI, PAIR_ABI, WETH_ADDRESS } from '../../constants/contracts';

interface AddLiquidityProps {
  tokenA: Token;
  tokenB: Token;
  amountA: string;
  amountB: string;
  onAmountAChange: (value: string) => void;
  onAmountBChange: (value: string) => void;
  onTokenASelect: () => void;
  onTokenBSelect: () => void;
  onAddLiquidity: () => void;
  loading?: boolean;
  disabled?: boolean;
  isConnected?: boolean;
  walletProvider?: any;
}

export const AddLiquidity: React.FC<AddLiquidityProps> = ({
  tokenA,
  tokenB,
  amountA,
  amountB,
  onAmountAChange,
  onAmountBChange,
  onTokenASelect,
  onTokenBSelect,
  onAddLiquidity,
  loading = false,
  disabled = false,
  isConnected = false,
  walletProvider
}) => {
  const { open } = useAppKit();
  const [poolInfo, setPoolInfo] = useState<{
    exists: boolean;
    reserve0?: string;
    reserve1?: string;
    totalSupply?: string;
    poolShare?: string;
    lpTokens?: string;
  }>({ exists: false });

  // Fetch pool information
  useEffect(() => {
    const fetchPoolInfo = async () => {
      if (!walletProvider || !tokenA || !tokenB) {
        setPoolInfo({ exists: false });
        return;
      }

      try {
        const provider = new ethers.providers.Web3Provider(walletProvider);
        const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
        
        // Convert native OPN to WOPN for pair lookup
        const actualTokenA = tokenA.address === '0x0000000000000000000000000000000000000000' 
          ? { ...tokenA, address: WETH_ADDRESS }
          : tokenA;
        
        const actualTokenB = tokenB.address === '0x0000000000000000000000000000000000000000'
          ? { ...tokenB, address: WETH_ADDRESS }
          : tokenB;
        
        // Get pair address
        const token0 = actualTokenA.address.toLowerCase() < actualTokenB.address.toLowerCase() ? actualTokenA : actualTokenB;
        const token1 = actualTokenA.address.toLowerCase() < actualTokenB.address.toLowerCase() ? actualTokenB : actualTokenA;
        const pairAddress = await factoryContract.getPair(token0.address, token1.address);
        
        if (pairAddress === '0x0000000000000000000000000000000000000000') {
          setPoolInfo({ exists: false });
          return;
        }

        // Get pair contract info
        const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
        const [reserves, totalSupply] = await Promise.all([
          pairContract.getReserves(),
          pairContract.totalSupply()
        ]);

        // Map reserves to tokenA and tokenB
        let reserveA, reserveB;
        if (actualTokenA.address.toLowerCase() < actualTokenB.address.toLowerCase()) {
          reserveA = reserves[0];
          reserveB = reserves[1];
        } else {
          reserveA = reserves[1];
          reserveB = reserves[0];
        }

        setPoolInfo({
          exists: true,
          reserve0: reserveA.toString(),
          reserve1: reserveB.toString(),
          totalSupply: totalSupply.toString()
        });
      } catch (error) {
        console.error('Error fetching pool info:', error);
        setPoolInfo({ exists: false });
      }
    };

    fetchPoolInfo();
  }, [tokenA, tokenB, walletProvider]);

  // Calculate pool share and LP tokens
  useEffect(() => {
    if (!poolInfo.exists || !amountA || !amountB || parseFloat(amountA) === 0 || parseFloat(amountB) === 0) {
      setPoolInfo(prev => ({ ...prev, poolShare: undefined, lpTokens: undefined }));
      return;
    }

    try {
      // Parse amounts
      const amountABN = ethers.utils.parseUnits(amountA, tokenA.decimals);
      const amountBBN = ethers.utils.parseUnits(amountB, tokenB.decimals);

      if (poolInfo.totalSupply === '0') {
        // New pool - first liquidity provider
        // Use the calculateLiquidityMinted function which handles sqrt internally
        const lpTokens = calculateLiquidityMinted(
          amountABN.toString(),
          amountBBN.toString(),
          '0', // no reserves for new pool
          '0', // no reserves for new pool
          '0'  // no total supply for new pool
        );
        
        setPoolInfo(prev => ({
          ...prev,
          poolShare: '100.00',
          lpTokens: ethers.utils.formatUnits(lpTokens, 18)
        }));
      } else {
        // Calculate LP tokens to be minted
        const lpTokens = calculateLiquidityMinted(
          amountABN.toString(),
          amountBBN.toString(),
          poolInfo.reserve0!,
          poolInfo.reserve1!,
          poolInfo.totalSupply!
        );

        // Calculate pool share
        const newTotalSupply = ethers.BigNumber.from(poolInfo.totalSupply).add(lpTokens);
        const poolShare = calculatePoolShare(lpTokens, newTotalSupply.toString());

        setPoolInfo(prev => ({
          ...prev,
          poolShare: poolShare.toFixed(2),
          lpTokens: ethers.utils.formatUnits(lpTokens, 18)
        }));
      }
    } catch (error) {
      console.error('Error calculating pool metrics:', error);
    }
  }, [amountA, amountB, poolInfo.exists, poolInfo.reserve0, poolInfo.reserve1, poolInfo.totalSupply, tokenA.decimals, tokenB.decimals]);

  const handleButtonClick = async () => {
    if (!isConnected) {
      await open();
    } else {
      onAddLiquidity();
    }
  };

  // Determine button text and state
  let buttonText = 'Connect Wallet';
  let isDisabled = false;

  if (isConnected) {
    if (!amountA || !amountB) {
      buttonText = 'Enter Amounts';
      isDisabled = true;
    } else if (disabled) {
      buttonText = 'Add Liquidity';
      isDisabled = true;
    } else {
      buttonText = 'Add Liquidity';
      isDisabled = false;
    }
  }

  return (
    <div className="space-y-4">
      <TokenInput
        value={amountA}
        onChange={onAmountAChange}
        token={tokenA}
        onTokenSelect={onTokenASelect}
        label="Input"
        balance={tokenA.balance}
        onMax={() => onAmountAChange(tokenA.balance || '0')}
      />

      <div className="flex justify-center -my-2 relative z-10">
        <div className="p-3 glass rounded-2xl border border-white/10">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      </div>

      <TokenInput
        value={amountB}
        onChange={onAmountBChange}
        token={tokenB}
        onTokenSelect={onTokenBSelect}
        label="Input"
        balance={tokenB.balance}
        onMax={() => onAmountBChange(tokenB.balance || '0')}
      />

      {/* Show notice for native OPN */}
      {(tokenA.address === '0x0000000000000000000000000000000000000000' || 
        tokenB.address === '0x0000000000000000000000000000000000000000') && (
        <div className="glass rounded-xl p-3 border border-yellow-500/20 bg-yellow-500/5">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-yellow-200">
              OPN will be automatically wrapped to WOPN when adding liquidity
            </p>
          </div>
        </div>
      )}

      {/* Pool metrics */}
      {amountA && amountB && parseFloat(amountA) > 0 && parseFloat(amountB) > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden"
        >
          <div className="glass rounded-2xl p-4 space-y-3">
            {!poolInfo.exists && (
              <div className="text-center py-2">
                <p className="text-yellow-400 text-sm font-medium">🆕 New Pool</p>
                <p className="text-gray-400 text-xs mt-1">You are the first liquidity provider!</p>
              </div>
            )}
            
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">Pool Share</span>
              <span className="text-white text-sm font-medium">
                {poolInfo.poolShare ? `${poolInfo.poolShare}%` : 'Calculating...'}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-500 text-sm">LP Tokens</span>
              <span className="text-white text-sm font-medium">
                {poolInfo.lpTokens ? parseFloat(poolInfo.lpTokens).toFixed(6) : 'Calculating...'}
              </span>
            </div>

            {poolInfo.exists && (
              <div className="pt-2 border-t border-white/10">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Current Pool Size</span>
                  <div className="text-right">
                    <div className="text-gray-400">
                      {parseFloat(ethers.utils.formatUnits(poolInfo.reserve0 || '0', tokenA.decimals)).toFixed(2)} {tokenA.symbol}
                    </div>
                    <div className="text-gray-400">
                      {parseFloat(ethers.utils.formatUnits(poolInfo.reserve1 || '0', tokenB.decimals)).toFixed(2)} {tokenB.symbol}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      <motion.div
        whileHover={!loading ? { scale: 1.02 } : {}}
        whileTap={!loading ? { scale: 0.98 } : {}}
      >
        <button
          onClick={handleButtonClick}
          disabled={loading || isDisabled}
          className={`w-full py-4 px-6 rounded-2xl font-semibold transition-all duration-200 ${
            loading || isDisabled
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl'
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </div>
          ) : (
            buttonText
          )}
        </button>
      </motion.div>
    </div>
  );
};
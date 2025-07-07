import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import './config/appkit';
import { PoolsInterface } from './components/pools/PoolsInterface';
import { FarmingInterface } from './components/farming/FarmingInterface';

// Components
import { Header } from './components/common/Header';
import { TokenSelector } from './components/common/TokenSelector';
import { SwapInterface } from './components/swap/SwapInterface';
import { LiquidityInterface } from './components/liquidity/LiquidityInterface';
import { AddLiquidity } from './components/liquidity/AddLiquidity';
import { RemoveLiquidity } from './components/liquidity/RemoveLiquidity';

// Types
import { Token, TabType, LiquidityTabType, LiquidityPosition } from './types';

// Constants
import { DEFAULT_TOKENS } from './constants/tokens';
import { ROUTER_ADDRESS, FACTORY_ADDRESS, ROUTER_ABI, FACTORY_ABI, PAIR_ABI, ERC20_ABI, WETH_ADDRESS } from './constants/contracts';

// Hooks
import { useTokenBalances } from './hooks/useTokenBalances';
import { useSwap } from './hooks/useSwap';

// Utils
import { formatBalance } from './utils/formatters';
import { isValidAmount } from './utils/validators';

// Helper function for explorer URLs
const getExplorerUrl = (txHash: string) => {
  return `https://testnet.iopn.tech/tx/${txHash}`;
};

export default function App() {
  // Wallet connection
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");

  // Token balances hook
  const { tokenBalances, loadTokenBalances } = useTokenBalances();

  // Swap hook
  const { executeSwap: executeSwapTransaction, calculateSwapOutput, loading: swapLoading } = useSwap();

  // UI State
  const [activeTab, setActiveTab] = useState<TabType>('swap');
  const [liquidityTab, setLiquidityTab] = useState<LiquidityTabType>('add');
  const [showTokenSelector, setShowTokenSelector] = useState<'from' | 'to' | 'tokenA' | 'tokenB' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Swap State
  const [fromToken, setFromToken] = useState<Token>(DEFAULT_TOKENS[0]);
  const [toToken, setToToken] = useState<Token>(DEFAULT_TOKENS[2]);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');

  // Liquidity State
  const [tokenA, setTokenA] = useState<Token>(DEFAULT_TOKENS[0]);
  const [tokenB, setTokenB] = useState<Token>(DEFAULT_TOKENS[2]);
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [liquidityPositions, setLiquidityPositions] = useState<LiquidityPosition[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<LiquidityPosition | null>(null);
  const [removeAmount, setRemoveAmount] = useState('');
  const [removePercentage, setRemovePercentage] = useState(25);

  // Update token balances when they change
  useEffect(() => {
    setFromToken(prev => ({ ...prev, balance: tokenBalances[prev.address] }));
    setToToken(prev => ({ ...prev, balance: tokenBalances[prev.address] }));
    setTokenA(prev => ({ ...prev, balance: tokenBalances[prev.address] }));
    setTokenB(prev => ({ ...prev, balance: tokenBalances[prev.address] }));
  }, [tokenBalances]);

  const formatForParsing = (amount: string, decimals: number): string => {
    try {
      const num = parseFloat(amount);
      if (isNaN(num)) return '0';
      
      // Limit to 6 decimal places for safety, or token decimals if less
      const maxDecimals = Math.min(6, decimals);
      return num.toFixed(maxDecimals);
    } catch {
      return '0';
    }
  };

  // Calculate swap output using the new hook
  const calculateOutput = useCallback(async (amount: string) => {
    if (!isValidAmount(amount) || !fromToken || !toToken) {
      setToAmount('');
      return;
    }

    setCalculating(true);
    try {
      const output = await calculateSwapOutput(fromToken, toToken, amount);
      setToAmount(output);
    } catch (error) {
      console.error('Error calculating output:', error);
      setToAmount('0');
    } finally {
      setCalculating(false);
    }
  }, [fromToken, toToken, calculateSwapOutput]);

  // Calculate liquidity amounts
const calculateLiquidityAmounts = useCallback(async (inputField: 'A' | 'B', value: string) => {
  if (!walletProvider || !value || parseFloat(value) === 0) {
    if (inputField === 'A') setAmountB('');
    else setAmountA('');
    return;
  }

  try {
    const provider = new ethers.providers.Web3Provider(walletProvider as any);
    const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
    
    // Convert native OPN to WOPN for pair lookup
    const actualTokenA = tokenA.address === '0x0000000000000000000000000000000000000000' 
      ? { ...tokenA, address: WETH_ADDRESS }
      : tokenA;
    
    const actualTokenB = tokenB.address === '0x0000000000000000000000000000000000000000'
      ? { ...tokenB, address: WETH_ADDRESS }
      : tokenB;
    
    // Determine token0 and token1 based on address ordering
    const isToken0First = actualTokenA.address.toLowerCase() < actualTokenB.address.toLowerCase();
    const token0 = isToken0First ? actualTokenA : actualTokenB;
    const token1 = isToken0First ? actualTokenB : actualTokenA;
    
    const pairAddress = await factoryContract.getPair(token0.address, token1.address);
    
    if (pairAddress === '0x0000000000000000000000000000000000000000') {
      // New pair - any ratio is fine
      console.log('No pair exists - free ratio');
      return;
    }

    const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
    const reserves = await pairContract.getReserves();
    
    // Map reserves correctly based on token ordering
    let reserveA: ethers.BigNumber, reserveB: ethers.BigNumber;
    if (isToken0First) {
      reserveA = reserves[0];
      reserveB = reserves[1];
    } else {
      reserveA = reserves[1];
      reserveB = reserves[0];
    }

    console.log('Reserves:', {
      reserveA: reserveA.toString(),
      reserveB: reserveB.toString()
    });

    // Check if both reserves are zero (pair exists but no liquidity)
    if (reserveA.isZero() && reserveB.isZero()) {
      console.log('Pair exists but has no liquidity - free ratio allowed');
      // Don't calculate ratio - allow any amounts
      return;
    }

    // Check if either reserve is zero (shouldn't happen in normal pairs)
    if (reserveA.isZero() || reserveB.isZero()) {
      console.log('One reserve is zero - cannot calculate ratio');
      return;
    }

    // Normal ratio calculation for pairs with liquidity
    if (inputField === 'A' && value) {
      try {
        const valueBN = ethers.utils.parseUnits(value, tokenA.decimals);
        const amountBBN = valueBN.mul(reserveB).div(reserveA);
        const amountBFormatted = ethers.utils.formatUnits(amountBBN, tokenB.decimals);
        setAmountB(amountBFormatted);
      } catch (err) {
        console.error('Error calculating amount B:', err);
        setAmountB('');
      }
    } else if (inputField === 'B' && value) {
      try {
        const valueBN = ethers.utils.parseUnits(value, tokenB.decimals);
        const amountABN = valueBN.mul(reserveA).div(reserveB);
        const amountAFormatted = ethers.utils.formatUnits(amountABN, tokenA.decimals);
        setAmountA(amountAFormatted);
      } catch (err) {
        console.error('Error calculating amount A:', err);
        setAmountA('');
      }
    }
  } catch (error) {
    console.error('Error in calculateLiquidityAmounts:', error);
  }
}, [tokenA, tokenB, walletProvider]);

  // Load liquidity positions
  const loadLiquidityPositions = useCallback(async () => {
    if (!address || !walletProvider) return;

    try {
      const provider = new ethers.providers.Web3Provider(walletProvider as any);
      const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      
      const positions: LiquidityPosition[] = [];
      
      // Get all pairs
      const pairLength = await factoryContract.allPairsLength();
      
      // Create an array of promises for parallel execution
      const promises = [];
      const checkLimit = Math.min(10, pairLength.toNumber());
      
      for (let i = pairLength.toNumber() - checkLimit; i < pairLength.toNumber(); i++) {
        promises.push(
          (async () => {
            try {
              const pairAddress = await factoryContract.allPairs(i);
              const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
              
              const balance = await pairContract.balanceOf(address);
              if (balance.gt(0)) {
                const [token0Address, token1Address, reserves, totalSupply] = await Promise.all([
                  pairContract.token0(),
                  pairContract.token1(),
                  pairContract.getReserves(),
                  pairContract.totalSupply()
                ]);

                // Get token info
                const token0Contract = new ethers.Contract(token0Address, ERC20_ABI, provider);
                const token1Contract = new ethers.Contract(token1Address, ERC20_ABI, provider);
                
                const [symbol0, symbol1, decimals0, decimals1] = await Promise.all([
                  token0Contract.symbol(),
                  token1Contract.symbol(),
                  token0Contract.decimals(),
                  token1Contract.decimals()
                ]);

                const poolShare = balance.mul(10000).div(totalSupply).toNumber() / 100;
                const token0Deposited = balance.mul(reserves[0]).div(totalSupply);
                const token1Deposited = balance.mul(reserves[1]).div(totalSupply);

                return {
                  pair: pairAddress,
                  token0: {
                    address: token0Address,
                    symbol: symbol0,
                    name: symbol0,
                    decimals: decimals0,
                    logoURI: DEFAULT_TOKENS.find(t => t.address === token0Address)?.logoURI
                  },
                  token1: {
                    address: token1Address,
                    symbol: symbol1,
                    name: symbol1,
                    decimals: decimals1,
                    logoURI: DEFAULT_TOKENS.find(t => t.address === token1Address)?.logoURI
                  },
                  balance: balance.toString(),
                  totalSupply: totalSupply.toString(),
                  reserve0: reserves[0].toString(),
                  reserve1: reserves[1].toString(),
                  poolShare: poolShare.toFixed(2),
                  token0Deposited: ethers.utils.formatUnits(token0Deposited, decimals0),
                  token1Deposited: ethers.utils.formatUnits(token1Deposited, decimals1)
                };
              }
              return null;
            } catch (error) {
              console.error(`Error loading pair ${i}:`, error);
              return null;
            }
          })()
        );
      }

      // Wait for all promises and filter out nulls
      const results = await Promise.all(promises);
      const validPositions = results.filter(pos => pos !== null) as LiquidityPosition[];
      
      setLiquidityPositions(validPositions);
    } catch (error) {
      console.error('Error loading liquidity positions:', error);
    }
  }, [address, walletProvider]);

// Handle pool selection from Pools tab
// Replace your existing handlePoolSelection function in App.tsx with this:

const handlePoolSelection = useCallback(async (token0Address: string, token1Address: string) => {
  // If empty addresses, just switch to liquidity tab
  if (!token0Address || !token1Address) {
    setActiveTab('liquidity');
    setLiquidityTab('add');
    return;
  }

  const loadingToast = toast.loading('Loading pool information...');
  
  try {
    if (!walletProvider) {
      throw new Error('No wallet provider available');
    }

    const provider = new ethers.providers.Web3Provider(walletProvider as any);
    
    const getTokenInfo = async (tokenAddress: string): Promise<Token> => {
      try {
        // Check if it's WETH/wOPN - convert to native OPN
        if (tokenAddress.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
          // Get native OPN balance
          const balance = address ? await provider.getBalance(address) : ethers.BigNumber.from(0);
          
          return {
            address: '0x0000000000000000000000000000000000000000', // Native OPN address
            symbol: 'OPN',
            name: 'OPNToken',
            decimals: 18,
            logoURI: 'https://i.ibb.co/dN1sMhw/logo.jpg',
            balance: ethers.utils.formatEther(balance)
          };
        }
        
        // For other tokens, get the actual token info
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        
        // Get token info
        const [symbol, name, decimals] = await Promise.all([
          tokenContract.symbol(),
          tokenContract.name(),
          tokenContract.decimals()
        ]);
        
        // Get balance if user is connected
        let balance = '0';
        if (address) {
          const balanceRaw = await tokenContract.balanceOf(address);
          balance = ethers.utils.formatUnits(balanceRaw, decimals);
        }
        
        // Find logo from DEFAULT_TOKENS
        const tokenInfo = DEFAULT_TOKENS.find(t => t.address.toLowerCase() === tokenAddress.toLowerCase());
        
        return {
          address: tokenAddress,
          symbol,
          name,
          decimals,
          balance,
          logoURI: tokenInfo?.logoURI || ''
        };
      } catch (error) {
        console.error(`Failed to load token info for ${tokenAddress}:`, error);
        throw new Error(`Failed to load token at ${tokenAddress}`);
      }
    };
    
    // Load both tokens
    const [token0, token1] = await Promise.all([
      getTokenInfo(token0Address),
      getTokenInfo(token1Address)
    ]);
    
    // Update liquidity tokens
    setTokenA(token0);
    setTokenB(token1);
    
    // Switch to liquidity tab
    setActiveTab('liquidity');
    setLiquidityTab('add');
    
    // Clear amounts when switching
    setAmountA('');
    setAmountB('');
    
    toast.success(`Selected ${token0.symbol}/${token1.symbol} pool`, {
      id: loadingToast,
      style: {
        background: 'rgba(10, 10, 11, 0.95)',
        color: '#fff',
        border: '1px solid rgba(16, 185, 129, 0.2)',
      },
    });
    
  } catch (error: any) {
    console.error('Error loading pool:', error);
    toast.error(error.message || 'Failed to load pool information', {
      id: loadingToast
    });
  }
}, [walletProvider, address]);


  // Handle token swap
  const handleSwapTokens = useCallback(() => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  }, [fromToken, toToken, fromAmount, toAmount]);

  // Execute swap

   const handleSwap = async () => {
  if (!walletProvider || !address) {
    toast.error('Please connect your wallet');
    return;
  }

  if (!isValidAmount(fromAmount) || parseFloat(toAmount) === 0) {
    toast.error('Please enter valid amounts');
    return;
  }

  setLoading(true);
  const loadingToast = toast.loading('Preparing swap...');

  try {
    const receipt = await executeSwapTransaction(
      fromToken,
      toToken,
      fromAmount,
      slippage,
      address
    );

    if (receipt && receipt.status === 1) {
      toast.success(
        <div>
          <div>Swap successful!</div>
          <a 
            href={getExplorerUrl(receipt.transactionHash)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            View on Explorer →
          </a>
        </div>,
        { id: loadingToast, duration: 8000 }
      );
      
      setFromAmount('');
      setToAmount('');
      await loadTokenBalances();
    }
  } catch (error: any) {
    console.error('Swap error:', error);
    
    // Parse error message
    let errorMessage = 'Swap failed';
    
    if (error?.reason || error?.message) {
      const message = error.reason || error.message;
      
      if (message.includes('user rejected')) {
        errorMessage = 'Transaction cancelled';
      } else if (message.includes('insufficient funds')) {
        errorMessage = 'Insufficient balance';
      } else if (message.includes('INSUFFICIENT_LIQUIDITY')) {
        errorMessage = 'Not enough liquidity in the pool';
      } else if (message.includes('K')) {
        errorMessage = 'Price impact too high';
      } else if (message.includes('EXPIRED')) {
        errorMessage = 'Transaction deadline exceeded';
      }
    }
    
    toast.error(errorMessage, { id: loadingToast });
  } finally {
    setLoading(false);
  }
};
  // Add liquidity
  const handleAddLiquidity = useCallback(async () => {
    if (!walletProvider || !address || !isValidAmount(amountA) || !isValidAmount(amountB)) return;

    const toastId = toast.loading(
      <div className="flex flex-col gap-1">
        <span className="font-semibold">Adding liquidity...</span>
        <span className="text-xs text-gray-400">
          {amountA} {tokenA.symbol} + {amountB} {tokenB.symbol}
        </span>
      </div>
    );
    setLoading(true);

    try {
      const provider = new ethers.providers.Web3Provider(walletProvider as any);
      const signer = provider.getSigner();
      const routerContract = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
      const amountADesired = ethers.utils.parseUnits(amountA, tokenA.decimals);
      const amountBDesired = ethers.utils.parseUnits(amountB, tokenB.decimals);
      
      // Check if pair exists
      const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
      const token0 = tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? tokenA : tokenB;
      const token1 = tokenA.address.toLowerCase() < tokenB.address.toLowerCase() ? tokenB : tokenA;
      const pairAddress = await factoryContract.getPair(token0.address, token1.address);
      
      let amountAMin, amountBMin;
      if (pairAddress === '0x0000000000000000000000000000000000000000') {
        // New pair - accept any ratio
        amountAMin = ethers.BigNumber.from(0);
        amountBMin = ethers.BigNumber.from(0);
      } else {
        // Existing pair - use slippage
        amountAMin = amountADesired.mul(50).div(100); // 50% slippage
        amountBMin = amountBDesired.mul(50).div(100); // 50% slippage
      }

      let tx;

      if (tokenA.address === '0x0000000000000000000000000000000000000000' || 
          tokenB.address === '0x0000000000000000000000000000000000000000') {
        // One token is ETH
        const token = tokenA.address === '0x0000000000000000000000000000000000000000' ? tokenB : tokenA;
        const tokenAmount = tokenA.address === '0x0000000000000000000000000000000000000000' ? amountBDesired : amountADesired;
        const ethAmount = tokenA.address === '0x0000000000000000000000000000000000000000' ? amountADesired : amountBDesired;
        const tokenAmountMin = tokenA.address === '0x0000000000000000000000000000000000000000' ? amountBMin : amountAMin;
        const ethAmountMin = tokenA.address === '0x0000000000000000000000000000000000000000' ? amountAMin : amountBMin;

        // Approve tokens first
        const tokenContract = new ethers.Contract(token.address, ERC20_ABI, signer);
        const currentAllowance = await tokenContract.allowance(address, ROUTER_ADDRESS);
        
        if (currentAllowance.lt(tokenAmount)) {
          toast.loading(
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Approving {token.symbol}...</span>
              <span className="text-xs text-gray-400">Please confirm in your wallet</span>
            </div>,
            { id: toastId }
          );
          const approveTx = await tokenContract.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256);
          
          toast.loading(
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Waiting for approval...</span>
              <a 
                href={getExplorerUrl(approveTx.hash)} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
              >
                {approveTx.hash.slice(0, 10)}...{approveTx.hash.slice(-8)}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>,
            { id: toastId }
          );
          await approveTx.wait();
        }

        tx = await routerContract.addLiquidityETH(
          token.address,
          tokenAmount,
          tokenAmountMin,
          ethAmountMin,
          address,
          deadline,
          { value: ethAmount }
        );
      } else {
        // Both are tokens - ensure they are in the correct order
        let token0, token1, amount0Desired, amount1Desired, amount0Min, amount1Min;
        
        if (tokenA.address.toLowerCase() < tokenB.address.toLowerCase()) {
          token0 = tokenA.address;
          token1 = tokenB.address;
          amount0Desired = amountADesired;
          amount1Desired = amountBDesired;
          amount0Min = amountAMin;
          amount1Min = amountBMin;
        } else {
          token0 = tokenB.address;
          token1 = tokenA.address;
          amount0Desired = amountBDesired;
          amount1Desired = amountADesired;
          amount0Min = amountBMin;
          amount1Min = amountAMin;
        }
        // Both are tokens
        // Approve both tokens
        const tokenAContract = new ethers.Contract(tokenA.address, ERC20_ABI, signer);
        const tokenBContract = new ethers.Contract(tokenB.address, ERC20_ABI, signer);
        
        const [allowanceA, allowanceB] = await Promise.all([
          tokenAContract.allowance(address, ROUTER_ADDRESS),
          tokenBContract.allowance(address, ROUTER_ADDRESS)
        ]);
        
        if (allowanceA.lt(amountADesired)) {
          toast.loading(
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Approving {tokenA.symbol}...</span>
              <span className="text-xs text-gray-400">Please confirm in your wallet</span>
            </div>,
            { id: toastId }
          );
          const approveTx = await tokenAContract.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256);
          await approveTx.wait();
        }
        
        if (allowanceB.lt(amountBDesired)) {
          toast.loading(
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Approving {tokenB.symbol}...</span>
              <span className="text-xs text-gray-400">Please confirm in your wallet</span>
            </div>,
            { id: toastId }
          );
          const approveTx = await tokenBContract.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256);
          await approveTx.wait();
        }
        
        tx = await routerContract.addLiquidity(
          token0,
          token1,
          amount0Desired,
          amount1Desired,
          amount0Min,
          amount1Min,
          address,
          deadline
        );
      }

      toast.loading(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Adding liquidity...</span>
          <a 
            href={getExplorerUrl(tx.hash)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
          >
            {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>,
        { id: toastId }
      );
      
      const receipt = await tx.wait();
      
      toast.success(
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Liquidity added!</span>
          <div className="text-xs text-gray-300">
            Added {amountA} {tokenA.symbol} + {amountB} {tokenB.symbol}
          </div>
          <a 
            href={getExplorerUrl(receipt.transactionHash)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-green-400 hover:text-green-300 transition-colors flex items-center gap-1"
          >
            View transaction
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>,
        { 
          id: toastId,
          duration: 10000,
        }
      );
      
      setAmountA('');
      setAmountB('');
      loadTokenBalances();
      loadLiquidityPositions();
    } catch (error: any) {
      console.error('Add liquidity error:', error);
      
      let errorMessage = 'Failed to add liquidity';
      if (error.code === 4001) {
        errorMessage = 'Transaction rejected';
      } else if (error.message?.includes('insufficient')) {
        errorMessage = 'Insufficient balance';
      }
      
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{errorMessage}</span>
          <span className="text-xs text-gray-400 break-all">
            {error.reason || error.message?.slice(0, 100)}
          </span>
        </div>,
        { id: toastId }
      );
    } finally {
      setLoading(false);
    }
  }, [address, amountA, amountB, tokenA, tokenB, walletProvider, loadTokenBalances, loadLiquidityPositions]);

  // Remove liquidity
  const handleRemoveLiquidity = useCallback(async () => {
    if (!walletProvider || !address || !selectedPosition) return;

    const toastId = toast.loading(
      <div className="flex flex-col gap-1">
        <span className="font-semibold">Removing liquidity...</span>
        <span className="text-xs text-gray-400">
          {removePercentage}% of {selectedPosition.token0.symbol}/{selectedPosition.token1.symbol}
        </span>
      </div>
    );
    setLoading(true);

    try {
      const provider = new ethers.providers.Web3Provider(walletProvider as any);
      const signer = provider.getSigner();
      const routerContract = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
      const pairContract = new ethers.Contract(selectedPosition.pair, PAIR_ABI, signer);

      const liquidity = ethers.BigNumber.from(selectedPosition.balance).mul(removePercentage).div(100);
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

      // Approve pair tokens
      const allowance = await pairContract.allowance(address, ROUTER_ADDRESS);
      if (allowance.lt(liquidity)) {
        toast.loading(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Approving LP tokens...</span>
            <span className="text-xs text-gray-400">Please confirm in your wallet</span>
          </div>,
          { id: toastId }
        );
        const approveTx = await pairContract.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256);
        
        toast.loading(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Waiting for approval...</span>
            <a 
              href={getExplorerUrl(approveTx.hash)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
            >
              {approveTx.hash.slice(0, 10)}...{approveTx.hash.slice(-8)}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>,
          { id: toastId }
        );
        await approveTx.wait();
      }

      let tx;
      
      if (selectedPosition.token0.address === WETH_ADDRESS || selectedPosition.token1.address === WETH_ADDRESS) {
        // Remove ETH liquidity
        const token = selectedPosition.token0.address === WETH_ADDRESS ? selectedPosition.token1 : selectedPosition.token0;
        tx = await routerContract.removeLiquidityETH(
          token.address,
          liquidity,
          0, // Accept any amount of tokens
          0, // Accept any amount of ETH
          address,
          deadline
        );
      } else {
        // Remove token liquidity
        tx = await routerContract.removeLiquidity(
          selectedPosition.token0.address,
          selectedPosition.token1.address,
          liquidity,
          0, // Accept any amount of token0
          0, // Accept any amount of token1
          address,
          deadline
        );
      }

      toast.loading(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Removing liquidity...</span>
          <a 
            href={getExplorerUrl(tx.hash)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
          >
            {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>,
        { id: toastId }
      );
      
      const receipt = await tx.wait();
      
      toast.success(
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Liquidity removed!</span>
          <div className="text-xs text-gray-300">
            Removed {removePercentage}% of {selectedPosition.token0.symbol}/{selectedPosition.token1.symbol} position
          </div>
          <a 
            href={getExplorerUrl(receipt.transactionHash)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-green-400 hover:text-green-300 transition-colors flex items-center gap-1"
          >
            View transaction
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>,
        { 
          id: toastId,
          duration: 10000,
        }
      );
      
      // Clear the form state first
      setRemoveAmount('');
      setRemovePercentage(25);
      
      // If removed 100%, remove from UI immediately
      if (removePercentage === 100) {
        setLiquidityPositions(prev => prev.filter(pos => pos.pair !== selectedPosition.pair));
        setSelectedPosition(null);
      } else {
        // Update the position with new balance
        const newBalance = ethers.BigNumber.from(selectedPosition.balance)
          .mul(100 - removePercentage)
          .div(100);
        
        setLiquidityPositions(prev => prev.map(pos => 
          pos.pair === selectedPosition.pair 
            ? {
                ...pos,
                balance: newBalance.toString(),
                poolShare: (parseFloat(pos.poolShare) * (100 - removePercentage) / 100).toFixed(2),
                token0Deposited: (parseFloat(pos.token0Deposited) * (100 - removePercentage) / 100).toString(),
                token1Deposited: (parseFloat(pos.token1Deposited) * (100 - removePercentage) / 100).toString()
              }
            : pos
        ));
      }
      
      // Load fresh data from blockchain
      await Promise.all([
        loadTokenBalances(),
        loadLiquidityPositions()
      ]);
      
    } catch (error: any) {
      console.error('Remove liquidity error:', error);
      
      let errorMessage = 'Failed to remove liquidity';
      if (error.code === 4001) {
        errorMessage = 'Transaction rejected';
      }
      
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{errorMessage}</span>
          <span className="text-xs text-gray-400 break-all">
            {error.reason || error.message?.slice(0, 100)}
          </span>
        </div>,
        { id: toastId }
      );
    } finally {
      setLoading(false);
    }
  }, [address, selectedPosition, removePercentage, walletProvider, loadTokenBalances, loadLiquidityPositions]);

  // Effects
  useEffect(() => {
    if (isConnected) {
      loadTokenBalances();
      loadLiquidityPositions();
    }
  }, [isConnected, loadTokenBalances, loadLiquidityPositions]);

  useEffect(() => {
    if (fromAmount) {
      calculateOutput(fromAmount);
    }
  }, [fromAmount, calculateOutput]);

  useEffect(() => {
    if (liquidityTab === 'add' && amountA) {
      calculateLiquidityAmounts('A', amountA);
    }
  }, [tokenA, tokenB, liquidityTab, amountA, calculateLiquidityAmounts]);

  // Prevent scroll on number inputs
  useEffect(() => {
    const handleWheel = (e: Event) => {
      if (document.activeElement?.getAttribute('type') === 'number') {
        e.preventDefault();
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0B] relative">
      {/* Animated background gradients */}
  <div className="absolute inset-0 overflow-hidden">
    <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-[#00FF4D]/40 via-[#00FF4D]/25 to-cyan-500/20 rounded-full blur-3xl animate-float"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-cyan-400/40 via-[#00FF4D]/30 to-[#00FF4D]/20 rounded-full blur-3xl animate-float-delayed"></div>
      
     
     
      {/* Additional vibrant orbs for depth */}
      <div className="absolute top-2/3 right-1/4 w-48 h-48 bg-gradient-to-br from-[#00FF4D]/25 to-cyan-400/20 rounded-full blur-2xl animate-drift"></div>
      <div className="absolute bottom-2/3 left-2/3 w-36 h-36 bg-gradient-to-tl from-cyan-500/25 to-[#00FF4D]/20 rounded-full blur-xl animate-drift-delayed"></div>
      
</div>

      {/* Noise texture overlay */}
      <div className="fixed inset-0 opacity-[0.015] mix-blend-overlay">
        <svg width="100%" height="100%">
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
      </div>

      <Toaster 
        position="bottom-right"
        toastOptions={{
          duration: 8000,
          style: {
            background: 'rgba(10, 10, 11, 0.95)',
            backdropFilter: 'blur(16px)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '14px',
            maxWidth: '420px',
          },
          success: {
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
            style: {
              border: '1px solid rgba(16, 185, 129, 0.2)',
            },
          },
          error: {
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
            style: {
              border: '1px solid rgba(239, 68, 68, 0.2)',
            },
          },
          loading: {
            style: {
              border: '1px solid rgba(16, 185, 129, 0.2)',
            },
          },
        }}
      />

      {/* Modern Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:py-12 pt-40 sm:pt-36">
  {/* Conditional wrapper based on tab */}
  {(activeTab === 'swap' || activeTab === 'liquidity') ? (
    <div className="w-full max-w-[480px]">
      {activeTab === 'swap' && (
        <SwapInterface
          fromToken={fromToken}
          toToken={toToken}
          fromAmount={fromAmount}
          toAmount={toAmount}
          onFromAmountChange={setFromAmount}
          onFromTokenSelect={() => setShowTokenSelector('from')}
          onToTokenSelect={() => setShowTokenSelector('to')}
          onSwapTokens={handleSwapTokens}
          onSwap={handleSwap}
          isConnected={isConnected}
          loading={loading || swapLoading}
          showSettings={showSettings}
          onSettingsToggle={() => setShowSettings(!showSettings)}
          slippage={slippage}
          onSlippageChange={setSlippage}
        />
      )}

      {activeTab === 'liquidity' && (
        <LiquidityInterface
          activeTab={liquidityTab}
          setActiveTab={setLiquidityTab}
        >
          {liquidityTab === 'add' ? (
            <AddLiquidity
              tokenA={tokenA}
              tokenB={tokenB}
              amountA={amountA}
              amountB={amountB}
              onAmountAChange={(value) => {
                setAmountA(value);
                calculateLiquidityAmounts('A', value);
              }}
              onAmountBChange={(value) => {
                setAmountB(value);
                calculateLiquidityAmounts('B', value);
              }}
              onTokenASelect={() => setShowTokenSelector('tokenA')}
              onTokenBSelect={() => setShowTokenSelector('tokenB')}
              onAddLiquidity={handleAddLiquidity}
              loading={loading}
              disabled={!isConnected || !amountA || !amountB}
              isConnected={isConnected}
              walletProvider={walletProvider}
            />
          ) : (
            <RemoveLiquidity
              position={selectedPosition}
              removePercentage={removePercentage}
              onPercentageChange={setRemovePercentage}
              onRemove={handleRemoveLiquidity}
              loading={loading}
              positions={liquidityPositions}
              onSelectPosition={setSelectedPosition}
            />
          )}
        </LiquidityInterface>
      )}
    </div>
  ) : (
    <div className="w-full">
      {activeTab === 'pools' && (
        <PoolsInterface
          walletProvider={walletProvider}
          onSelectPool={handlePoolSelection}
        />
      )}
      
      {activeTab === 'farm' && (
        <FarmingInterface
          walletProvider={walletProvider}
          address={address}
          isConnected={isConnected}
        />
      )}
    </div>
  )}
</main>
  {/* Global styles */}
    {/* Global styles */}


<style>{`
  @keyframes blob {
    0% {
      transform: translate(0px, 0px) scale(1);
    }
    33% {
      transform: translate(30px, -50px) scale(1.1);
    }
    66% {
      transform: translate(-20px, 20px) scale(0.9);
    }
    100% {
      transform: translate(0px, 0px) scale(1);
    }
  }
  
  /* Optimize blob animation for performance */
  .animate-blob {
    animation: blob 7s infinite;
    will-change: transform;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }
  
  .animation-delay-2000 {
    animation-delay: 2s;
  }
  
  .animation-delay-4000 {
    animation-delay: 4s;
  }
  
  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  
  ::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.02);
  }
  
  ::-webkit-scrollbar-thumb {
    background: rgba(16, 185, 129, 0.3);
    border-radius: 3px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(16, 185, 129, 0.5);
  }

  /* Remove input spinners */
  input[type='number']::-webkit-inner-spin-button,
  input[type='number']::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  input[type='number'] {
    -moz-appearance: textfield;
  }

  /* Performance-optimized glass effect */
  .glass {
    background: rgba(255, 255, 255, 0.02);
    /* Only use backdrop-filter on critical elements */
    /* backdrop-filter: blur(16px); */
    border: 1px solid rgba(255, 255, 255, 0.05);
    /* Enable GPU acceleration */
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
  }

  /* Add backdrop-filter only to modal backgrounds */
  .modal-glass {
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .glass-hover:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.1);
  }

  /* Optimize glow effects */
  .glow-purple {
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.15);
  }

  .glow-purple-lg {
    box-shadow: 0 0 30px rgba(34, 197, 94, 0.2);
  }

  /* Text gradient optimization */
  .gradient-text {
    background: linear-gradient(135deg, #22C55E 0%, #0891B2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    /* Prevent layout thrashing */
    will-change: auto;
  }

  /* Button gradient optimization */
  .gradient-button {
    background: linear-gradient(135deg, #10B981 0%, #0891B2 100%);
    position: relative;
    overflow: hidden;
    transform: translateZ(0);
    -webkit-transform: translateZ(0);
  }

  /* Reduce complexity of hover effect */
  .gradient-button:hover {
    filter: brightness(1.1);
  }

  /* Performance mode for low-end devices */
  @media (max-width: 768px) {
    .animate-blob {
      animation: none;
      display: none;
    }
    
    .glass {
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      background: rgba(20, 20, 22, 0.95);
    }
    
    .glow-purple,
    .glow-purple-lg {
      box-shadow: none;
    }
  }

  /* Reduce motion for accessibility */
  @media (prefers-reduced-motion: reduce) {
    .animate-blob {
      animation: none;
    }
    
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`}</style>
       <TokenSelector
        isOpen={showTokenSelector === 'from'}
        onClose={() => setShowTokenSelector(null)}
        onSelect={(token: Token) => {
          setFromToken(token);
          setShowTokenSelector(null);
        }}
        currentToken={fromToken}
        formatBalance={formatBalance}
        otherToken={toToken}
      />

      <TokenSelector
        isOpen={showTokenSelector === 'to'}
        onClose={() => setShowTokenSelector(null)}
        onSelect={(token: Token) => {
          setToToken(token);
          setShowTokenSelector(null);
        }}
        currentToken={toToken}
        formatBalance={formatBalance}
        otherToken={fromToken}
      />

      <TokenSelector
        isOpen={showTokenSelector === 'tokenA'}
        onClose={() => setShowTokenSelector(null)}
        onSelect={(token: Token) => {
          setTokenA(token);
          setShowTokenSelector(null);
        }}
        currentToken={tokenA}
        formatBalance={formatBalance}
        otherToken={tokenB}
      />

      <TokenSelector
        isOpen={showTokenSelector === 'tokenB'}
        onClose={() => setShowTokenSelector(null)}
        onSelect={(token: Token) => {
          setTokenB(token);
          setShowTokenSelector(null);
        }}
        currentToken={tokenB}
        formatBalance={formatBalance}
        otherToken={tokenA}
      />
     
     
    </div>
  );
}
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
import { DealixProvider } from './contexts/DealixContext';
import { CreateDealixModal } from './components/dealix/CreateDealixModal';
import { DealixHub } from './components/dealix/DealixHub';
import { useDealix } from './contexts/DealixContext';




// Types
import { Token, TabType, LiquidityTabType, LiquidityPosition } from './types';

// Constants
import { DEFAULT_TOKENS } from './constants/tokens';
import { ROUTER_ADDRESS, FACTORY_ADDRESS, ROUTER_ABI,WETH_ABI, FACTORY_ABI, PAIR_ABI, ERC20_ABI, WETH_ADDRESS } from './constants/contracts';

// Hooks
import { useTokenBalances } from './hooks/useTokenBalances';
import { useSwap } from './hooks/useSwap';

// Utils
import { formatBalance } from './utils/formatters';
import { isValidAmount } from './utils/validators';

// Helper function for explorer URLs
const getExplorerUrl = (txHash: string) => {
  return `https://basescan.org/tx/${txHash}`;
};

export default function App() {
  // Wallet connection
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");

  // Token balances hook
  const { tokenBalances, loadTokenBalances } = useTokenBalances();

  // Swap hook
   const { executeSwap: executeSwapTransaction, calculateSwapOutput, loading: swapLoading } = useSwap();

    const { 
    hasDealixId, 
    selectedDiscounts, 
    selectedAffiliateDiscount,
    refreshData 
  } = useDealix();


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
  const [receiveAsWETH, setReceiveAsWETH] = useState(false); // Add this state




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

const handleWrapETH = async (amount: string): Promise<boolean> => {
  if (!walletProvider || !address) return false;
  
  try {
    const provider = new ethers.providers.Web3Provider(walletProvider as any);
    const signer = provider.getSigner();
    const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
    
    const amountWei = ethers.utils.parseEther(amount);
    const tx = await wethContract.deposit({ value: amountWei });
    const receipt = await tx.wait();
    
    return receipt.status === 1;
  } catch (error) {
    console.error('Error wrapping ETH:', error);
    return false;
  }
};

// Handle unwrapping WETH to ETH
const handleUnwrapWETH = async (amount: string): Promise<boolean> => {
  if (!walletProvider || !address) return false;
  
  try {
    const provider = new ethers.providers.Web3Provider(walletProvider as any);
    const signer = provider.getSigner();
    const wethContract = new ethers.Contract(WETH_ADDRESS, WETH_ABI, signer);
    
    const amountWei = ethers.utils.parseEther(amount);
    const tx = await wethContract.withdraw(amountWei);
    const receipt = await tx.wait();
    
    return receipt.status === 1;
  } catch (error) {
    console.error('Error unwrapping WETH:', error);
    return false;
  }
};


  // Handle token swap
  const handleSwapTokens = useCallback(() => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  }, [fromToken, toToken, fromAmount, toAmount]);

  // Execute swap

// The issue is in your handleSwap function. Here's the fixed version:

const handleSwap = async () => {
    if (!isConnected || !fromAmount || !toAmount) return;
    
    console.log('=== SWAP DEBUG ===');
    console.log('Has Dealix ID:', hasDealixId);
    console.log('Selected Discounts:', selectedDiscounts);
    console.log('Selected Affiliate:', selectedAffiliateDiscount);
    console.log('From Token:', fromToken.address);
    console.log('To Token:', toToken.address);
    console.log('==================');

    setLoading(true);
    const toastId = toast.loading('Preparing swap...');

    try {
      // Check if it's wrap/unwrap
      const isWrap = fromToken.address === '0x0000000000000000000000000000000000000000' && 
                     toToken.address === WETH_ADDRESS;
      const isUnwrap = fromToken.address === WETH_ADDRESS && 
                       toToken.address === '0x0000000000000000000000000000000000000000';

      if (isWrap || isUnwrap) {
        // Handle wrap/unwrap
        const success = isWrap 
          ? await handleWrapETH(fromAmount)
          : await handleUnwrapWETH(fromAmount);
        
        if (success) {
          toast.success(isWrap ? 'ETH wrapped successfully!' : 'WETH unwrapped successfully!', { id: toastId });
          setFromAmount('');
          setToAmount('');
          await loadTokenBalances();
        } else {
          toast.error('Transaction failed', { id: toastId });
        }
      } else {
        // Regular swap - now with Dealix integration
        toast.loading('Executing swap...', { id: toastId });
        
        // Pass Dealix parameters to the swap
        const receipt = await executeSwapTransaction(
          fromToken,
          toToken,
          fromAmount,
          toAmount,
          slippage,
          hasDealixId,
          selectedDiscounts,
          selectedAffiliateDiscount
        );

        if (receipt && receipt.status === 1) {
          const explorerUrl = getExplorerUrl(receipt.transactionHash);
          toast.success(
            <div>
              <p>Swap successful!</p>
              <a 
                href={explorerUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-[#00FF4D] underline text-sm"
              >
                View on Explorer →
              </a>
            </div>,
            { id: toastId, duration: 10000 }
          );
          setFromAmount('');
          setToAmount('');
          await loadTokenBalances();
          
          // Refresh Dealix data after successful swap
          if (hasDealixId) {
            await refreshData?.();
          }
        } else {
          toast.error('Swap failed', { id: toastId });
        }
      }
    } catch (error: any) {
      console.error('Swap error:', error);
      
      if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
        toast.error('Transaction cancelled', { id: toastId });
      } else if (error.reason) {
        toast.error(`Swap failed: ${error.reason}`, { id: toastId });
      } else {
        toast.error('Swap failed. Please try again.', { id: toastId });
      }
    } finally {
      setLoading(false);
    }
  };

// Also update your useSwap hook to handle the swap execution properly:
// In hooks/useSwap.ts



  // Add liquidity
 // Replace the handleAddLiquidity function in App.tsx with this fixed version:

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
    const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
    const amountADesired = ethers.utils.parseUnits(amountA, tokenA.decimals);
    const amountBDesired = ethers.utils.parseUnits(amountB, tokenB.decimals);
    
    // Check if this is first liquidity by checking if pair exists and has liquidity
    let isFirstLiquidity = false;
    
    // Handle ETH pairs
    if (tokenA.address === '0x0000000000000000000000000000000000000000' || 
        tokenB.address === '0x0000000000000000000000000000000000000000') {
      
      const isTokenAETH = tokenA.address === '0x0000000000000000000000000000000000000000';
      const token = isTokenAETH ? tokenB : tokenA;
      const tokenAmount = isTokenAETH ? amountBDesired : amountADesired;
      const ethAmount = isTokenAETH ? amountADesired : amountBDesired;
      
      // Check if pair exists and has liquidity
      const pairAddress = await factoryContract.getPair(token.address, WETH_ADDRESS);
      
      if (pairAddress === ethers.constants.AddressZero) {
        isFirstLiquidity = true;
        console.log("Creating new pair - first liquidity");
      } else {
        const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
        const totalSupply = await pairContract.totalSupply();
        isFirstLiquidity = totalSupply.eq(0);
        console.log("Pair exists, total supply:", totalSupply.toString());
      }
      
      // Calculate minimum amounts
      let tokenMin, ethMin;
      if (isFirstLiquidity) {
        // For first liquidity, use exact amounts as minimums
        tokenMin = tokenAmount;
        ethMin = ethAmount;
        toast.loading('Creating new liquidity pool...', { id: toastId });
      } else {
        // For existing pools, apply slippage
        const slippageTolerance = 0.5; // 0.5%
        tokenMin = tokenAmount.mul(1000 - slippageTolerance * 10).div(1000);
        ethMin = ethAmount.mul(1000 - slippageTolerance * 10).div(1000);
      }

      // Approve token
      toast.loading('Approving token...', { id: toastId });
      const tokenContract = new ethers.Contract(token.address, ERC20_ABI, signer);
      
      // Check current allowance
      const currentAllowance = await tokenContract.allowance(address, ROUTER_ADDRESS);
      
      if (currentAllowance.lt(tokenAmount)) {
        const approveTx = await tokenContract.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256);
        await approveTx.wait();
        toast.loading('Token approved! Adding liquidity...', { id: toastId });
      }

      console.log("Adding liquidity with ETH:");
      console.log("Token:", token.address);
      console.log("Token amount:", ethers.utils.formatUnits(tokenAmount, token.decimals));
      console.log("ETH amount:", ethers.utils.formatEther(ethAmount));
      console.log("Token min:", ethers.utils.formatUnits(tokenMin, token.decimals));
      console.log("ETH min:", ethers.utils.formatEther(ethMin));
      console.log("Is first liquidity:", isFirstLiquidity);

      // Estimate gas for the transaction
      let gasLimit;
      try {
        const estimatedGas = await routerContract.estimateGas.addLiquidityETH(
          token.address,
          tokenAmount,
          tokenMin,
          ethMin,
          address,
          deadline,
          { value: ethAmount }
        );
        
        // Add 50% buffer for safety
        gasLimit = estimatedGas.mul(150).div(100);
        console.log("Estimated gas:", estimatedGas.toString());
        console.log("Using gas limit with buffer:", gasLimit.toString());
      } catch (estimateError) {
        // If estimation fails, use appropriate default
        gasLimit = isFirstLiquidity ? ethers.BigNumber.from(3000000) : ethers.BigNumber.from(500000);
        console.log("Gas estimation failed, using default:", gasLimit.toString());
      }

      // Add liquidity with ETH
      const tx = await routerContract.addLiquidityETH(
        token.address,
        tokenAmount,
        tokenMin,
        ethMin,
        address,
        deadline,
        { 
          value: ethAmount,
          gasLimit: gasLimit
        }
      );
      
      toast.loading('Confirming transaction...', { id: toastId });
      const receipt = await tx.wait();
      
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">
            {isFirstLiquidity ? 'Liquidity pool created!' : 'Liquidity added successfully!'}
          </span>
          <a 
            href={`https://basescan.org/tx/${receipt.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:underline flex items-center gap-1"
          >
            View on BaseScan
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>,
        { id: toastId, duration: 5000 }
      );
      
    } else {
      // Both are ERC20 tokens
      // Check if pair exists and has liquidity
      const pairAddress = await factoryContract.getPair(tokenA.address, tokenB.address);
      
      if (pairAddress === ethers.constants.AddressZero) {
        isFirstLiquidity = true;
        console.log("Creating new token pair - first liquidity");
      } else {
        const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
        const totalSupply = await pairContract.totalSupply();
        isFirstLiquidity = totalSupply.eq(0);
        console.log("Pair exists, total supply:", totalSupply.toString());
      }
      
      // Calculate minimum amounts
      let amountAMin, amountBMin;
      if (isFirstLiquidity) {
        // For first liquidity, use exact amounts as minimums
        amountAMin = amountADesired;
        amountBMin = amountBDesired;
        toast.loading('Creating new liquidity pool...', { id: toastId });
      } else {
        // For existing pools, apply slippage
        const slippageTolerance = 0.5; // 0.5%
        amountAMin = amountADesired.mul(1000 - slippageTolerance * 10).div(1000);
        amountBMin = amountBDesired.mul(1000 - slippageTolerance * 10).div(1000);
      }
      
      toast.loading('Approving tokens...', { id: toastId });
      
      // Approve both tokens
      const tokenAContract = new ethers.Contract(tokenA.address, ERC20_ABI, signer);
      const tokenBContract = new ethers.Contract(tokenB.address, ERC20_ABI, signer);
      
      // Check allowances
      const [allowanceA, allowanceB] = await Promise.all([
        tokenAContract.allowance(address, ROUTER_ADDRESS),
        tokenBContract.allowance(address, ROUTER_ADDRESS)
      ]);
      
      const approvals = [];
      
      if (allowanceA.lt(amountADesired)) {
        approvals.push(tokenAContract.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256));
      }
      
      if (allowanceB.lt(amountBDesired)) {
        approvals.push(tokenBContract.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256));
      }
      
      if (approvals.length > 0) {
        const approvalTxs = await Promise.all(approvals);
        await Promise.all(approvalTxs.map(tx => tx.wait()));
        toast.loading('Tokens approved! Adding liquidity...', { id: toastId });
      }

      console.log("Adding token-token liquidity:");
      console.log("Token A:", tokenA.address, amountA);
      console.log("Token B:", tokenB.address, amountB);
      console.log("Is first liquidity:", isFirstLiquidity);

      // Estimate gas for the transaction
      let gasLimit;
      try {
        const estimatedGas = await routerContract.estimateGas.addLiquidity(
          tokenA.address,
          tokenB.address,
          amountADesired,
          amountBDesired,
          amountAMin,
          amountBMin,
          address,
          deadline
        );
        
        // Add 50% buffer for safety
        gasLimit = estimatedGas.mul(150).div(100);
        console.log("Estimated gas:", estimatedGas.toString());
        console.log("Using gas limit with buffer:", gasLimit.toString());
      } catch (estimateError) {
        // If estimation fails, use appropriate default
        gasLimit = isFirstLiquidity ? ethers.BigNumber.from(3000000) : ethers.BigNumber.from(500000);
        console.log("Gas estimation failed, using default:", gasLimit.toString());
      }

      // Add liquidity
      const tx = await routerContract.addLiquidity(
        tokenA.address,
        tokenB.address,
        amountADesired,
        amountBDesired,
        amountAMin,
        amountBMin,
        address,
        deadline,
        { gasLimit: gasLimit }
      );
      
      toast.loading('Confirming transaction...', { id: toastId });
      const receipt = await tx.wait();
      
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">
            {isFirstLiquidity ? 'Liquidity pool created!' : 'Liquidity added successfully!'}
          </span>
          <a 
            href={`https://basescan.org/tx/${receipt.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:underline flex items-center gap-1"
          >
            View on BaseScan
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>,
        { id: toastId, duration: 5000 }
      );
    }
    
    // Reset form
    setAmountA('');
    setAmountB('');
    
    // Reload balances and positions
    await Promise.all([
      loadTokenBalances(),
      loadLiquidityPositions()
    ]);
    
  } catch (error: any) {
    console.error('Add liquidity error:', error);
    
    let errorMessage = 'Failed to add liquidity';
    
    if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
      errorMessage = 'Transaction rejected by user';
    } else if (error.message?.includes('INSUFFICIENT_A_AMOUNT')) {
      errorMessage = 'Insufficient amount for token A. Try increasing slippage or amounts.';
    } else if (error.message?.includes('INSUFFICIENT_B_AMOUNT')) {
      errorMessage = 'Insufficient amount for token B. Try increasing slippage or amounts.';
    } else if (error.message?.includes('INSUFFICIENT_LIQUIDITY')) {
      errorMessage = 'Insufficient liquidity in the pool';
    } else if (error.message?.includes('EXPIRED')) {
      errorMessage = 'Transaction deadline exceeded. Please try again.';
    } else if (error.message?.includes('out of gas')) {
      errorMessage = 'Transaction ran out of gas. This might be a new pool creation that requires more gas.';
    } else if (error.reason) {
      errorMessage = error.reason;
    } else if (error.data?.message) {
      errorMessage = error.data.message;
    }
    
    toast.error(
      <div className="flex flex-col gap-1">
        <span className="font-semibold">{errorMessage}</span>
        {error.message && (
          <span className="text-xs text-gray-400 break-all">
            {error.message.slice(0, 100)}...
          </span>
        )}
      </div>,
      { id: toastId }
    );
  } finally {
    setLoading(false);
  }
}, [address, tokenA, tokenB, amountA, amountB, walletProvider, loadTokenBalances, loadLiquidityPositions]);
  // Remove liquidity
 // More robust handleRemoveLiquidity function with better error handling
const handleRemoveLiquidity = useCallback(async () => {
  if (!walletProvider || !address || !selectedPosition) return;

  const toastId = toast.loading(
    <div className="flex flex-col gap-1">
      <span className="font-semibold">Removing liquidity...</span>
      <span className="text-xs text-gray-400">
        {removePercentage}% of {selectedPosition.token0.symbol}/{selectedPosition.token1.symbol}
        {receiveAsWETH && ' (keeping as WETH)'}
      </span>
    </div>
  );
  setLoading(true);

  try {
    const provider = new ethers.providers.Web3Provider(walletProvider as any);
    const signer = provider.getSigner();
    const routerContract = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
    const pairContract = new ethers.Contract(selectedPosition.pair, PAIR_ABI, signer);

    // Calculate liquidity amount to remove
    const liquidity = ethers.BigNumber.from(selectedPosition.balance).mul(removePercentage).div(100);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    // Get current state
    const [reserves, totalSupply, token0Address, token1Address] = await Promise.all([
      pairContract.getReserves(),
      pairContract.totalSupply(),
      pairContract.token0(),
      pairContract.token1()
    ]);

    console.log('Pair details:', {
      token0: token0Address,
      token1: token1Address,
      reserve0: reserves[0].toString(),
      reserve1: reserves[1].toString(),
      totalSupply: totalSupply.toString(),
      receiveAsWETH: receiveAsWETH
    });

    // Calculate expected amounts
    const amount0Expected = liquidity.mul(reserves[0]).div(totalSupply);
    const amount1Expected = liquidity.mul(reserves[1]).div(totalSupply);

    // Use 3% slippage for safety
    const slippageTolerance = 300; // 3% in basis points
    const amount0Min = amount0Expected.mul(10000 - slippageTolerance).div(10000);
    const amount1Min = amount1Expected.mul(10000 - slippageTolerance).div(10000);

    // Check and approve LP tokens
    const allowance = await pairContract.allowance(address, ROUTER_ADDRESS);
    if (allowance.lt(liquidity)) {
      toast.loading('Approving LP tokens...', { id: toastId });
      const approveTx = await pairContract.approve(ROUTER_ADDRESS, ethers.constants.MaxUint256);
      await approveTx.wait();
      toast.loading('LP tokens approved! Removing liquidity...', { id: toastId });
    }

    let tx;
    
    // Check which token is WETH
    const isToken0WETH = token0Address.toLowerCase() === WETH_ADDRESS.toLowerCase();
    const isToken1WETH = token1Address.toLowerCase() === WETH_ADDRESS.toLowerCase();
    
    if ((isToken0WETH || isToken1WETH) && !receiveAsWETH) {
      // User wants to receive ETH (current behavior)
      const tokenAddress = isToken0WETH ? token1Address : token0Address;
      const tokenMin = isToken0WETH ? amount1Min : amount0Min;
      const ethMin = isToken0WETH ? amount0Min : amount1Min;
      
      console.log('Removing liquidity and converting WETH to ETH');
      
      // Try with calculated minimums, then reduced, then zero
      try {
        tx = await routerContract.removeLiquidityETH(
          tokenAddress,
          liquidity,
          tokenMin,
          ethMin,
          address,
          deadline,
          { gasLimit: 500000 }
        );
      } catch (error) {
        console.log('Trying with reduced minimums...');
        try {
          tx = await routerContract.removeLiquidityETH(
            tokenAddress,
            liquidity,
            tokenMin.div(2),
            ethMin.div(2),
            address,
            deadline,
            { gasLimit: 500000 }
          );
        } catch (error2) {
          console.log('Trying with zero minimums...');
          tx = await routerContract.removeLiquidityETH(
            tokenAddress,
            liquidity,
            0,
            0,
            address,
            deadline,
            { gasLimit: 500000 }
          );
        }
      }
    } else {
      // User wants to keep WETH OR both tokens are ERC20
      // Use regular removeLiquidity which keeps tokens as-is
      console.log('Removing liquidity (keeping as tokens):', {
        token0: token0Address,
        token1: token1Address,
        keepingAsWETH: receiveAsWETH && (isToken0WETH || isToken1WETH)
      });
      
      // Try with calculated minimums, then reduced, then zero
      try {
        tx = await routerContract.removeLiquidity(
          token0Address,
          token1Address,
          liquidity,
          amount0Min,
          amount1Min,
          address,
          deadline,
          { gasLimit: 400000 }
        );
      } catch (error) {
        console.log('Trying with reduced minimums...');
        try {
          tx = await routerContract.removeLiquidity(
            token0Address,
            token1Address,
            liquidity,
            amount0Min.div(2),
            amount1Min.div(2),
            address,
            deadline,
            { gasLimit: 400000 }
          );
        } catch (error2) {
          console.log('Trying with zero minimums...');
          tx = await routerContract.removeLiquidity(
            token0Address,
            token1Address,
            liquidity,
            0,
            0,
            address,
            deadline,
            { gasLimit: 400000 }
          );
        }
      }
    }

    toast.loading('Confirming transaction...', { id: toastId });
    const receipt = await tx.wait();
    
    // Determine what was received
    const receivedToken0 = isToken0WETH && !receiveAsWETH ? 'ETH' : 
                         isToken0WETH && receiveAsWETH ? 'WETH' : 
                         selectedPosition.token0.symbol;
    const receivedToken1 = isToken1WETH && !receiveAsWETH ? 'ETH' : 
                         isToken1WETH && receiveAsWETH ? 'WETH' : 
                         selectedPosition.token1.symbol;
    
    toast.success(
      <div className="flex flex-col gap-2">
        <span className="font-semibold">Liquidity removed successfully!</span>
        <div className="text-xs text-gray-300">
          Received {receivedToken0} and {receivedToken1}
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
    
    // Reset form
    setRemoveAmount('');
    setRemovePercentage(25);
    
    // Update UI
    if (removePercentage === 100) {
      setLiquidityPositions(prev => prev.filter(pos => pos.pair !== selectedPosition.pair));
      setSelectedPosition(null);
    }
    
    // Reload data
    await Promise.all([
      loadTokenBalances(),
      loadLiquidityPositions()
    ]);
    
  } catch (error: any) {
    console.error('Remove liquidity error:', error);
    
    let errorMessage = 'Failed to remove liquidity';
    let suggestion = '';
    
    if (error.receipt && error.receipt.status === 0) {
      errorMessage = 'Transaction failed';
      suggestion = receiveAsWETH ? 
        'Try toggling off "Receive as WETH" option' : 
        'Try toggling on "Receive as WETH" option to avoid unwrapping';
    } else if (error.code === 4001) {
      errorMessage = 'Transaction cancelled by user';
    } else if (error.message?.includes('INSUFFICIENT')) {
      errorMessage = 'Output amount too low';
      suggestion = 'Pool price has changed. Try removing a smaller percentage.';
    }
    
    toast.error(
      <div className="flex flex-col gap-1">
        <span className="font-semibold">{errorMessage}</span>
        {suggestion && (
          <span className="text-xs text-gray-400">{suggestion}</span>
        )}
      </div>,
      { id: toastId, duration: 15000 }
    );
  } finally {
    setLoading(false);
  }
}, [address, selectedPosition, removePercentage, receiveAsWETH, walletProvider, loadTokenBalances, loadLiquidityPositions]);


// Add this helper function to decode revert reasons
const decodeRevertReason = (data: string) => {
  if (!data || data === '0x') return 'Unknown error';
  
  // Common revert signatures
  const signatures: { [key: string]: string } = {
    '0x08c379a0': 'Error(string)', // Standard revert with reason string
    '0x4e487b71': 'Panic(uint256)', // Panic error
    '0x': 'Unknown error'
  };
  
  const selector = data.slice(0, 10);
  
  if (selector === '0x08c379a0' && data.length >= 138) {
    // Decode standard revert reason
    try {
      const reason = ethers.utils.defaultAbiCoder.decode(['string'], '0x' + data.slice(138));
      return reason[0];
    } catch {
      return 'Failed to decode error reason';
    }
  }
  
  return signatures[selector] || 'Unknown error';
};
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
  receiveAsWETH={receiveAsWETH}
  onReceiveAsWETHChange={setReceiveAsWETH}
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
      {activeTab === 'dealix' && (
  <DealixHub />
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
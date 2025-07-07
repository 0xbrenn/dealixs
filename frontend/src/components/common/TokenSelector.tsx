import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { useAppKitProvider, useAppKitAccount } from "@reown/appkit/react";
import { Token, TokenSelectorProps } from '../../types';
import { DEFAULT_TOKENS } from '../../constants/tokens';
import { ERC20_ABI } from '../../constants/contracts';
import { isValidAddress } from '../../utils/validators';
import { formatBalance } from '../../utils/formatters';

export const TokenSelector: React.FC<TokenSelectorProps> = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  currentToken,
  formatBalance: formatBalanceProp,
  otherToken 
}) => {
  const { address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const [searchQuery, setSearchQuery] = useState('');
  const [customTokens, setCustomTokens] = useState<Token[]>([]);
  const [loadingToken, setLoadingToken] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [detectedToken, setDetectedToken] = useState<Token | null>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<string, string>>({});

  // Load custom tokens from localStorage on mount
  useEffect(() => {
    const savedTokens = localStorage.getItem('customTokens');
    if (savedTokens) {
      try {
        setCustomTokens(JSON.parse(savedTokens));
      } catch (error) {
        console.error('Error loading custom tokens:', error);
      }
    }
  }, []);

  // Save custom tokens to localStorage whenever they change
  useEffect(() => {
    if (customTokens.length > 0) {
      localStorage.setItem('customTokens', JSON.stringify(customTokens));
    } else {
      localStorage.removeItem('customTokens');
    }
  }, [customTokens]);

  // Load token balances for all tokens
  useEffect(() => {
    const loadBalances = async () => {
      if (!address || !walletProvider) return;

      const provider = new ethers.providers.Web3Provider(walletProvider as any);
      const balances: Record<string, string> = {};

      // Get ETH balance
      const ethBalance = await provider.getBalance(address);
      balances['0x0000000000000000000000000000000000000000'] = ethers.utils.formatEther(ethBalance);

      // Get token balances
      const allTokens = [...DEFAULT_TOKENS, ...customTokens];
      for (const token of allTokens) {
        if (token.address !== '0x0000000000000000000000000000000000000000' && token.address) {
          try {
            const tokenContract = new ethers.Contract(token.address, ERC20_ABI, provider);
            const balance = await tokenContract.balanceOf(address);
            balances[token.address] = ethers.utils.formatUnits(balance, token.decimals);
          } catch (error) {
            console.error(`Error loading balance for ${token.symbol}:`, error);
            balances[token.address] = '0';
          }
        }
      }

      setTokenBalances(balances);
    };

    if (isOpen) {
      loadBalances();
    }
  }, [address, walletProvider, customTokens, isOpen]);

  // Update tokens with balance
  const tokensWithBalance = useMemo(() => {
    const allTokens = [...DEFAULT_TOKENS, ...customTokens];
    return allTokens.map(token => ({
      ...token,
      balance: tokenBalances[token.address] || '0'
    }));
  }, [customTokens, tokenBalances]);

  // Load token from contract
  const loadTokenFromContract = async (tokenAddress: string) => {
    if (!walletProvider) {
      setTokenError('Please connect your wallet');
      return;
    }

    setLoadingToken(true);
    setTokenError('');

    try {
      const provider = new ethers.providers.Web3Provider(walletProvider as any);
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

      const [symbol, name, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.name(),
        tokenContract.decimals()
      ]);

      let balance = '0';
      if (address) {
        const balanceRaw = await tokenContract.balanceOf(address);
        balance = ethers.utils.formatUnits(balanceRaw, decimals);
      }

      const newToken: Token = {
        address: tokenAddress,
        symbol,
        name,
        decimals,
        balance,
        logoURI: `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png`,
        isCustom: true
      };

      setDetectedToken(newToken);
    } catch (error) {
      console.error('Error loading token:', error);
      setTokenError('Invalid token address or unable to load token information');
    } finally {
      setLoadingToken(false);
    }
  };

  // Handle search input change
  useEffect(() => {
    if (isValidAddress(searchQuery)) {
      const existingToken = [...DEFAULT_TOKENS, ...customTokens].find(
        t => t.address.toLowerCase() === searchQuery.toLowerCase()
      );
      
      if (!existingToken) {
        loadTokenFromContract(searchQuery);
      } else {
        setDetectedToken(null);
      }
    } else {
      setDetectedToken(null);
      setTokenError('');
    }
  }, [searchQuery, customTokens]);

  // Filter tokens based on search
  const filteredTokens = useMemo(() => {
    const allTokens = [...DEFAULT_TOKENS, ...customTokens];
    
    if (!searchQuery) return allTokens;
    
    const query = searchQuery.toLowerCase();
    return allTokens.filter(token => 
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query) ||
      token.address.toLowerCase().includes(query)
    );
  }, [searchQuery, customTokens]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="glass glow-purple rounded-3xl p-6 max-w-md w-full max-h-[85vh] flex flex-col relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Enhanced Background decoration with animations */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div 
              className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/15 rounded-full blur-3xl"
              animate={{
                x: [0, 30, 0],
                y: [0, -20, 0],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div 
              className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-600/15 rounded-full blur-3xl"
              animate={{
                x: [0, -20, 0],
                y: [0, 30, 0],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </div>

          {/* Content */}
          <div className="relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Select Token</h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-xl"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search input */}
            <div className="relative mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, symbol, or paste address"
                className="w-full glass text-white px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 pl-12 placeholder-gray-500"
              />
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Loading state */}
            {loadingToken && (
              <div className="mb-4 p-4 glass rounded-2xl">
                <div className="flex items-center space-x-3">
                  <svg className="animate-spin h-5 w-5 text-emerald-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-gray-400">Loading token information...</span>
                </div>
              </div>
            )}

            {/* Error state */}
            {tokenError && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
                <p className="text-red-400 text-sm">{tokenError}</p>
              </div>
            )}

            {/* Detected token */}
            {detectedToken && !loadingToken && (
              <div className="mb-4 space-y-3">
                <div className="p-4 glass border border-emerald-500/30 rounded-2xl">
                  <p className="text-emerald-400 text-sm mb-3">Token found:</p>
                  <div className="flex items-center space-x-3">
                    <img 
                      src={detectedToken.logoURI}
                      alt={detectedToken.symbol}
                      className="w-10 h-10 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png';
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold truncate">{detectedToken.symbol}</div>
                      <div className="text-gray-400 text-sm truncate">{detectedToken.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-500 text-xs">Balance</div>
                      <div className="text-white font-medium">
                        {formatBalanceProp(detectedToken.balance)}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (detectedToken) {
                      // Check if detected token is same as other token
                      if (otherToken && detectedToken.address.toLowerCase() === otherToken.address.toLowerCase()) {
                        toast.error('Cannot select the same token for both sides');
                        return;
                      }
                      
                      // Add to custom tokens and save to localStorage
                      const newCustomTokens = [...customTokens, detectedToken];
                      setCustomTokens(newCustomTokens);
                      
                      toast.success(`Added ${detectedToken.symbol} to token list`);
                      onSelect(detectedToken);
                      onClose();
                    }
                  }}
                  className="w-full p-4 gradient-button rounded-2xl transition-all flex items-center justify-center space-x-2 font-semibold"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add {detectedToken.symbol} to list</span>
                </button>
              </div>
            )}

            {/* Token list */}
            <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar" style={{ maxHeight: '400px' }}>
              {filteredTokens.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No tokens found</p>
                  {isValidAddress(searchQuery) && (
                    <p className="text-sm mt-2">Enter a valid token address to import</p>
                  )}
                </div>
              ) : (
                filteredTokens.map((token) => (
                  <div
                    key={token.address}
                    className={`w-full p-4 rounded-2xl transition-all flex items-center space-x-3 group ${
                      token.address === currentToken.address
                        ? 'glass border border-emerald-500/50 cursor-default'
                        : otherToken && token.address.toLowerCase() === otherToken.address.toLowerCase()
                        ? 'glass border border-red-500/50 cursor-not-allowed opacity-50'
                        : 'glass glass-hover hover:border-white/20 cursor-pointer'
                    }`}
                  >
                    <div
                      onClick={() => {
                        // Check if this token is the same as the other token in the pair
                        if (otherToken && token.address.toLowerCase() === otherToken.address.toLowerCase()) {
                          toast.error('Cannot select the same token for both sides');
                          return;
                        }
                        if (token.address !== currentToken.address) {
                          onSelect(token);
                          onClose();
                        }
                      }}
                      className="flex items-center space-x-3 flex-1"
                    >
                      <div className="relative">
                        <img 
                          src={token.logoURI || 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png'}
                          alt={token.symbol}
                          className="w-10 h-10 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png';
                          }}
                        />
                        {token.isCustom && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center" title="Custom Token">
                            <span className="text-white text-xs font-bold">C</span>
                          </div>
                        )}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="text-white font-semibold flex items-center space-x-2">
                          <span className="truncate">{token.symbol}</span>
                          {token.isCustom && (
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Custom</span>
                          )}
                        </div>
                        <div className="text-gray-400 text-sm truncate">{token.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-medium">
                          {formatBalanceProp(tokenBalances[token.address])}
                        </div>
                        <div className="text-gray-500 text-xs">Balance</div>
                      </div>
                    </div>
                    {token.isCustom && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          const updatedTokens = customTokens.filter(t => t.address !== token.address);
                          setCustomTokens(updatedTokens);
                          toast.success(`Removed ${token.symbol} from token list`);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/20 rounded-xl cursor-pointer"
                        role="button"
                        tabIndex={0}
                      >
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer info */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-gray-500 text-xs text-center">
                Can't find a token? Enter the contract address above
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
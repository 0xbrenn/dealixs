import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaPlus, FaTimes, FaExclamationCircle } from 'react-icons/fa';
import { ethers } from 'ethers';
import { useAppKitProvider } from "@reown/appkit/react";
import { DEFAULT_TOKENS } from '../../constants/tokens';
import { ERC20_ABI } from '../../constants/contracts';
import { Token } from '../../types';
import { Icon } from '../common/Icon';
import toast from 'react-hot-toast';

interface TokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: Token) => void;
  selectedToken?: Token;
}

export const TokenSelectModal: React.FC<TokenSelectModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedToken
}) => {
  const { walletProvider } = useAppKitProvider("eip155");
  const [searchTerm, setSearchTerm] = useState('');
  const [tokens, setTokens] = useState<Token[]>(DEFAULT_TOKENS);
  const [isSearchingContract, setIsSearchingContract] = useState(false);
  const [customToken, setCustomToken] = useState<Token | null>(null);
  const [searchError, setSearchError] = useState('');

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setCustomToken(null);
      setSearchError('');
      setIsSearchingContract(false);
    }
  }, [isOpen]);

  // Check if search term is a valid address
  const isValidAddress = (address: string) => {
    try {
      return ethers.utils.isAddress(address);
    } catch {
      return false;
    }
  };

  // Fetch token details from contract
  const fetchTokenDetails = async (address: string) => {
    if (!walletProvider) {
      setSearchError('Please connect your wallet');
      return;
    }

    setIsSearchingContract(true);
    setSearchError('');
    setCustomToken(null);

    try {
      const provider = new ethers.providers.Web3Provider(walletProvider as any);
      const contract = new ethers.Contract(address, ERC20_ABI, provider);

      // Fetch token details
      const [name, symbol, decimals] = await Promise.all([
        contract.name().catch(() => 'Unknown Token'),
        contract.symbol().catch(() => 'UNKNOWN'),
        contract.decimals().catch(() => 18)
      ]);

      // Verify it's actually an ERC20 token by checking if it has totalSupply
      try {
        await contract.totalSupply();
      } catch {
        throw new Error('Not a valid ERC20 token');
      }

      const newToken: Token = {
        address: ethers.utils.getAddress(address), // Checksum address
        name,
        symbol,
        decimals,
        logoURI: '' // You could integrate with token list APIs to get logos
      };

      setCustomToken(newToken);
      
      // Check if this token is already in the list
      const existingToken = tokens.find(t => 
        t.address.toLowerCase() === address.toLowerCase()
      );
      
      if (!existingToken) {
        // Add to the token list temporarily
        setTokens([newToken, ...tokens]);
      }
    } catch (error: any) {
      console.error('Error fetching token details:', error);
      if (error.message === 'Not a valid ERC20 token') {
        setSearchError('Address is not a valid ERC20 token contract');
      } else {
        setSearchError('Failed to fetch token details. Please check the address.');
      }
    } finally {
      setIsSearchingContract(false);
    }
  };

  // Handle search input change
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (isValidAddress(searchTerm)) {
        fetchTokenDetails(searchTerm);
      } else {
        setCustomToken(null);
        setSearchError('');
      }
    }, 500); // 500ms delay

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, walletProvider]);

  // Filter tokens based on search
  const filteredTokens = tokens.filter(token => {
    if (!searchTerm || isValidAddress(searchTerm)) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      token.symbol.toLowerCase().includes(search) ||
      token.name.toLowerCase().includes(search) ||
      token.address.toLowerCase().includes(search)
    );
  });

  const handleSelectToken = (token: Token) => {
    onSelect(token);
    onClose();
  };

  return (
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
            <div className="glass rounded-2xl p-6 max-w-md w-full max-h-[80vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Select Token</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                  <Icon icon={FaTimes} />
                </button>
              </div>

              {/* Search Input */}
              <div className="relative mb-4">
                <Icon 
                  icon={FaSearch} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, symbol, or paste address"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-white/30 focus:outline-none"
                  autoFocus
                />
                {isSearchingContract && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {searchError && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start space-x-2">
                  <Icon icon={FaExclamationCircle} className="text-red-400 mt-0.5" />
                  <p className="text-sm text-red-400">{searchError}</p>
                </div>
              )}

              {/* Custom Token Found */}
              {customToken && !searchError && (
                <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                  <p className="text-sm text-green-400 mb-2">✓ Token found!</p>
                  <button
                    onClick={() => handleSelectToken(customToken)}
                    className="w-full p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {customToken.symbol.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-white">{customToken.symbol}</p>
                        <p className="text-xs text-gray-400">{customToken.name}</p>
                        <p className="text-xs text-gray-500 font-mono">
                          {customToken.address.slice(0, 6)}...{customToken.address.slice(-4)}
                        </p>
                      </div>
                    </div>
                    <Icon 
                      icon={FaPlus} 
                      className="text-gray-400 group-hover:text-white transition-colors"
                    />
                  </button>
                </div>
              )}

              {/* Token List */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {filteredTokens.length > 0 ? (
                  <>
                    {isValidAddress(searchTerm) && customToken && (
                      <p className="text-xs text-gray-500 mb-2">Other available tokens:</p>
                    )}
                    {filteredTokens.map((token) => (
                      <button
                        key={token.address || token.symbol}
                        onClick={() => handleSelectToken(token)}
                        className={`w-full p-3 rounded-lg transition-all flex items-center space-x-3 ${
                          selectedToken?.address === token.address
                            ? 'bg-white/10 border border-white/20'
                            : 'bg-white/5 hover:bg-white/10 border border-transparent'
                        }`}
                      >
                        {token.logoURI ? (
                          <img 
                            src={token.logoURI} 
                            alt={token.symbol} 
                            className="w-10 h-10 rounded-full"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div 
                          className={`w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center ${
                            token.logoURI ? 'hidden' : ''
                          }`}
                        >
                          <span className="text-white font-bold text-sm">
                            {token.symbol.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-semibold text-white">{token.symbol}</p>
                          <p className="text-xs text-gray-400">{token.name}</p>
                          {token.address && (
                            <p className="text-xs text-gray-500 font-mono">
                              {token.address.slice(0, 6)}...{token.address.slice(-4)}
                            </p>
                          )}
                        </div>
                        {selectedToken?.address === token.address && (
                          <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        )}
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No tokens found</p>
                  </div>
                )}
              </div>

              {/* Info Footer */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-gray-500 text-center">
                  💡 Tip: You can paste any ERC20 token contract address to add custom tokens
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
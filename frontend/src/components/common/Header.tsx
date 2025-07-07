import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { TabType } from '../../types';
import { useAppKitAccount, useAppKitProvider, useAppKit } from "@reown/appkit/react";
import { formatBalance } from '../../utils/formatters';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isConnected, address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const { open } = useAppKit();
  
  const [balance, setBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Function to load OPN balance
  const loadBalance = useCallback(async () => {
    if (!address || !walletProvider) {
      setBalance('0');
      return;
    }

    setIsLoadingBalance(true);
    try {
      const provider = new ethers.providers.Web3Provider(walletProvider as any);
      const ethBalance = await provider.getBalance(address);
      setBalance(ethers.utils.formatEther(ethBalance));
    } catch (error) {
      console.error('Error loading balance:', error);
      setBalance('0');
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address, walletProvider]);

  // Load balance on mount and when address changes
  useEffect(() => {
    if (isConnected) {
      loadBalance();
    }
  }, [isConnected, address, loadBalance]);

  // Set up real-time balance updates
  useEffect(() => {
    if (!walletProvider || !address) return;

    const provider = new ethers.providers.Web3Provider(walletProvider as any);
    let intervalId: NodeJS.Timeout;

    // Poll for balance updates every 5 seconds
    intervalId = setInterval(() => {
      loadBalance();
    }, 5000);

    // Also listen for new blocks for immediate updates
    const handleBlock = () => {
      loadBalance();
    };

    provider.on('block', handleBlock);

    return () => {
      clearInterval(intervalId);
      provider.off('block', handleBlock);
    };
  }, [walletProvider, address, loadBalance]);

  // Format address for display
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center space-x-3"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 rounded-xl blur-md opacity-50"></div>
                <img 
                  src="https://i.ibb.co/dN1sMhw/logo.jpg" 
                  alt="OPNswap" 
                  className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl"
                />
              </div>
              <span className="text-xl sm:text-2xl font-bold text-white">
                OPN<span className="gradient-text">swap</span>
              </span>
            </motion.div>

            {/* Desktop Navigation - Centered */}
          <nav className="hidden sm:flex items-center absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
  <div className="relative flex items-center glass rounded-full p-1">
    <motion.div
      className="absolute inset-y-1 gradient-button rounded-full"
      initial={false}
      animate={{
        x: activeTab === 'swap' ? 0 : activeTab === 'liquidity' ? '100%' : '200%',
        width: '33.33%',
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    />
    <button
      onClick={() => setActiveTab('swap')}
      className={`relative z-10 px-6 py-2.5 rounded-full font-medium transition-colors ${
        activeTab === 'swap' ? 'text-white' : 'text-gray-400 hover:text-white'
      }`}
    >
      Swap
    </button>
    <button
      onClick={() => setActiveTab('liquidity')}
      className={`relative z-10 px-6 py-2.5 rounded-full font-medium transition-colors ${
        activeTab === 'liquidity' ? 'text-white' : 'text-gray-400 hover:text-white'
      }`}
    >
      Liquidity
    </button>
    <button
      onClick={() => setActiveTab('pools')}
      className={`relative z-10 px-6 py-2.5 rounded-full font-medium transition-colors ${
        activeTab === 'pools' ? 'text-white' : 'text-gray-400 hover:text-white'
      }`}
    >
      Pools
    </button>
    <button
  onClick={() => setActiveTab('farm')}
  className={`relative z-10 px-6 py-2.5 rounded-full font-medium transition-colors ${
    activeTab === 'farm' ? 'text-white' : 'text-gray-400 hover:text-white'
  }`}
>
  Farm
</button>
  </div>
</nav>


            {/* Wallet Connection */}
            <div className="flex items-center space-x-3">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative"
              >
                {isConnected && address ? (
                  <button
                    onClick={() => open()}
                    className="flex items-center space-x-3 glass glass-hover px-4 py-2.5 rounded-xl transition-all"
                  >
                    {/* Balance Display */}
                    <div className="hidden sm:flex items-center space-x-2">
                      <div className="text-right">
                        <div className="text-xs text-gray-400">Balance</div>
                        <div className="text-sm font-medium text-white">
                          {isLoadingBalance ? (
                            <div className="animate-pulse">...</div>
                          ) : (
                            `${formatBalance(balance)} OPN`
                          )}
                        </div>
                      </div>
                      <div className="w-px h-8 bg-white/10"></div>
                    </div>

                    {/* Address Display */}
                    <div className="flex items-center space-x-2">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {address.slice(2, 4).toUpperCase()}
                          </span>
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div>
                      </div>
                      <span className="text-white font-medium text-sm">
                        {formatAddress(address)}
                      </span>
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={() => open()}
                    className="hidden sm:block gradient-button px-6 py-2.5 rounded-xl font-medium text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    Connect Wallet
                  </button>
                )}
              </motion.div>
              
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden p-2.5 glass glass-hover rounded-xl transition-all"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="sm:hidden glass border-b border-white/5"
          >
            <div className="px-4 py-4 space-y-2">
              {/* Mobile Balance Display */}
              {isConnected && address && (
                <button
                  onClick={() => open()}
                  className="w-full glass rounded-xl p-4 mb-4 text-left"
                >
                  <div className="text-xs text-gray-400 mb-1">Wallet Balance</div>
                  <div className="text-xl font-bold text-white">
                    {formatBalance(balance)} OPN
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatAddress(address)}
                  </div>
                </button>
              )}

              {/* Show connect button on mobile when not connected */}
              {!isConnected && (
                <button
                  onClick={() => open()}
                  className="w-full gradient-button px-6 py-3 rounded-xl font-medium text-white shadow-lg mb-4"
                >
                  Connect Wallet
                </button>
              )}

              <button
                onClick={() => {
                  setActiveTab('swap');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                  activeTab === 'swap' 
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Swap
              </button>
              <button
                onClick={() => {
                  setActiveTab('liquidity');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                  activeTab === 'liquidity' 
                    ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Liquidity
              </button>
              <button
  onClick={() => {
    setActiveTab('pools');
    setMobileMenuOpen(false);
  }}
  className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
    activeTab === 'pools' 
      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-white' 
      : 'text-gray-400 hover:text-white hover:bg-white/5'
  }`}
>
  Pools
</button>
<button
  onClick={() => {
    setActiveTab('farm');
    setMobileMenuOpen(false);
  }}
  className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
    activeTab === 'farm' 
      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-white' 
      : 'text-gray-400 hover:text-white hover:bg-white/5'
  }`}
>
  Farm
</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      

    </header>
  );
};
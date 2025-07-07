import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { TabType } from '../../types';
import { useAppKitAccount, useAppKitProvider, useAppKit } from "@reown/appkit/react";
import { formatBalance } from '../../utils/formatters';
import { FaChevronDown, FaTrophy, FaFire, FaUser, FaHistory, FaCog, FaIdCard } from 'react-icons/fa';
import { useDealix } from '../../contexts/DealixContext';
import { CreateDealixModal } from '../dealix/CreateDealixModal';
import { Icon } from '../common/Icon';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showCreateDealixModal, setShowCreateDealixModal] = useState(false);
  
  const { isConnected, address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const { open } = useAppKit();
  const { hasDealixId, dealixProfile } = useDealix();
  
  const [balance, setBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Dealix tier colors and names
  const tierColors = ['#CD7F32', '#C0C0C0', '#FFD700', '#E5E4E2', '#B9F2FF', '#9D4EDD'];
  const tierNames = ['Novice', 'Trader', 'Expert', 'Master', 'Whale', 'Legend'];

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showProfileDropdown && !(event.target as Element).closest('.profile-dropdown')) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showProfileDropdown]);

  // Format address for display
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Updated tabs including Dealix
  const tabs = [
    { id: 'swap' as TabType, label: 'Swap' },
    { id: 'liquidity' as TabType, label: 'Liquidity' },
    { id: 'pools' as TabType, label: 'Pools' },
    { id: 'farm' as TabType, label: 'Farm' },
    { id: 'dealix' as TabType, label: 'Dealix' }
  ];

  return (
    <>
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
                  <img 
                    src="/logo192.png" 
                    alt="OPNswap" 
                    className="relative w-10 h-10 sm:w-16 sm:h-16 rounded-xl"
                  />
                </div>
              </motion.div>

              {/* Desktop Navigation - Centered */}
              <nav className="hidden sm:flex items-center absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="relative flex items-center glass rounded-full p-1">
                  <motion.div
                    className="absolute inset-y-1 gradient-button rounded-full"
                    initial={false}
                    animate={{
                      x: `${tabs.findIndex(tab => tab.id === activeTab) * 100}%`,
                      width: `${100 / tabs.length}%`,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative z-10 px-6 py-2.5 rounded-full font-medium transition-colors ${
                        activeTab === tab.id ? 'text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </nav>

              {/* Wallet Connection */}
              <div className="flex items-center space-x-3">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="relative profile-dropdown"
                >
                  {isConnected && address ? (
                    <div className="relative">
                      <button
                        onClick={() => setShowProfileDropdown(!showProfileDropdown)}
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

                        {/* Address Display with Dealix Status */}
                        <div className="flex items-center space-x-2">
                          <div className="relative">
                            {hasDealixId && dealixProfile ? (
                              <div 
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                                style={{ 
                                  background: `linear-gradient(135deg, ${tierColors[dealixProfile.tier]} 0%, ${tierColors[Math.min(dealixProfile.tier + 1, 5)]} 100%)` 
                                }}
                              >
                                #{dealixProfile.dealixId}
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                                <span className="text-white text-xs font-bold">
                                  {address.slice(2, 4).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div>
                          </div>
                          <div>
                            <span className="text-white font-medium text-sm">
                              {formatAddress(address)}
                            </span>
                            {hasDealixId && dealixProfile && (
                              <div className="flex items-center space-x-2 text-xs">
                                <span style={{ color: tierColors[dealixProfile.tier] }}>
                                  {tierNames[dealixProfile.tier]}
                                </span>
                                {dealixProfile.streak > 0 && (
                                  <div className="flex items-center space-x-1 text-orange-400">
                                    <Icon icon={FaFire} size={10} />
                                    <span>{dealixProfile.streak}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <Icon icon={FaChevronDown} className="text-gray-400" size={12} />
                        </div>
                      </button>

                      {/* Profile Dropdown Menu */}
                      <AnimatePresence>
                        {showProfileDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute top-full right-0 mt-2 w-72 glass rounded-xl overflow-hidden"
                          >
                            {hasDealixId && dealixProfile ? (
                              <>
                                {/* Dealix Stats Section */}
                                <div className="p-4 border-b border-white/10">
                                  <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-white font-semibold">Dealix Profile</h3>
                                    <span className="text-xs text-gray-400">ID #{dealixProfile.dealixId}</span>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-400 text-sm">Tier</span>
                                      <span style={{ color: tierColors[dealixProfile.tier] }} className="font-semibold text-sm">
                                        {tierNames[dealixProfile.tier]}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-400 text-sm">Total Volume</span>
                                      <span className="text-white font-semibold text-sm">
                                        ${Number(dealixProfile.totalVolume).toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-400 text-sm">Badges</span>
                                      <span className="text-white font-semibold text-sm">{dealixProfile.badges}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-gray-400 text-sm">Current Bonus</span>
                                      <span className="text-green-400 font-semibold text-sm">
                                        +{(dealixProfile.tier * 0.05 + Math.min(dealixProfile.streak * 0.05, 2)).toFixed(2)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Menu Items */}
                                <div className="py-2">
                                  <button 
                                    onClick={() => {
                                      setActiveTab('dealix');
                                      setShowProfileDropdown(false);
                                    }}
                                    className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/10 transition-colors"
                                  >
                                    <Icon icon={FaUser} className="text-gray-400" />
                                    <span className="text-white">My Profile</span>
                                  </button>
                                  <button className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/10 transition-colors">
                                    <Icon icon={FaTrophy} className="text-gray-400" />
                                    <span className="text-white">My Badges</span>
                                    <span className="ml-auto bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">
                                      {dealixProfile.badges}
                                    </span>
                                  </button>
                                  <button className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/10 transition-colors">
                                    <Icon icon={FaHistory} className="text-gray-400" />
                                    <span className="text-white">Trading History</span>
                                  </button>
                                </div>
                              </>
                            ) : (
                              <div className="p-4">
                                <div className="text-center py-4">
                                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                                    <Icon icon={FaIdCard} className="text-white text-2xl" />
                                  </div>
                                  <h3 className="text-white font-semibold mb-2">No Dealix ID</h3>
                                  <p className="text-gray-400 text-sm mb-4">
                                    Create your Dealix ID to unlock trading discounts, badges, and rewards!
                                  </p>
                                  <button 
                                    onClick={() => {
                                      setShowCreateDealixModal(true);
                                      setShowProfileDropdown(false);
                                    }}
                                    className="w-full py-2 rounded-lg bg-gradient-to-r from-green-400 to-blue-500 text-white font-semibold hover:shadow-lg hover:shadow-green-400/30 transition-all"
                                  >
                                    Create Dealix ID
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Bottom Section - Always visible */}
                            <div className="border-t border-white/10 py-2">
                              <button className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/10 transition-colors">
                                <Icon icon={FaCog} className="text-gray-400" />
                                <span className="text-white">Settings</span>
                              </button>
                              <button 
                                onClick={() => open()}
                                className="w-full px-4 py-3 flex items-center space-x-3 hover:bg-white/10 transition-colors text-gray-400"
                              >
                                <span>Disconnect</span>
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
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
                  <>
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

                    {/* Dealix Status or Create Button */}
                    {hasDealixId && dealixProfile ? (
                      <div className="glass rounded-xl p-4 mb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-gray-400">Dealix ID</div>
                            <div className="text-lg font-bold text-white">#{dealixProfile.dealixId}</div>
                            <div className="text-xs" style={{ color: tierColors[dealixProfile.tier] }}>
                              {tierNames[dealixProfile.tier]} • {dealixProfile.badges} badges
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-400">Bonus</div>
                            <div className="text-lg font-bold text-green-400">
                              +{(dealixProfile.tier * 0.05 + Math.min(dealixProfile.streak * 0.05, 2)).toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setShowCreateDealixModal(true);
                          setMobileMenuOpen(false);
                        }}
                        className="w-full glass rounded-xl p-4 mb-4 text-center bg-gradient-to-r from-green-400/10 to-blue-500/10 border border-green-400/30"
                      >
                        <p className="text-green-400 font-semibold">Create Dealix ID</p>
                        <p className="text-gray-400 text-xs mt-1">Unlock discounts & rewards</p>
                      </button>
                    )}
                  </>
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

                {/* Navigation Tabs */}
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                      activeTab === tab.id 
                        ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-white' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Create Dealix Modal */}
      <CreateDealixModal 
        isOpen={showCreateDealixModal} 
        onClose={() => setShowCreateDealixModal(false)} 
      />
    </>
  );
};
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { StakeModalProps } from '../../types';
import { formatBalance } from '../../utils/formatters';
import { ERC20_ABI } from '../../constants/contracts';

interface ExtendedStakeModalProps extends StakeModalProps {
  walletProvider?: any;
}

export const StakeModal: React.FC<ExtendedStakeModalProps> = ({
  isOpen,
  onClose,
  pool,
  mode,
  onConfirm,
  walletProvider
}) => {
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState('0');

  const loadBalance = useCallback(async () => {
    if (!walletProvider) return;
    
    try {
      const provider = new ethers.providers.Web3Provider(walletProvider);
      const lpContract = new ethers.Contract(pool.lpToken, ERC20_ABI, provider);
      
      if (mode === 'stake') {
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
          const bal = await lpContract.balanceOf(accounts[0]);
          setBalance(ethers.utils.formatUnits(bal, 18));
        }
      } else {
        setBalance(ethers.utils.formatUnits(pool.userStaked || '0', 18));
      }
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  }, [walletProvider, pool.lpToken, pool.userStaked, mode]);

  useEffect(() => {
    if (isOpen) {
      loadBalance();
    }
  }, [isOpen, loadBalance]);

  const handleMax = () => {
    setAmount(balance);
  };

  const handleConfirm = () => {
    if (parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(balance)) {
      onConfirm(amount);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl p-6 w-full max-w-md border border-white/10" onClick={e => e.stopPropagation()}>
              <h3 className="text-xl font-bold text-white mb-4">
                {mode === 'stake' ? 'Stake' : 'Unstake'} {pool.lpSymbol} LP
              </h3>
              
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Available</span>
                  <span className="text-white">{formatBalance(balance)} LP</span>
                </div>
                
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-3 pr-16 bg-gray-900/50 rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 border border-white/10"
                  />
                  <button
                    onClick={handleMax}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 hover:from-purple-600/30 hover:to-blue-600/30 rounded-lg text-emerald-400 text-sm font-medium transition-all"
                  >
                    MAX
                  </button>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-gray-800/50 backdrop-blur-sm rounded-xl text-white font-medium border border-white/10 hover:border-emerald-500/30 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > parseFloat(balance)}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
                >
                  {mode === 'stake' ? 'Stake' : 'Unstake'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
import React from 'react';
import { motion } from 'framer-motion';
import { LiquidityTabType } from '../../types';

interface LiquidityInterfaceProps {
  activeTab: LiquidityTabType;
  setActiveTab: (tab: LiquidityTabType) => void;
  children: React.ReactNode;
  isConnected?: boolean;
}

export const LiquidityInterface: React.FC<LiquidityInterfaceProps> = ({
  activeTab,
  setActiveTab,
  children
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      <div className="glass glow-purple rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        {/* Enhanced Background decoration with better color separation */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/15 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-600/15 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl"></div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex flex-col items-center sm:items-start mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white text-center sm:text-left">Liquidity</h2>
            <p className="text-gray-500 text-sm mt-1 text-center sm:text-left">Add or remove liquidity</p>
          </div>

          {/* Enhanced Tab Selector */}
          <div className="relative glass rounded-2xl p-1 mb-6 w-full border border-emerald-500/10">
            <div className="relative flex w-full">
              <motion.div
                className="absolute inset-y-0 gradient-button rounded-xl shadow-lg"
                initial={false}
                animate={{
                  left: activeTab === 'add' ? '0%' : '50%',
                  right: activeTab === 'add' ? '50%' : '0%',
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                }}
              />
              <button
                onClick={() => setActiveTab('add')}
                className={`relative z-10 flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-medium transition-all text-center text-sm sm:text-base ${
                  activeTab === 'add' 
                    ? 'text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className={`w-4 h-4 ${activeTab === 'add' ? 'text-white' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Add Liquidity</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('remove')}
                className={`relative z-10 flex-1 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-medium transition-all text-center text-sm sm:text-base ${
                  activeTab === 'remove' 
                    ? 'text-white' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className={`w-4 h-4 ${activeTab === 'remove' ? 'text-white' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                  <span>Remove Liquidity</span>
                </div>
              </button>
            </div>
          </div>

          {/* Optional: Add info banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6 p-3 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 rounded-xl border border-emerald-500/20"
          >
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs sm:text-sm text-gray-300">
                {activeTab === 'add' 
                  ? "Earn trading fees by providing liquidity to pools"
                  : "Remove your liquidity to receive back your tokens"
                }
              </p>
            </div>
          </motion.div>

          {children}
        </div>

        {/* Optional: Add a subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 35px,
              rgba(16, 185, 129, 0.1) 35px,
              rgba(16, 185, 129, 0.1) 70px
            )`
          }}></div>
        </div>
      </div>
    </motion.div>
  );
};
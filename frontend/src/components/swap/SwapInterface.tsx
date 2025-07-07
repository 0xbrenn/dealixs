import React from 'react';
import { motion } from 'framer-motion';
import { Token } from '../../types';
import { TokenInput } from '../common/TokenInput';
import { SwapButton } from './SwapButton';
import { SwapSettings } from './SwapSettings';

interface SwapInterfaceProps {
  fromToken: Token;
  toToken: Token;
  fromAmount: string;
  toAmount: string;
  onFromAmountChange: (value: string) => void;
  onFromTokenSelect: () => void;
  onToTokenSelect: () => void;
  onSwapTokens: () => void;
  onSwap: () => void;
  isConnected: boolean;
  loading?: boolean;
  showSettings: boolean;
  onSettingsToggle: () => void;
  slippage: string;
  onSlippageChange: (value: string) => void;
}

export const SwapInterface: React.FC<SwapInterfaceProps> = ({
  fromToken,
  toToken,
  fromAmount,
  toAmount,
  onFromAmountChange,
  onFromTokenSelect,
  onToTokenSelect,
  onSwapTokens,
  onSwap,
  isConnected,
  loading = false,
  showSettings,
  onSettingsToggle,
  slippage,
  onSlippageChange
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      <div className="glass rounded-3xl p-6 sm:p-8 relative overflow-hidden" style={{
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Background decoration with Dealix colors */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#00FF4D]/10 rounded-full blur-xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-xl"></div>
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Swap</h2>
              <p className="text-gray-400 text-sm mt-1">Trade tokens instantly</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05, rotate: 90 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSettingsToggle}
              className="p-3 glass glass-hover rounded-2xl transition-all group"
            >
              <svg className="w-5 h-5 text-gray-400 group-hover:text-[#00FF4D] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </motion.button>
          </div>

          <div className="space-y-4">
            <TokenInput
              value={fromAmount}
              onChange={onFromAmountChange}
              token={fromToken}
              onTokenSelect={onFromTokenSelect}
              label="From"
              balance={fromToken.balance}
              onMax={() => onFromAmountChange(fromToken.balance || '0')}
            />

            <div className="flex justify-center -my-2 relative z-10">
              <motion.button
                whileHover={{ scale: 1.1, rotate: 180 }}
                whileTap={{ scale: 0.9 }}
                onClick={onSwapTokens}
                className="p-3 glass glass-hover rounded-2xl border border-white/10 shadow-lg group relative overflow-hidden transition-all"
              >
                {/* Gradient background on hover with VIBRANT colors */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#00FF4D]/30 to-cyan-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-[#00FF4D] transition-colors relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </motion.button>
            </div>

            <TokenInput
              value={toAmount}
              onChange={() => {}} // Read only
              token={toToken}
              onTokenSelect={onToTokenSelect}
              label="To"
              balance={toToken.balance}
              disabled={true}
            />

            {fromAmount && toAmount && parseFloat(fromAmount) > 0 && parseFloat(toAmount) > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="overflow-hidden"
              >
                <div className="glass rounded-2xl p-4 space-y-3 border border-[#00FF4D]/20">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Rate</span>
                    <span className="text-white text-sm font-medium">
                      1 {fromToken.symbol} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Slippage Tolerance</span>
                    <span className="text-[#00FF4D] text-sm font-medium">{slippage}%</span>
                  </div>
                  {/* Optional: Add more trade details */}
                  <div className="pt-2 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-xs">Min. Received</span>
                      <span className="text-gray-300 text-xs font-medium">
                        {(parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(6)} {toToken.symbol}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <SwapButton
              isConnected={isConnected}
              hasAmount={!!fromAmount && parseFloat(fromAmount) > 0}
              exceedsBalance={parseFloat(fromAmount || '0') > parseFloat(fromToken.balance || '0')}
              loading={loading || false}
              onSwap={onSwap}
              fromToken={fromToken}
              toToken={toToken}
            />
          </div>
        </div>
      </div>

      {/* Settings Modal - Rendered outside main content */}
      <SwapSettings 
        isOpen={showSettings}
        slippage={slippage}
        onSlippageChange={onSlippageChange}
        onClose={onSettingsToggle}
      />
    </motion.div>
  );
};
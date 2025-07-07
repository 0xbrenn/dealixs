import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SwapSettingsProps {
  isOpen: boolean;
  slippage: string;
  onSlippageChange: (value: string) => void;
  onClose: () => void;
}

export const SwapSettings: React.FC<SwapSettingsProps> = ({
  isOpen,
  slippage,
  onSlippageChange,
  onClose
}) => {
  const presetSlippages = ['0.1', '0.5', '1.0'];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Background Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50"
            onClick={onClose}
          />
          
          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div 
              className="bg-[#0A0A0B]/95 rounded-3xl p-6 max-w-md w-full relative overflow-hidden pointer-events-auto border border-white/5"
              onClick={(e) => e.stopPropagation()}
              style={{
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
              }}
            >
              {/* Background decoration with Dealix colors */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#00FF4D]/10 rounded-full blur-xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-xl"></div>
              </div>

              {/* Content */}
              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Transaction Settings</h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-[#00FF4D] transition-colors p-2 hover:bg-[#00FF4D]/10 rounded-xl"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Slippage Tolerance Section */}
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-400 text-sm mb-3 block">
                      Slippage Tolerance
                    </label>
                    <div className="flex space-x-2 mb-3">
                      {presetSlippages.map((preset) => (
                        <motion.button
                          key={preset}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => onSlippageChange(preset)}
                          className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                            slippage === preset
                              ? 'bg-[#00FF4D]/20 text-[#00FF4D] border border-[#00FF4D]/50'
                              : 'bg-gray-900/50 text-gray-400 hover:text-white hover:border-[#00FF4D]/20 border border-white/5'
                          }`}
                        >
                          {preset}%
                        </motion.button>
                      ))}
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        value={slippage}
                        onChange={(e) => onSlippageChange(e.target.value)}
                        placeholder="0.5"
                        className="flex-1 bg-gray-900/50 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00FF4D]/50 focus:border-[#00FF4D]/50 transition-all placeholder-gray-500 border border-white/5"
                        step="0.1"
                        min="0"
                        max="50"
                      />
                      <span className="text-gray-400 text-sm px-2">%</span>
                    </div>
                    {parseFloat(slippage) > 5 && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="text-yellow-400 text-xs mt-3 p-3 bg-yellow-400/10 rounded-xl border border-yellow-400/20"
                      >
                        ⚠️ High slippage tolerance. Your transaction may be frontrun.
                      </motion.p>
                    )}
                  </div>

                  {/* Transaction Deadline Section */}
                  <div className="pt-5 border-t border-white/10">
                    <label className="text-gray-400 text-sm mb-3 block">
                      Transaction Deadline
                    </label>
                    <div className="bg-gray-900/50 rounded-xl p-4 border border-white/5 hover:border-[#00FF4D]/20 transition-all">
                      <div className="flex justify-between items-center">
                        <span className="text-white text-sm">Current setting</span>
                        <span className="text-white font-medium">20 minutes</span>
                      </div>
                    </div>
                  </div>

                  {/* Additional Settings Info */}
                  <div className="pt-5 border-t border-white/10">
                    <div className="space-y-3">
                      <div className="flex items-start space-x-2">
                        <svg className="w-4 h-4 text-[#00FF4D] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-gray-400 text-xs">
                            Slippage tolerance is the maximum price change you're willing to accept.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <svg className="w-4 h-4 text-cyan-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="text-gray-400 text-xs">
                            Transactions will revert if pending for longer than the deadline.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
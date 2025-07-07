import React from 'react';
import { motion } from 'framer-motion';
import { LiquidityPosition } from '../../types';
import { LiquidityPositions } from './LiquidityPositions';

interface RemoveLiquidityProps {
  position: LiquidityPosition | null;
  removePercentage: number;
  onPercentageChange: (percentage: number) => void;
  onRemove: () => void;
  loading?: boolean;
  positions: LiquidityPosition[];
  onSelectPosition: (position: LiquidityPosition) => void;
}

export const RemoveLiquidity: React.FC<RemoveLiquidityProps> = ({
  position,
  removePercentage,
  onPercentageChange,
  onRemove,
  loading = false,
  positions,
  onSelectPosition
}) => {
  return (
    <div className="space-y-6">
      <LiquidityPositions
        positions={positions}
        onSelectPosition={onSelectPosition}
        selectedPosition={position}
      />

      {position && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="glass rounded-2xl p-5 border border-[#00FF4D]/10">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex -space-x-2">
                <img
                  src={position.token0.logoURI || 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png'}
                  alt={position.token0.symbol}
                  className="w-10 h-10 rounded-full border-2 border-gray-900"
                />
                <img
                  src={position.token1.logoURI || 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png'}
                  alt={position.token1.symbol}
                  className="w-10 h-10 rounded-full border-2 border-gray-900"
                />
              </div>
              <div>
                <div className="text-white font-semibold text-lg">
                  {position.token0.symbol}/{position.token1.symbol}
                </div>
                <div className="text-gray-400 text-sm">
                  Pool Share: <span className="text-[#00FF4D]">{position.poolShare}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-sm mb-3 block">
                Remove Amount: <span className="text-white font-medium">{removePercentage}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={removePercentage}
                onChange={(e) => onPercentageChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #00FF4D 0%, #00FF4D ${removePercentage}%, #374151 ${removePercentage}%, #374151 100%)`
                }}
              />
              <div className="flex justify-between mt-3">
                {[25, 50, 75, 100].map((percent) => (
                  <motion.button
                    key={percent}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onPercentageChange(percent)}
                    className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all ${
                      removePercentage === percent
                        ? 'bg-[#00FF4D]/20 text-[#00FF4D] border border-[#00FF4D]/50 shadow-[0_0_10px_rgba(0,255,77,0.3)]'
                        : 'glass glass-hover text-gray-400 hover:text-white hover:border-[#00FF4D]/20'
                    }`}
                  >
                    {percent}%
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="glass rounded-2xl p-4 space-y-3 border border-cyan-500/10">
              <div className="flex justify-between">
                <span className="text-gray-400">{position.token0.symbol}</span>
                <span className="text-white font-medium">
                  {((parseFloat(position.token0Deposited) * removePercentage) / 100).toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{position.token1.symbol}</span>
                <span className="text-white font-medium">
                  {((parseFloat(position.token1Deposited) * removePercentage) / 100).toFixed(4)}
                </span>
              </div>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
             <button
  onClick={onRemove}
  disabled={loading}
  className={`
    w-full py-4 px-6 rounded-2xl font-semibold text-lg transition-all relative overflow-hidden
    ${loading
      ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
      : 'bg-gradient-to-r from-[#FF0044] to-[#FF0088] text-white shadow-lg hover:shadow-xl'
    }
  `}
  style={{
    boxShadow: !loading 
      ? '0 4px 20px rgba(255, 0, 68, 0.3), 0 0 40px rgba(255, 0, 136, 0.2)' 
      : undefined
  }}
>
  {/* Animated overlay for hover effect */}
  {!loading && (
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 transform translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-700"></div>
  )}
  
  {/* Subtle pulse effect */}
  {!loading && (
    <div className="absolute inset-0 rounded-2xl">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#FF0044] to-[#FF0088] opacity-30 blur-md animate-pulse"></div>
    </div>
  )}

  {loading ? (
    <span className="flex items-center justify-center space-x-2 relative z-10">
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span>Processing...</span>
    </span>
  ) : (
    <span className="relative z-10 flex items-center justify-center">
      Remove Liquidity
      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
      </svg>
    </span>
  )}
</button>
            </motion.div>
          </div>
        </motion.div>
      )}

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, #00FF4D 0%, #06B6D4 100%);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 15px rgba(0, 255, 77, 0.6);
          border: 2px solid #0A0A0B;
          transition: all 0.2s;
        }
        
        .slider::-webkit-slider-thumb:hover {
          box-shadow: 0 0 20px rgba(0, 255, 77, 0.8);
          transform: scale(1.1);
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, #00FF4D 0%, #06B6D4 100%);
          border-radius: 50%;
          cursor: pointer;
          border: 2px solid #0A0A0B;
          box-shadow: 0 0 15px rgba(0, 255, 77, 0.6);
          transition: all 0.2s;
        }
        
        .slider::-moz-range-thumb:hover {
          box-shadow: 0 0 20px rgba(0, 255, 77, 0.8);
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
};
import React from 'react';
import { motion } from 'framer-motion';
import { LiquidityPosition } from '../../types';

interface LiquidityPositionsProps {
  positions: LiquidityPosition[];
  onSelectPosition: (position: LiquidityPosition) => void;
  selectedPosition: LiquidityPosition | null;
}

export const LiquidityPositions: React.FC<LiquidityPositionsProps> = ({
  positions,
  onSelectPosition,
  selectedPosition
}) => {
  if (positions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800/50 mb-4">
          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </div>
        <p className="text-gray-400 text-lg">No liquidity positions found</p>
        <p className="text-gray-500 text-sm mt-1">Add liquidity to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-white font-semibold text-lg mb-4">Your Positions</h3>
      
      {positions.map((position, index) => (
        <motion.button
          key={position.pair}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectPosition(position)}
          className={`w-full p-5 rounded-2xl transition-all flex items-center justify-between group ${
            selectedPosition?.pair === position.pair
              ? 'bg-emerald-500/20 border border-emerald-500/50'
              : 'glass glass-hover'
          }`}
        >
          <div className="flex items-center space-x-4">
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
            <div className="text-left">
              <div className="text-white font-semibold text-lg">
                {position.token0.symbol}/{position.token1.symbol}
              </div>
              <div className="text-gray-400 text-sm">
                Pool Share: <span className="text-emerald-400">{position.poolShare}%</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-white font-medium">
              {parseFloat(position.token0Deposited).toFixed(4)} {position.token0.symbol}
            </div>
            <div className="text-white font-medium">
              {parseFloat(position.token1Deposited).toFixed(4)} {position.token1.symbol}
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
};
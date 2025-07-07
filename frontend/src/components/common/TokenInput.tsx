import React from 'react';
import { motion } from 'framer-motion';
import { Token } from '../../types';

interface TokenInputProps {
  value: string;
  onChange: (value: string) => void;
  token: Token;
  onTokenSelect: () => void;
  balance?: string;
  disabled?: boolean;
  label?: string;
  onMax?: () => void;
}

export const TokenInput: React.FC<TokenInputProps> = ({
  value,
  onChange,
  token,
  onTokenSelect,
  balance,
  disabled = false,
  label,
  onMax
}) => {
  return (
    <div className="glass rounded-2xl p-5 transition-all">
      {label && (
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-500 text-sm font-medium">{label}</span>
          {balance && (
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 text-sm">
                Balance: <span className="text-gray-400 font-medium">{parseFloat(balance).toFixed(4)}</span>
              </span>
              {onMax && !disabled && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onMax}
                  className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
                >
                  MAX
                </motion.button>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="flex items-center space-x-3">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.0"
          disabled={disabled}
          className="bg-transparent text-3xl sm:text-4xl text-white outline-none flex-1 placeholder-gray-600 min-w-0 font-light"
          onWheel={(e) => e.currentTarget.blur()}
        />
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onTokenSelect}
          className="flex items-center space-x-2 glass glass-hover px-4 py-3 rounded-2xl transition-all min-w-[120px]"
        >
          <img 
            src={token.logoURI || 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png'} 
            alt={token.symbol}
            className="w-6 h-6 rounded-full"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/generic.png';
            }}
          />
          <span className="text-white font-semibold">{token.symbol}</span>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.button>
      </div>
    </div>
  );
};
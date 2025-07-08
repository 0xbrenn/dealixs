import React from 'react';
import { motion } from 'framer-motion';

interface PriceImpactWarningProps {
  priceImpact: number;
}

export const PriceImpactWarning: React.FC<PriceImpactWarningProps> = ({ priceImpact }) => {
  if (priceImpact < 1) return null;
  
  const severity = priceImpact > 10 ? 'high' : priceImpact > 5 ? 'medium' : 'low';
  
  const colors = {
    high: 'bg-red-500/20 border-red-500 text-red-400',
    medium: 'bg-yellow-500/20 border-yellow-500 text-yellow-400',
    low: 'bg-blue-500/20 border-blue-500 text-blue-400'
  };
  
  const messages = {
    high: 'High price impact! Consider splitting into smaller trades.',
    medium: 'Moderate price impact detected.',
    low: 'Low price impact.'
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className={`rounded-xl p-3 border ${colors[severity]} mb-4`}
    >
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div className="text-sm">
          <span className="font-medium">Price Impact: {priceImpact.toFixed(2)}%</span>
          <p className="text-xs mt-1">{messages[severity]}</p>
        </div>
      </div>
    </motion.div>
  );
};
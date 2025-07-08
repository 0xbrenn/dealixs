import React from 'react';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaCircle, FaInfoCircle } from 'react-icons/fa';
import { useDealix } from '../../contexts/DealixContext';
import { formatBalance } from '../../utils/formatters';
import { Icon } from '../common/Icon';

interface DiscountSelectorProps {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  onDiscountChange?: (totalDiscount: number) => void;
}

export const DiscountSelector: React.FC<DiscountSelectorProps> = ({
  tokenIn,
  tokenOut,
  amountIn,
  onDiscountChange
}) => {
  const {
    availableDiscounts,
    affiliateDiscounts,
    selectedDiscounts,
    selectedAffiliateDiscount,
    selectDiscount,
    deselectDiscount,
    selectAffiliateDiscount,
    dealixProfile
  } = useDealix();

  const handlePoolToggle = (poolId: number) => {
    if (selectedDiscounts.includes(poolId)) {
      deselectDiscount(poolId);
    } else {
      selectDiscount(poolId);
    }
  };

  const handleAffiliateToggle = (discountId: number) => {
    if (selectedAffiliateDiscount === discountId) {
      selectAffiliateDiscount(null);
    } else {
      selectAffiliateDiscount(discountId);
    }
  };

  // Calculate total discount
  const calculateTotalDiscount = () => {
    let total = 0;
    
    // Pool discounts
    selectedDiscounts.forEach(poolId => {
      const pool = availableDiscounts.find(p => p.id === poolId);
      if (pool && parseFloat(amountIn) >= parseFloat(pool.minTradeSize)) {
        total += pool.discountPercentage / 100;
      }
    });
    
    // Affiliate discount
    if (selectedAffiliateDiscount) {
      const affiliate = affiliateDiscounts.find(a => a.id === selectedAffiliateDiscount);
      if (affiliate) {
        total += affiliate.discountPercentage / 100;
      }
    }
    
    // Tier and streak bonuses
    if (dealixProfile) {
      total += dealixProfile.tier * 0.05;
      total += Math.min(dealixProfile.streak * 0.05, 2);
    }
    
    return Math.min(total, 50); // Cap at 50%
  };

  React.useEffect(() => {
    const total = calculateTotalDiscount();
    onDiscountChange?.(total);
  }, [selectedDiscounts, selectedAffiliateDiscount, amountIn]);

  const totalDiscount = calculateTotalDiscount();

  if (availableDiscounts.length === 0 && affiliateDiscounts.length === 0 && !dealixProfile) {
    return null;
  }

  return (
    <div className="glass rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center space-x-2">
          <span>🏷️</span>
          <span>Available Discounts</span>
        </h3>
        <div className="text-green-400 font-bold">
          Total: {totalDiscount.toFixed(2)}%
        </div>
      </div>

      <div className="space-y-3">
        {/* Built-in Bonuses */}
        {dealixProfile && (
          <>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div className="flex items-center space-x-3">
                <Icon icon={FaCheckCircle} className="text-green-400" />
                <div>
                  <p className="text-white text-sm">Tier {dealixProfile.tier} Bonus</p>
                  <p className="text-gray-500 text-xs">Automatic discount for your tier</p>
                </div>
              </div>
              <span className="text-green-400 font-semibold">
                +{(dealixProfile.tier * 0.05).toFixed(2)}%
              </span>
            </div>

            {dealixProfile.streak > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <div className="flex items-center space-x-3">
                  <Icon icon={FaCheckCircle} className="text-orange-400" />
                  <div>
                    <p className="text-white text-sm">{dealixProfile.streak} Day Streak</p>
                    <p className="text-gray-500 text-xs">Keep trading daily for bonuses</p>
                  </div>
                </div>
                <span className="text-orange-400 font-semibold">
                  +{Math.min(dealixProfile.streak * 0.05, 2).toFixed(2)}%
                </span>
              </div>
            )}
          </>
        )}

        {/* Discount Pools */}
        {availableDiscounts.map(pool => {
          const isSelected = selectedDiscounts.includes(pool.id);
          const meetsMinimum = parseFloat(amountIn) >= parseFloat(pool.minTradeSize);
          const isEligible = meetsMinimum;

          return (
            <motion.div
              key={pool.id}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                isSelected 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : isEligible
                    ? 'bg-white/5 border-white/10 hover:border-white/20'
                    : 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
              }`}
              onClick={() => isEligible && handlePoolToggle(pool.id)}
              whileHover={isEligible ? { scale: 1.01 } : {}}
              whileTap={isEligible ? { scale: 0.99 } : {}}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {isSelected ? (
                    <Icon icon={FaCheckCircle} className="text-green-400" />
                  ) : (
                    <Icon icon={FaCircle} className="text-gray-500" />
                  )}
                  <div>
                    <p className="text-white text-sm">LP Discount Pool</p>
                    <p className="text-gray-500 text-xs">
                      Min: {formatBalance(pool.minTradeSize)} {tokenIn}
                      {!meetsMinimum && ' (below minimum)'}
                    </p>
                  </div>
                </div>
                <span className={`font-semibold ${isSelected ? 'text-green-400' : 'text-gray-400'}`}>
                  +{(pool.discountPercentage / 100).toFixed(2)}%
                </span>
              </div>
            </motion.div>
          );
        })}

        {/* Affiliate Discounts */}
        {affiliateDiscounts.map(discount => {
          const isSelected = selectedAffiliateDiscount === discount.id;

          return (
            <motion.div
              key={discount.id}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                isSelected 
                  ? 'bg-purple-500/10 border-purple-500/30' 
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
              onClick={() => handleAffiliateToggle(discount.id)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {isSelected ? (
                    <Icon icon={FaCheckCircle} className="text-purple-400" />
                  ) : (
                    <Icon icon={FaCircle} className="text-gray-500" />
                  )}
                  <div>
                    <p className="text-white text-sm">Affiliate Discount</p>
                    <p className="text-gray-500 text-xs">
                      Remaining: {formatBalance(discount.remainingAmount)} {tokenOut}
                    </p>
                  </div>
                </div>
                <span className={`font-semibold ${isSelected ? 'text-purple-400' : 'text-gray-400'}`}>
                  +{(discount.discountPercentage / 100).toFixed(2)}%
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-start space-x-2">
          <Icon icon={FaInfoCircle} className="text-blue-400 mt-0.5" />
          <div>
            <p className="text-blue-400 text-sm font-semibold">Pro Tip</p>
            <p className="text-gray-300 text-xs mt-1">
              Stack multiple discounts for maximum savings! Discounts are automatically applied to your trade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
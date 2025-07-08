import React from 'react';
import { motion } from 'framer-motion';
import { FaTrophy, FaFire, FaChartLine, FaCoins } from 'react-icons/fa';
import { useDealix } from '../../contexts/DealixContext';
import { Icon } from '../common/Icon';

interface DealixIDCardProps {
  compact?: boolean;
}

export const DealixIDCard: React.FC<DealixIDCardProps> = ({ compact = false }) => {
  const { dealixProfile, userBadges } = useDealix();

  if (!dealixProfile) return null;

  const tierNames = ['Novice', 'Trader', 'Expert', 'Master', 'Whale', 'Legend'];
  const tierColors = ['#CD7F32', '#C0C0C0', '#FFD700', '#E5E4E2', '#B9F2FF', '#9D4EDD'];

  const formatVolume = (volume: string) => {
    const num = parseFloat(volume);
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  if (compact) {
    return (
      <motion.div 
        className="glass rounded-xl p-4 border border-white/10"
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ 
                background: `linear-gradient(135deg, ${tierColors[dealixProfile.tier]} 0%, ${tierColors[Math.min(dealixProfile.tier + 1, 5)]} 100%)` 
              }}
            >
              #{dealixProfile.dealixId}
            </div>
            <div>
              <p className="text-white font-semibold">
                {tierNames[dealixProfile.tier]} Tier
              </p>
              <p className="text-gray-400 text-sm">
                {formatVolume(dealixProfile.totalVolume)} Volume
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <p className="text-green-400 font-bold">{dealixProfile.streak}</p>
              <p className="text-gray-500 text-xs">Streak</p>
            </div>
            <div className="text-center">
              <p className="text-purple-400 font-bold">{dealixProfile.badges}</p>
              <p className="text-gray-500 text-xs">Badges</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="glass rounded-2xl p-6 border border-white/10"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div 
            className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg"
            style={{ 
              background: `linear-gradient(135deg, ${tierColors[dealixProfile.tier]} 0%, ${tierColors[Math.min(dealixProfile.tier + 1, 5)]} 100%)` 
            }}
          >
            #{dealixProfile.dealixId}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">Dealix ID #{dealixProfile.dealixId}</h3>
            <p className="text-lg" style={{ color: tierColors[dealixProfile.tier] }}>
              {tierNames[dealixProfile.tier]} Tier
            </p>
          </div>
        </div>
        
        {dealixProfile.streak > 0 && (
          <div className="flex items-center space-x-2 bg-orange-500/20 px-4 py-2 rounded-full">
            <Icon icon={FaFire} className="text-orange-500" />
            <span className="text-orange-400 font-bold">{dealixProfile.streak} Day Streak!</span>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-lg p-4 text-center">
          <Icon icon={FaChartLine} className="text-green-400 text-2xl mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{formatVolume(dealixProfile.totalVolume)}</p>
          <p className="text-gray-400 text-sm">Total Volume</p>
        </div>
        
        <div className="glass rounded-lg p-4 text-center">
          <Icon icon={FaTrophy} className="text-yellow-400 text-2xl mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{dealixProfile.badges}</p>
          <p className="text-gray-400 text-sm">Badges Earned</p>
        </div>
        
        <div className="glass rounded-lg p-4 text-center">
          <Icon icon={FaCoins} className="text-purple-400 text-2xl mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{dealixProfile.socialPoints}</p>
          <p className="text-gray-400 text-sm">Social Points</p>
        </div>
        
        <div className="glass rounded-lg p-4 text-center">
          <span className="text-2xl mb-2">🔄</span>
          <p className="text-2xl font-bold text-white">{dealixProfile.swaps}</p>
          <p className="text-gray-400 text-sm">Total Swaps</p>
        </div>
      </div>

      {/* Bonuses */}
      <div className="glass rounded-lg p-4">
        <h4 className="text-white font-semibold mb-3">Active Bonuses</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Tier Bonus</span>
            <span className="text-green-400 font-semibold">+{(dealixProfile.tier * 0.05).toFixed(2)}%</span>
          </div>
          {dealixProfile.streak > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Streak Bonus</span>
              <span className="text-orange-400 font-semibold">+{Math.min(dealixProfile.streak * 0.05, 2).toFixed(2)}%</span>
            </div>
          )}
          <div className="border-t border-white/10 pt-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-white">Total Discount Bonus</span>
              <span className="text-green-400 font-bold">
                +{(dealixProfile.tier * 0.05 + Math.min(dealixProfile.streak * 0.05, 2)).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Badges */}
      {userBadges.filter(b => b.owned).length > 0 && (
        <div className="mt-4">
          <h4 className="text-white font-semibold mb-3">Recent Badges</h4>
          <div className="flex flex-wrap gap-2">
            {userBadges
              .filter(b => b.owned)
              .slice(0, 6)
              .map(badge => (
                <motion.div
                  key={badge.id}
                  className="glass rounded-lg p-2 px-3 flex items-center space-x-2"
                  whileHover={{ scale: 1.05 }}
                  title={badge.description}
                >
                  <span className="text-lg">🏅</span>
                  <span className="text-white text-sm">{badge.name}</span>
                </motion.div>
              ))}
            {userBadges.filter(b => b.owned).length > 6 && (
              <div className="glass rounded-lg p-2 px-3 text-gray-400 text-sm">
                +{userBadges.filter(b => b.owned).length - 6} more
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};
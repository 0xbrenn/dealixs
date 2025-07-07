import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaIdCard, FaTrophy, FaChartLine, FaUsers, FaGift, FaRocket } from 'react-icons/fa';
import { useDealix } from '../../contexts/DealixContext';
import { DealixIDCard } from '../dealix/DealixIDCard';
import { CreateDealixModal } from '../dealix/CreateDealixModal';
import { Icon } from '../common/Icon';

export const DealixHub: React.FC = () => {
  const { hasDealixId, dealixProfile, userBadges } = useDealix();
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (!hasDealixId) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto"
        >
          {/* Welcome Section for Non-ID Holders */}
          <div className="text-center mb-12">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-bold text-white mb-4"
            >
              Welcome to Dealix
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-gray-400"
            >
              Your gateway to social trading and exclusive rewards
            </motion.p>
          </div>

          {/* Hero Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-3xl p-8 md:p-12 text-center mb-8"
          >
            <div className="w-32 h-32 mx-auto mb-8 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
              <Icon icon={FaIdCard} className="text-white text-6xl" />
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-4">Create Your Dealix ID</h2>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
              Join thousands of traders who are already earning rewards, unlocking discounts, 
              and building their on-chain reputation with Dealix.
            </p>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-green-400 to-blue-500 text-white font-bold text-lg hover:shadow-lg hover:shadow-green-400/30 transition-all transform hover:scale-105"
            >
              Create Dealix ID →
            </button>
          </motion.div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass rounded-2xl p-6 text-center"
            >
              <Icon icon={FaGift} className="text-green-400 text-4xl mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Trading Discounts</h3>
              <p className="text-gray-400">Save 2-5% on every trade with tier-based discounts</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="glass rounded-2xl p-6 text-center"
            >
              <Icon icon={FaTrophy} className="text-yellow-400 text-4xl mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Earn Badges</h3>
              <p className="text-gray-400">Collect achievements and show off your trading skills</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="glass rounded-2xl p-6 text-center"
            >
              <Icon icon={FaUsers} className="text-purple-400 text-4xl mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Join Community</h3>
              <p className="text-gray-400">Access exclusive deals and affiliate programs</p>
            </motion.div>
          </div>

          {/* Stats Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="glass rounded-2xl p-8 text-center"
          >
            <h3 className="text-2xl font-bold text-white mb-6">Platform Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="text-4xl font-bold text-green-400">1,234</p>
                <p className="text-gray-400 mt-2">Active Traders</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-blue-400">$2.5M</p>
                <p className="text-gray-400 mt-2">Total Volume</p>
              </div>
              <div>
                <p className="text-4xl font-bold text-purple-400">5,678</p>
                <p className="text-gray-400 mt-2">Badges Earned</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <CreateDealixModal 
          isOpen={showCreateModal} 
          onClose={() => setShowCreateModal(false)} 
        />
      </>
    );
  }

  // Content for users WITH Dealix ID
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Dealix Dashboard</h1>
        <p className="text-gray-400">Manage your trading identity and rewards</p>
      </div>

      {/* Profile Card */}
      <div className="mb-8">
        <DealixIDCard />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="glass rounded-xl p-6 text-left hover:bg-white/5 transition-all"
        >
          <Icon icon={FaGift} className="text-green-400 text-3xl mb-3" />
          <h3 className="text-white font-semibold mb-1">Create Discount</h3>
          <p className="text-gray-400 text-sm">Set up a new discount pool</p>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="glass rounded-xl p-6 text-left hover:bg-white/5 transition-all"
        >
          <Icon icon={FaChartLine} className="text-blue-400 text-3xl mb-3" />
          <h3 className="text-white font-semibold mb-1">View Analytics</h3>
          <p className="text-gray-400 text-sm">Track your trading performance</p>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="glass rounded-xl p-6 text-left hover:bg-white/5 transition-all"
        >
          <Icon icon={FaRocket} className="text-purple-400 text-3xl mb-3" />
          <h3 className="text-white font-semibold mb-1">Affiliate Portal</h3>
          <p className="text-gray-400 text-sm">Manage your affiliate campaigns</p>
        </motion.button>
      </div>

      {/* Badge Collection */}
      {userBadges && userBadges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-2xl font-bold text-white mb-4">Your Badge Collection</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {userBadges.map((badge, index) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: badge.owned ? 1 : 0.3, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className={`glass rounded-lg p-4 text-center ${
                  badge.owned ? 'border border-green-400/30' : 'opacity-50'
                }`}
              >
                <div className="text-3xl mb-2">🏅</div>
                <p className="text-white text-sm font-semibold">{badge.name}</p>
                <p className="text-gray-400 text-xs mt-1">{badge.description}</p>
                {!badge.owned && (
                  <p className="text-gray-500 text-xs mt-2">Locked</p>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Leaderboard Preview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-6 mt-8"
      >
        <h2 className="text-2xl font-bold text-white mb-4">Leaderboard</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🥇</span>
              <span className="text-white font-semibold">CryptoWhale.eth</span>
            </div>
            <span className="text-gray-400">$5.2M Volume</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🥈</span>
              <span className="text-white font-semibold">DeFiDegen</span>
            </div>
            <span className="text-gray-400">$3.8M Volume</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🥉</span>
              <span className="text-white font-semibold">You</span>
            </div>
            <span className="text-gray-400">${dealixProfile?.totalVolume || '0'} Volume</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
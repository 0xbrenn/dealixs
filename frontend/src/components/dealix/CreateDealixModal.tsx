import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaGift, FaChartLine, FaTrophy, FaUsers } from 'react-icons/fa';
import { useDealix } from '../../contexts/DealixContext';
import { Icon } from '../common/Icon';

interface CreateDealixModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateDealixModal: React.FC<CreateDealixModalProps> = ({ isOpen, onClose }) => {
  const { createDealixId, mintingFee, isLoading } = useDealix();
  const [referralCode, setReferralCode] = useState('');

  const handleCreate = async () => {
    await createDealixId(referralCode || undefined);
    onClose();
  };

  const benefits = [
    {
      icon: FaGift,
      title: "Trading Discounts",
      description: "Get up to 5% off on every trade"
    },
    {
      icon: FaChartLine,
      title: "Tiered Benefits",
      description: "Unlock better rates as you trade more"
    },
    {
      icon: FaTrophy,
      title: "Earn Badges",
      description: "Collect achievements and show off your skills"
    },
    {
      icon: FaUsers,
      title: "Join Community",
      description: "Access exclusive deals and affiliate programs"
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="glass rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Create Your Dealix ID</h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <Icon icon={FaTimes} size={24} />
                </button>
              </div>

              {/* Hero Section */}
              <div className="text-center mb-8">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                  <span className="text-4xl">🆔</span>
                </div>
                <p className="text-gray-300">
                  Join the social trading revolution and unlock exclusive benefits
                </p>
              </div>

              {/* Benefits Grid */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="glass rounded-lg p-4 text-center"
                  >
                    <div className="mb-2">
                      <Icon 
                        icon={benefit.icon} 
                        className={
                          benefit.icon === FaGift ? "text-green-400 text-2xl" :
                          benefit.icon === FaChartLine ? "text-blue-400 text-2xl" :
                          benefit.icon === FaTrophy ? "text-yellow-400 text-2xl" :
                          "text-purple-400 text-2xl"
                        } 
                      />
                    </div>
                    <h3 className="text-white font-semibold mb-1">{benefit.title}</h3>
                    <p className="text-gray-400 text-sm">{benefit.description}</p>
                  </motion.div>
                ))}
              </div>

              {/* Early Adopter Badge */}
              <div className="glass rounded-lg p-4 mb-6 border border-yellow-500/30 bg-yellow-500/10">
                <div className="flex items-center space-x-3">
                  <span className="text-3xl">🏅</span>
                  <div>
                    <h4 className="text-yellow-400 font-semibold">Limited Time: Early Adopter Badge</h4>
                    <p className="text-gray-300 text-sm">
                      Be one of the first 1000 users and earn an exclusive badge!
                    </p>
                  </div>
                </div>
              </div>

              {/* Referral Input */}
              <div className="mb-6">
                <label className="block text-gray-400 text-sm mb-2">
                  Referral Code (Optional)
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value)}
                  placeholder="Enter referral address"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition-colors"
                />
                <p className="text-gray-500 text-xs mt-1">
                  Both you and your referrer will receive bonus rewards
                </p>
              </div>

              {/* Cost */}
              <div className="glass rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Minting Fee</span>
                  <span className="text-white font-semibold">{mintingFee} ETH</span>
                </div>
                <p className="text-gray-500 text-sm mt-2">
                  One-time fee to create your permanent on-chain identity
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-lg border border-white/20 text-white hover:bg-white/10 transition-all"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-lg bg-gradient-to-r from-green-400 to-blue-500 text-white font-semibold hover:shadow-lg hover:shadow-green-400/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Creating...' : 'Create Dealix ID'}
                </button>
              </div>

              {/* Footer Note */}
              <p className="text-center text-gray-500 text-xs mt-4">
                By creating a Dealix ID, you agree to participate in the social trading ecosystem
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
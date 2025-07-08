import React from 'react';
import { TabType } from '../../types';

interface TabNavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, setActiveTab }) => {
  return (
    <div className="hidden sm:flex bg-gray-800/30 backdrop-blur-lg rounded-2xl p-1.5 space-x-1 mb-8">
      <button
        onClick={() => setActiveTab('swap')}
        className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
          activeTab === 'swap'
            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
        }`}
      >
        Swap
      </button>
      <button
        onClick={() => setActiveTab('liquidity')}
        className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all ${
          activeTab === 'liquidity'
            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
        }`}
      >
        Liquidity
      </button>
    </div>
  );
};
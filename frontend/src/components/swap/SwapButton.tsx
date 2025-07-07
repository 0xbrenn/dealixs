import React from 'react';
import { motion } from 'framer-motion';
import { Token } from '../../types';
import { WETH_ADDRESS } from '../../constants/contracts';
import { useAppKit } from '@reown/appkit/react';

interface SwapButtonProps {
  isConnected: boolean;
  hasAmount: boolean;
  exceedsBalance: boolean;
  loading: boolean;
  onSwap: () => void;
  fromToken: Token;
  toToken: Token;
}

export const SwapButton: React.FC<SwapButtonProps> = ({
  isConnected,
  hasAmount,
  exceedsBalance,
  loading,
  onSwap,
  fromToken,
  toToken
}) => {
  const { open } = useAppKit();

  // Handle button click
  const handleClick = async () => {
    if (!isConnected) {
      // Open the Reown wallet modal
      await open();
    } else {
      onSwap();
    }
  };

  // Determine button text based on connection state and token pair
  const isNativeToken = (address: string) => address === '0x0000000000000000000000000000000000000000';
  
  let buttonText = 'Connect Wallet';
  let disabled = !isConnected;

  if (isConnected) {
    if (!hasAmount) {
      buttonText = 'Enter Amount';
      disabled = true;
    } else if (exceedsBalance) {
      buttonText = 'Insufficient Balance';
      disabled = true;
    } else {
      // Check if it's a wrap or unwrap operation
      if (isNativeToken(fromToken.address) && toToken.address === WETH_ADDRESS) {
        buttonText = 'Wrap';
      } else if (fromToken.address === WETH_ADDRESS && isNativeToken(toToken.address)) {
        buttonText = 'Unwrap';
      } else {
        buttonText = 'Swap';
      }
      disabled = false;
    }
  }

  return (
    <motion.div
      whileHover={!loading ? { scale: 1.02 } : {}}
      whileTap={!loading ? { scale: 0.98 } : {}}
    >
      <button
        onClick={handleClick}
        disabled={loading}
        className={`
          w-full py-4 px-6 rounded-2xl font-semibold text-lg transition-all
          ${!isConnected
            ? 'gradient-button text-white shadow-lg glow-purple-lg hover:shadow-xl cursor-pointer'
            : disabled || loading
            ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
            : 'gradient-button text-white shadow-lg glow-purple-lg hover:shadow-xl'
          }
        `}
      >
        {loading ? (
          <span className="flex items-center justify-center space-x-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Processing...</span>
          </span>
        ) : (
          <span className="relative z-10">{buttonText}</span>
        )}
        
      </button>
    </motion.div>
  );
};
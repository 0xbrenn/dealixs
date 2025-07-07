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
      whileHover={!loading && !disabled ? { scale: 1.02 } : {}}
      whileTap={!loading && !disabled ? { scale: 0.98 } : {}}
    >
      <button
        onClick={handleClick}
        disabled={loading}
        className={`
          w-full py-4 px-6 rounded-2xl font-semibold text-lg transition-all relative overflow-hidden
          ${!isConnected
            ? 'bg-gradient-to-r from-[#00FF4D] to-cyan-500 text-white shadow-lg hover:shadow-xl cursor-pointer'
            : disabled || loading
            ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-[#00FF4D] to-cyan-500 text-white shadow-lg hover:shadow-xl'
          }
        `}
        style={{
          boxShadow: (!isConnected || (!disabled && !loading)) 
            ? '0 4px 20px rgba(0, 255, 77, 0.4), 0 0 40px rgba(6, 182, 212, 0.2)' 
            : undefined
        }}
      >
        {/* Animated gradient overlay for hover effect */}
        {(!disabled && !loading) && (
          <div className="absolute inset-0 bg-gradient-to-r from-[#00FF4D]/0 via-white/20 to-cyan-500/0 opacity-0 hover:opacity-100 transition-opacity duration-300 transform translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-700"></div>
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
            {buttonText}
            {/* Add icon for swap/wrap/unwrap */}
            {isConnected && !disabled && (
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {buttonText === 'Swap' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                ) : buttonText === 'Wrap' || buttonText === 'Unwrap' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                ) : null}
              </svg>
            )}
          </span>
        )}
        
        {/* Pulse effect for active button */}
        {(!disabled && !loading && isConnected) && (
          <div className="absolute inset-0 rounded-2xl">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#00FF4D] to-cyan-500 opacity-50 blur-md animate-pulse"></div>
          </div>
        )}
      </button>
    </motion.div>
  );
};
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
  hasDealixId?: boolean;
  hasDiscount?: boolean;
}

export const SwapButton: React.FC<SwapButtonProps> = ({
  isConnected,
  hasAmount,
  exceedsBalance,
  loading,
  onSwap,
  fromToken,
  toToken,
  hasDealixId = false,
  hasDiscount = false
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
      } else if (hasDealixId && hasDiscount) {
        buttonText = 'Swap with Dealix Benefits';
      } else {
        buttonText = 'Swap';
      }
      disabled = false;
    }
  }

  // Dynamic button styling based on Dealix status
  const getButtonStyles = () => {
    if (!isConnected) {
      return 'bg-gradient-to-r from-[#00FF4D] to-cyan-500 text-white shadow-lg hover:shadow-xl cursor-pointer';
    }
    
    if (disabled || loading) {
      return 'bg-gray-800/50 text-gray-500 cursor-not-allowed';
    }
    
    if (hasDealixId && hasDiscount) {
      // Special Dealix gradient
      return 'bg-gradient-to-r from-green-500 to-blue-500 text-white shadow-lg hover:shadow-xl';
    }
    
    return 'bg-gradient-to-r from-[#00FF4D] to-cyan-500 text-white shadow-lg hover:shadow-xl';
  };

  const getBoxShadow = () => {
    if (!isConnected || (!disabled && !loading)) {
      if (hasDealixId && hasDiscount) {
        return '0 4px 20px rgba(34, 197, 94, 0.4), 0 0 40px rgba(59, 130, 246, 0.2)';
      }
      return '0 4px 20px rgba(0, 255, 77, 0.4), 0 0 40px rgba(6, 182, 212, 0.2)';
    }
    return undefined;
  };

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
          ${getButtonStyles()}
        `}
        style={{ boxShadow: getBoxShadow() }}
      >
        {/* Animated gradient overlay for hover effect */}
        {(!disabled && !loading) && (
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 hover:opacity-100 transition-opacity duration-300 transform translate-x-[-100%] hover:translate-x-[100%] transition-transform duration-700"></div>
        )}

        {loading ? (
          <>
            <svg className="inline-block animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          <span className="relative z-10">{buttonText}</span>
        )}
      </button>
    </motion.div>
  );
};
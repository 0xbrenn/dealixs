import React from 'react';

interface LoadingButtonProps {
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading = false,
  disabled = false,
  onClick,
  children,
  className = '',
  variant = 'primary'
}) => {
  const baseClasses = "px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center space-x-2";
  
  const variantClasses = {
    primary: "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg shadow-emerald-500/25",
    secondary: "bg-gray-700/50 text-white hover:bg-gray-600/50",
    danger: "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50"
  };

  const disabledClasses = "opacity-50 cursor-not-allowed";

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${(disabled || loading) ? disabledClasses : ''} ${className}`}
    >
      {loading && (
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      <span>{children}</span>
    </button>
  );
};
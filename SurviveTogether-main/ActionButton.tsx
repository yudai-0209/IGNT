
import React from 'react';

interface ActionButtonProps {
  text: string;
  variant: 'primary' | 'secondary' | 'neutral' | 'selection';
  onClick?: () => void;
  disabled?: boolean;
}

const ActionButton = ({ text, variant, onClick, disabled = false }: ActionButtonProps) => {
  const baseClasses =
    'font-bold rounded-2xl shadow-lg transform transition-transform duration-200 ease-in-out whitespace-nowrap';
  
  const hoverClasses = disabled ? '' : 'hover:scale-105';

  const variantClasses = {
    primary: disabled 
      ? 'bg-gray-400 text-gray-600 text-lg md:text-2xl py-4 px-10 md:px-12 cursor-not-allowed'
      : 'bg-orange-500 hover:bg-orange-600 text-black text-lg md:text-2xl py-4 px-10 md:px-12',
    secondary: disabled
      ? 'bg-gray-500 text-gray-300 text-base md:text-xl py-3 px-6 md:px-8 cursor-not-allowed'
      : 'bg-purple-700 hover:bg-purple-800 text-white text-base md:text-xl py-3 px-6 md:px-8',
    neutral: disabled
      ? 'bg-gray-300 text-gray-500 text-lg md:text-2xl py-3 px-8 md:px-10 cursor-not-allowed'
      : 'bg-stone-200 hover:bg-stone-300 text-stone-800 text-lg md:text-2xl py-3 px-8 md:px-10',
    selection: disabled
      ? 'bg-gray-200 text-gray-400 text-2xl md:text-4xl py-8 px-16 md:py-10 md:px-24 w-full h-full flex justify-center items-center cursor-not-allowed'
      : 'bg-stone-200 hover:bg-stone-300 text-[#0f3d1f] text-2xl md:text-4xl py-8 px-16 md:py-10 md:px-24 w-full h-full flex justify-center items-center',
  };

  return (
    <button 
      onClick={disabled ? undefined : onClick} 
      disabled={disabled}
      className={`${baseClasses} ${hoverClasses} ${variantClasses[variant]}`}
    >
      {text}
    </button>
  );
};

export default ActionButton;

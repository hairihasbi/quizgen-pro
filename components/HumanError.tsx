
import React from 'react';

interface HumanErrorProps {
  message: string;
  onRetry?: () => void;
  onClose?: () => void;
}

const HumanError: React.FC<HumanErrorProps> = ({ message, onRetry, onClose }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center animate-in zoom-in-95 duration-300">
      <div className="w-24 h-24 bg-rose-50 rounded-[2.5rem] flex items-center justify-center text-5xl mb-8 shadow-inner animate-bounce">
        🤕
      </div>
      <h3 className="text-2xl font-black text-gray-900 tracking-tighter uppercase mb-4">Aduuh, Ada Kendala!</h3>
      <p className="text-gray-500 font-medium max-w-sm leading-relaxed mb-10">
        {message}
      </p>
      <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
        {onRetry && (
          <button 
            onClick={onRetry}
            className="px-10 py-4 orange-gradient text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all uppercase text-[10px] tracking-widest"
          >
            Coba Sekali Lagi 🔄
          </button>
        )}
        {onClose && (
          <button 
            onClick={onClose}
            className="px-10 py-4 bg-gray-100 text-gray-500 font-black rounded-2xl hover:bg-gray-200 transition-all uppercase text-[10px] tracking-widest"
          >
            Tutup Panel
          </button>
        )}
      </div>
    </div>
  );
};

export default HumanError;

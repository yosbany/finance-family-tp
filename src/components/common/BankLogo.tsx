import React from 'react';

interface BankLogoProps {
  bank: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const BankLogo: React.FC<BankLogoProps> = ({ bank, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  const bankLogos: Record<string, JSX.Element> = {
    'BROU': (
      <div className={`${sizeClasses[size]} ${className} bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-md`}>
        <span className="text-white font-bold text-xs">BROU</span>
      </div>
    ),
    'Itaú': (
      <div className={`${sizeClasses[size]} ${className} bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md`}>
        <span className="text-white font-bold text-xs">itaú</span>
      </div>
    ),
    'Santander': (
      <div className={`${sizeClasses[size]} ${className} bg-gradient-to-br from-red-600 to-red-700 rounded-lg flex items-center justify-center shadow-md`}>
        <svg viewBox="0 0 24 24" fill="white" className="w-3/4 h-3/4">
          <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
        </svg>
      </div>
    ),
    'OCA': (
      <div className={`${sizeClasses[size]} ${className} bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center shadow-md`}>
        <span className="text-white font-bold text-xs">OCA</span>
      </div>
    ),
    'Prex': (
      <div className={`${sizeClasses[size]} ${className} bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md`}>
        <span className="text-white font-bold text-xs">prex</span>
      </div>
    ),
    'BHU': (
      <div className={`${sizeClasses[size]} ${className} bg-gradient-to-br from-teal-600 to-teal-800 rounded-lg flex items-center justify-center shadow-md`}>
        <span className="text-white font-bold text-xs">BHU</span>
      </div>
    ),
    'IBM': (
      <div className={`${sizeClasses[size]} ${className} bg-gradient-to-br from-blue-700 to-blue-900 rounded-lg flex items-center justify-center shadow-md`}>
        <span className="text-white font-bold text-xs">IBM</span>
      </div>
    ),
    'Visa': (
      <div className={`${sizeClasses[size]} ${className} bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-md`}>
        <svg viewBox="0 0 48 16" fill="white" className="w-3/4 h-3/4">
          <path d="M18.5 0l-3.2 15.2h-3.6L15 0h3.5zm13.5 9.9c0-3.8-5.3-4-5.3-5.7 0-.5.5-1 1.6-1.2.5-.1 2-.2 3.6.6l.6-3c-.9-.3-2-.6-3.4-.6-3.6 0-6.2 1.9-6.2 4.7 0 2 1.8 3.2 3.2 3.8 1.4.7 1.9 1.1 1.9 1.7 0 .9-1.1 1.3-2.1 1.3-1.8 0-2.7-.3-4.2-.9l-.7 3.1c1 .4 2.7.8 4.5.8 3.9 0 6.5-1.9 6.5-4.8zm9.7 5.3h3.2L42.5 0h-3c-.7 0-1.2.4-1.5 1l-5.2 14.2h3.9l.8-2.1h4.8l.4 2.1zm-4.2-5l2-5.4.9 5.4h-2.9zM23.6 0L20.3 15.2h-3.7L20 0h3.6z"/>
        </svg>
      </div>
    ),
    'Mastercard': (
      <div className={`${sizeClasses[size]} ${className} bg-white rounded-lg flex items-center justify-center shadow-md p-1`}>
        <svg viewBox="0 0 48 32" className="w-full h-full">
          <circle cx="16" cy="16" r="12" fill="#EB001B"/>
          <circle cx="32" cy="16" r="12" fill="#F79E1B"/>
          <path d="M24 8c-2.2 1.7-3.6 4.3-3.6 7.2s1.4 5.5 3.6 7.2c2.2-1.7 3.6-4.3 3.6-7.2S26.2 9.7 24 8z" fill="#FF5F00"/>
        </svg>
      </div>
    )
  };

  // Buscar logo por nombre exacto o parcial
  const logoKey = Object.keys(bankLogos).find(key => 
    bank.toLowerCase().includes(key.toLowerCase()) || 
    key.toLowerCase().includes(bank.toLowerCase())
  );

  if (logoKey) {
    return bankLogos[logoKey];
  }

  // Logo por defecto para bancos no reconocidos
  return (
    <div className={`${sizeClasses[size]} ${className} bg-gradient-to-br from-gray-500 to-gray-600 rounded-lg flex items-center justify-center shadow-md`}>
      <svg viewBox="0 0 24 24" fill="white" className="w-3/4 h-3/4">
        <path d="M12 2L2 7v3h20V7l-10-5zM2 22h20v-2H2v2zm0-4h20v-2H2v2zm0-4h20v-2H2v2z"/>
      </svg>
    </div>
  );
};

export default BankLogo;

// Made with Bob

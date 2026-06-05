import React from 'react';

interface BankLogoProps {
  bank: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const BankLogo: React.FC<BankLogoProps> = ({ bank, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16'
  };

  // Mapeo de bancos a archivos de logo
  const bankLogoFiles: Record<string, string> = {
    'BROU': '/bank-logos/brou.png',
    'Itaú': '/bank-logos/itau.png',
    'Santander': '/bank-logos/santander.png',
    'OCA': '/bank-logos/oca.png',
    'Prex': '/bank-logos/prex.png',
    'BHU': '/bank-logos/bhu.jpeg',
    'IBM': '/bank-logos/ibm.png'
  };

  // Buscar logo por nombre exacto o parcial
  const logoKey = Object.keys(bankLogoFiles).find(key =>
    bank.toLowerCase().includes(key.toLowerCase()) ||
    key.toLowerCase().includes(bank.toLowerCase())
  );

  if (logoKey) {
    return (
      <img
        src={bankLogoFiles[logoKey]}
        alt={`${logoKey} logo`}
        className={`${sizeClasses[size]} ${className} object-contain rounded-lg`}
        onError={(e) => {
          // Fallback si la imagen no carga
          e.currentTarget.style.display = 'none';
        }}
      />
    );
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

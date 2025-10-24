import React from 'react';

interface LogoEconovaProps {
  className?: string;
  height?: number;
}

export function LogoEconova({ className = "", height = 100 }: LogoEconovaProps) {
  return (
    <img 
      src="/Logo-ECONOVA-OF_Blanco.png" 
      alt="Econova Logo" 
      className={className}
      style={{ 
        height: `${height}px`,
        display: 'block',
        objectFit: 'cover',
        maxWidth: '100%',
        width: '100%'
      }} 
    />
  );
}
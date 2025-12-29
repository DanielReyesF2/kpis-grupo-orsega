import { devLog } from "@/lib/logger";
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
        objectFit: 'contain',
        maxWidth: '100%',
        width: 'auto'
      }} 
      onError={(e) => {
        devLog.error('Error loading logo:', e);
        // Fallback: mostrar texto si la imagen no carga
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
        const parent = target.parentElement;
        if (parent) {
          parent.innerHTML = `<div class="text-white text-2xl font-bold">ECONOVA</div>`;
        }
      }}
    />
  );
}
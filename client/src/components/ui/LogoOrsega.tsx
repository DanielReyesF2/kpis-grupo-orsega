interface LogoOrsegaProps {
  className?: string;
  height?: number;
  showText?: boolean;
}

export function LogoOrsega({ className = "", height = 100, showText = false }: LogoOrsegaProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <div className="bg-white rounded-lg p-2 shadow-md">
        <img 
          src="/logo orsega.jpg" 
          alt="Grupo Orsega Logo" 
          className="object-contain"
          style={{ 
            height: `${height}px`,
            display: 'block',
            maxWidth: '100%',
            width: 'auto'
          }} 
          onError={(e) => {
            console.error('Error loading Grupo Orsega logo:', e);
            // Fallback: mostrar texto si la imagen no carga
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `<div class="text-gray-800 text-2xl font-bold">GRUPO ORSEGA</div>`;
            }
          }}
        />
      </div>
      {showText && (
        <span className="ml-3 text-white text-2xl font-bold">GRUPO ORSEGA</span>
      )}
    </div>
  );
}

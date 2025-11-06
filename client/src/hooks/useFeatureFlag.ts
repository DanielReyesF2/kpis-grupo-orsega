/**
 * Hook para feature flags
 * Permite activar/desactivar funcionalidades gradualmente
 */

// Configuración de feature flags (puede venir de variable de entorno o API)
const FEATURES: Record<string, boolean> = {
  'new-exchange-rate-history': import.meta.env.VITE_FEATURE_NEW_EXCHANGE_RATE_HISTORY === 'true' || false,
  'enhanced-exchange-rate-filters': import.meta.env.VITE_FEATURE_ENHANCED_EXCHANGE_RATE_FILTERS === 'true' || false,
};

export function useFeatureFlag(feature: string): boolean {
  // En desarrollo, permitir override desde localStorage para testing
  if (import.meta.env.DEV) {
    try {
      const stored = localStorage.getItem(`feature:${feature}`);
      if (stored !== null) {
        return stored === 'true';
      }
    } catch (error) {
      // Si no hay acceso a localStorage, continuar
    }
  }

  // En producción, usar configuración de feature flags
  return FEATURES[feature] ?? false;
}


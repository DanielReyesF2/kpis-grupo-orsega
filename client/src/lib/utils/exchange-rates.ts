// Funciones centralizadas para manejar tipos de cambio
// DOF solo tiene un valor único, mientras que otras fuentes (MONEX, Santander) tienen compra/venta separadas

import { devLog } from '../logger';

export const SINGLE_VALUE_SOURCES = ['DOF'] as const;
export type SingleValueSource = typeof SINGLE_VALUE_SOURCES[number];

/**
 * Determina si una fuente de tipo de cambio tiene un solo valor (como DOF)
 * o dos valores separados (compra/venta como MONEX y Santander)
 */
export function isSingleValueSource(source: string | null | undefined): boolean {
  if (!source) return false;
  const upperSource = source.toUpperCase().trim();
  const result = SINGLE_VALUE_SOURCES.includes(upperSource as SingleValueSource);
  // Debug log para verificar
  if (upperSource === 'DOF') {
    devLog.log('[isSingleValueSource] DOF detected:', { source, upperSource, result, SINGLE_VALUE_SOURCES });
  }
  return result;
}

export interface NormalizedExchangeRate {
  source: string;
  buyRate: number;
  sellRate: number;
  date: string;
  isSingleValue: boolean;
  displayValue: number; // El valor único para fuentes de un solo valor, o buyRate para otras
  displayLabel: string; // "Tipo de Cambio" para DOF, "Compra"/"Venta" para otras
  spread?: number; // Solo para fuentes con dos valores
}

/**
 * Normaliza un tipo de cambio para presentación consistente
 * Para fuentes de un solo valor (DOF), usa buyRate como el valor único
 */
export function normalizeExchangeRate(rate: {
  source: string | null;
  buy_rate: number;
  sell_rate: number;
  date: string;
}): NormalizedExchangeRate {
  const isSingle = isSingleValueSource(rate.source);
  
  return {
    source: rate.source || '',
    buyRate: rate.buy_rate,
    sellRate: rate.sell_rate,
    date: rate.date,
    isSingleValue: isSingle,
    displayValue: rate.buy_rate, // Para DOF y otras fuentes, usar buyRate como valor principal
    displayLabel: isSingle ? 'Tipo de Cambio' : 'Compra',
    spread: isSingle ? undefined : rate.sell_rate - rate.buy_rate,
  };
}

export interface RateDisplayConfig {
  isSingle: boolean;
  showSpread: boolean;
  buyLabel: string;
  sellLabel: string | undefined;
}

/**
 * Obtiene la configuración de visualización para una fuente de tipo de cambio
 */
export function getRateDisplayConfig(source: string | null | undefined): RateDisplayConfig {
  const isSingle = isSingleValueSource(source);
  return {
    isSingle,
    showSpread: !isSingle,
    buyLabel: isSingle ? 'Tipo de Cambio' : 'Compra',
    sellLabel: isSingle ? undefined : 'Venta',
  };
}




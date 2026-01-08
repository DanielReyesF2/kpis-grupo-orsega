/**
 * Utilidades compartidas para módulos de ventas
 * Funciones de formateo y helpers reutilizables
 */

/**
 * Formatea un valor numérico como moneda según la empresa
 * @param value - Valor a formatear
 * @param companyId - ID de la empresa (1 = Dura/USD, 2 = Orsega/MXN)
 * @returns String formateado como moneda
 */
export function formatCurrency(value: number, companyId: number): string {
  const currency = companyId === 1 ? 'USD' : 'MXN';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formatea un valor numérico con separadores de miles
 * @param value - Valor a formatear
 * @returns String formateado con separadores
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-MX').format(value);
}


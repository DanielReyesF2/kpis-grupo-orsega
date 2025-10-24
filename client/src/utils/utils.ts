/**
 * Formatea una fecha a un string legible
 * @param date Fecha a formatear
 * @returns String con formato DD/MM/YYYY
 */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return 'N/A';
  
  // Verificar si la fecha es válida
  if (isNaN(date.getTime())) return 'N/A';
  
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Formatea un número para mostrarlo como moneda
 * @param value Valor a formatear
 * @param currency Moneda (default: MXN)
 * @returns String formateado como moneda
 */
export function formatCurrency(value: number, currency: string = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency
  }).format(value);
}

/**
 * Formatea un porcentaje
 * @param value Valor a formatear
 * @param decimals Número de decimales (default: 2)
 * @returns String formateado como porcentaje
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formatea un valor de acuerdo al tipo de KPI
 * @param value Valor a formatear
 * @param type Tipo de KPI (money, percent, number, etc)
 * @param decimals Número de decimales para números y porcentajes
 * @returns Valor formateado según el tipo
 */
export function formatKpiValue(value: number, type: string, decimals: number = 2): string {
  switch(type.toLowerCase()) {
    case 'money':
    case 'currency':
      return formatCurrency(value);
    case 'percent':
    case 'percentage':
      return formatPercent(value, decimals);
    case 'number':
    default:
      return value.toFixed(decimals);
  }
}

/**
 * Calcula el porcentaje de un valor respecto a una meta
 * @param value Valor actual
 * @param target Meta a alcanzar
 * @returns Porcentaje de avance
 */
export function calculatePercentage(value: number, target: number): number {
  if (target === 0) return 0;
  return (value / target) * 100;
}
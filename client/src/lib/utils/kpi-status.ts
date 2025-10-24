export type KpiStatus = 'complies' | 'alert' | 'not_compliant';

/**
 * Determina el estado del KPI basado en el valor actual y objetivo
 * 
 * @param currentValue Valor actual del KPI
 * @param target Valor objetivo del KPI
 * @param isLowerBetter Indica si un valor menor es mejor (por defecto es falso)
 * @returns Estado del KPI
 */
export function calculateKpiStatus(
  currentValue: string | number,
  target: string | number,
  isLowerBetter = false
): KpiStatus {
  // Convertir valores a números si es posible
  const numericCurrentValue = typeof currentValue === 'string' 
    ? parseFloat(currentValue.replace(/[^0-9.-]+/g, '')) 
    : currentValue;
  
  const numericTarget = typeof target === 'string'
    ? parseFloat(target.replace(/[^0-9.-]+/g, ''))
    : target;
  
  // Si no se pueden convertir, usar valores por defecto
  if (isNaN(numericCurrentValue) || isNaN(numericTarget)) {
    return 'alert';
  }
  
  // Calcular el porcentaje de cumplimiento
  const threshold = 0.9; // 90% del objetivo para estar en alerta
  
  if (isLowerBetter) {
    if (numericCurrentValue <= numericTarget) {
      return 'complies';
    } else if (numericCurrentValue <= numericTarget * (1 + (1 - threshold))) {
      return 'alert';
    } else {
      return 'not_compliant';
    }
  } else {
    if (numericCurrentValue >= numericTarget) {
      return 'complies';
    } else if (numericCurrentValue >= numericTarget * threshold) {
      return 'alert';
    } else {
      return 'not_compliant';
    }
  }
}

/**
 * Calcula el porcentaje de cumplimiento de un KPI
 * @param currentValue Valor actual
 * @param target Valor objetivo
 * @param isLowerBetter Indica si un valor menor es mejor
 * @returns Porcentaje de cumplimiento formateado (Ej: "95.5%")
 */
export function calculateCompliance(
  currentValue: string | number, 
  target: string | number, 
  isLowerBetter = false
): string {
  // Convertir valores a números si es posible
  const numericCurrentValue = typeof currentValue === 'string' 
    ? parseFloat(currentValue.replace(/[^0-9.-]+/g, '')) 
    : currentValue;
  
  const numericTarget = typeof target === 'string'
    ? parseFloat(target.replace(/[^0-9.-]+/g, ''))
    : target;
  
  // Si no se pueden convertir, retornar valor por defecto
  if (isNaN(numericCurrentValue) || isNaN(numericTarget)) {
    return "0.0%";
  }
  
  let percentage: number;
  
  if (isLowerBetter) {
    // Para métricas donde un valor menor es mejor (como días de cobro)
    // Si el valor actual es 0, evitar división por cero
    if (numericCurrentValue === 0) {
      percentage = numericTarget > 0 ? 200 : 0; // Valor excepcional por ser 0
    } else {
      // Fórmula inversa: cuanto menor el valor, mayor el cumplimiento
      // No limitamos al 100% para mostrar cuando es mejor que el objetivo
      percentage = (numericTarget / numericCurrentValue) * 100;
    }
  } else {
    // Para métricas normales donde un valor mayor es mejor
    // Si el objetivo es 0, evitar división por cero
    if (numericTarget === 0) {
      percentage = numericCurrentValue > 0 ? 100 : 0;
    } else {
      percentage = (numericCurrentValue / numericTarget) * 100;
    }
  }
  
  return `${percentage.toFixed(1)}%`;
}

/**
 * Devuelve un texto descriptivo para el estado del KPI
 */
export function getStatusText(status: KpiStatus): string {
  switch (status) {
    case 'complies':
      return 'Cumple';
    case 'alert':
      return 'Alerta';
    case 'not_compliant':
      return 'No Cumple';
    default:
      return 'Desconocido';
  }
}

/**
 * Devuelve un color basado en el estado del KPI
 */
export function getStatusColor(status: KpiStatus): string {
  switch (status) {
    case 'complies':
      return '#10b981'; // green-500
    case 'alert':
      return '#f59e0b'; // yellow-500
    case 'not_compliant':
      return '#ef4444'; // red-500
    default:
      return '#9ca3af'; // gray-400
  }
}
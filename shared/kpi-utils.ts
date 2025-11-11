/**
 * Utilidades centralizadas para cálculos de KPIs
 * Estas funciones aseguran consistencia entre backend y frontend
 */

export type KpiStatus = 'complies' | 'alert' | 'not_compliant';

/**
 * Parsea un valor numérico de un string, removiendo caracteres no numéricos
 */
export function parseNumericValue(raw?: string | number | null): number {
  if (raw === null || raw === undefined) return NaN;
  if (typeof raw === 'number') return raw;
  const cleaned = raw.replace(/[^\d.-]/g, "");
  return parseFloat(cleaned);
}

/**
 * Determina si un KPI es de "menor es mejor"
 * Lista de KPIs donde un valor menor es mejor
 */
const LOWER_BETTER_KPIS = [
  'días de cobro',
  'días de pago',
  'tiempo de entrega',
  'tiempo promedio',
  'tiempo de respuesta',
  'tiempo de ciclo',
  'días de inventario',
  'rotación de inventario',
  'defectos',
  'errores',
  'quejas',
  'devoluciones',
  'huella de carbono',
  'costos',
  'gastos'
];

export function isLowerBetterKPI(kpiName: string): boolean {
  const kpiNameLower = kpiName.toLowerCase();
  return LOWER_BETTER_KPIS.some(pattern => kpiNameLower.includes(pattern));
}

/**
 * Calcula el estado del KPI basado en el valor actual y objetivo
 * Esta es la función centralizada que debe usarse en todo el sistema
 * 
 * @param currentValue Valor actual del KPI
 * @param target Valor objetivo del KPI
 * @param kpiName Nombre del KPI (para determinar si es "lower is better")
 * @returns Estado del KPI
 */
export function calculateKpiStatus(
  currentValue: string | number | null,
  target: string | number | null,
  kpiName: string
): KpiStatus {
  // Convertir valores a números
  const numericCurrentValue = parseNumericValue(currentValue);
  const numericTarget = parseNumericValue(target);
  
  // Si no se pueden convertir, usar valores por defecto
  if (isNaN(numericCurrentValue) || isNaN(numericTarget)) {
    // Si hay un valor actual pero no se puede parsear, es una alerta
    if (currentValue !== null && currentValue !== undefined && currentValue !== '') {
      return 'alert';
    }
    return 'not_compliant';
  }
  
  // Si el target es 0, no podemos calcular
  if (numericTarget === 0) {
    return numericCurrentValue === 0 ? 'complies' : 'alert';
  }
  
  const lowerBetter = isLowerBetterKPI(kpiName);
  const threshold = 0.9; // 90% del objetivo para estar en alerta
  
  if (lowerBetter) {
    // Para métricas donde un valor menor es mejor
    if (numericCurrentValue <= numericTarget) {
      return 'complies';
    } else if (numericCurrentValue <= numericTarget * (1 + (1 - threshold))) {
      // numericTarget * (1 + (1 - 0.9)) = numericTarget * 1.1
      return 'alert';
    } else {
      return 'not_compliant';
    }
  } else {
    // Para métricas normales donde un valor mayor es mejor
    if (numericCurrentValue >= numericTarget) {
      return 'complies';
    } else if (numericCurrentValue >= numericTarget * threshold) {
      // numericTarget * 0.9
      return 'alert';
    } else {
      return 'not_compliant';
    }
  }
}

/**
 * Calcula el porcentaje de cumplimiento de un KPI
 * Esta es la función centralizada que debe usarse en todo el sistema
 * 
 * @param currentValue Valor actual
 * @param target Valor objetivo
 * @param kpiName Nombre del KPI (para determinar si es "lower is better")
 * @returns Porcentaje de cumplimiento formateado (Ej: "95.5%")
 */
export function calculateCompliance(
  currentValue: string | number | null,
  target: string | number | null,
  kpiName: string
): string {
  // Convertir valores a números
  const numericCurrentValue = parseNumericValue(currentValue);
  const numericTarget = parseNumericValue(target);
  
  // Si no se pueden convertir, retornar valor por defecto
  if (isNaN(numericCurrentValue) || isNaN(numericTarget)) {
    return "0.0%";
  }
  
  const lowerBetter = isLowerBetterKPI(kpiName);
  let percentage: number;
  
  if (lowerBetter) {
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
      // No limitamos al 100% para mostrar cuando se supera el objetivo
      percentage = (numericCurrentValue / numericTarget) * 100;
    }
  }
  
  return `${percentage.toFixed(1)}%`;
}

/**
 * Normaliza el status para comparación
 * Convierte diferentes formatos de status a un formato estándar
 */
export function normalizeStatus(status: string | null | undefined): KpiStatus {
  if (!status) return 'not_compliant';
  
  const statusMap: Record<string, KpiStatus> = {
    'compliant': 'complies',
    'non-compliant': 'not_compliant',
    'alert': 'alert',
    'complies': 'complies',
    'not_compliant': 'not_compliant'
  };
  
  return statusMap[status.toLowerCase()] || 'not_compliant';
}



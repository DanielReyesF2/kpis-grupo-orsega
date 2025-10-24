/**
 * Formatea una fecha a un formato legible en español
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

/**
 * Formatea una fecha con hora a un formato legible en español
 */
export function formatDateAndTime(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

/**
 * Convierte una frecuencia en inglés a su equivalente en español
 */
export function translateFrequency(frequency: string): string {
  const translations: Record<string, string> = {
    'daily': 'Diaria',
    'weekly': 'Semanal',
    'biweekly': 'Quincenal',
    'monthly': 'Mensual',
    'bimonthly': 'Bimestral',
    'quarterly': 'Trimestral',
    'semiannually': 'Semestral',
    'yearly': 'Anual'
  };
  
  return translations[frequency] || frequency;
}

/**
 * Traduce el estado de un KPI a español
 */
export function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    'complies': 'Cumple',
    'alert': 'Alerta',
    'not_compliant': 'No Cumple'
  };
  
  return translations[status] || status;
}

/**
 * Retorna opciones para el selector de períodos
 */
export function getPeriodOptions() {
  return [
    { label: 'Todos los períodos', value: 'all' },
    { label: 'Q1 2023', value: 'Q1 2023' },
    { label: 'Q2 2023', value: 'Q2 2023' },
    { label: 'Q3 2023', value: 'Q3 2023' },
    { label: 'Q4 2023', value: 'Q4 2023' },
    { label: 'Q1 2024', value: 'Q1 2024' }
  ];
}

/**
 * Retorna opciones para el selector de estados
 */
export function getStatusOptions() {
  return [
    { label: 'Todos los estados', value: 'all' },
    { label: 'Cumple', value: 'complies' },
    { label: 'Alerta', value: 'alert' },
    { label: 'No cumple', value: 'not_compliant' }
  ];
}
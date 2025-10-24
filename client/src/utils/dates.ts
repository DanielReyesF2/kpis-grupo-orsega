/**
 * Formatea una fecha como string en formato DD/MM/YYYY HH:MM
 */
export function formatDateAndTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Formatear fecha como DD/MM/YYYY
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  
  // Formatear hora como HH:MM
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Formatea una fecha como string para mostrar solo la fecha DD/MM/YYYY
 */
export function formatDateOnly(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Formatear fecha como DD/MM/YYYY
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0'); 
  const year = dateObj.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Devuelve un string que representa hace cuánto tiempo ocurrió una fecha
 * Ejemplos: "hace 5 minutos", "hace 2 horas", "hace 3 días"
 */
export function timeAgo(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  // Diferencia en milisegundos
  const diffMs = now.getTime() - dateObj.getTime();
  
  // Convertir a diferentes unidades
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return `hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
  } else if (diffHours > 0) {
    return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  } else if (diffMinutes > 0) {
    return `hace ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
  } else {
    return 'justo ahora';
  }
}

/**
 * Devuelve el nombre del mes a partir de su número (0-11)
 */
export function getMonthName(monthNumber: number): string {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  return months[monthNumber];
}

/**
 * Convierte un período (trimestre, semestre, etc.) a una etiqueta legible
 */
export function formatPeriod(period: string): string {
  // Mapeo de valores de período a etiquetas legibles
  const periodMap: Record<string, string> = {
    'daily': 'Diario',
    'weekly': 'Semanal',
    'monthly': 'Mensual',
    'quarterly': 'Trimestral',
    'biannual': 'Semestral',
    'annual': 'Anual',
    'all': 'Histórico',
    'Q1': '1er Trimestre',
    'Q2': '2do Trimestre',
    'Q3': '3er Trimestre',
    'Q4': '4to Trimestre',
    'H1': '1er Semestre',
    'H2': '2do Semestre',
    'YTD': 'Año a la fecha',
  };
  
  return periodMap[period] || period;
}
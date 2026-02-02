/**
 * Formateo único para valores de KPIs en tarjetas y vistas.
 * Una sola función: todas las tarjetas KPI la usan.
 */

/**
 * Parsea el valor numérico de un string que puede incluir unidad (ej. "81.48 %", "10037222 MXN").
 */
function parseKpiValue(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  const cleaned = String(value).replace(/[$%,\s]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Formatea valor y unidad para mostrar en tarjetas KPI (números con comas, es-MX).
 * Uso: Valor Actual, Meta, y cualquier número en tarjetas KPI.
 */
export function formatKpiValue(
  value: number | string | null | undefined,
  unit?: string | null
): string {
  const num = parseKpiValue(value);
  if (num === null) return 'Sin datos';
  const formatted = num.toLocaleString('es-MX', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  if (unit && unit.trim()) {
    const u = unit.trim();
    return u.startsWith('%') ? `${formatted}${u}` : `${formatted} ${u}`;
  }
  return formatted;
}

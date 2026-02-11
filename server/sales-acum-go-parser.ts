/**
 * Parser para hoja "ACUMULADO 2026" (GO - VENTAS 2026.xlsx)
 * Columnas: # MES, Factura, Fecha, Cliente, Producto, FAMILIA DEL PRODUCTO,
 * UNIDAD, Cantidad, USD, MN, TIPO DE CAMBIO, IMPORTE M.N., COMPRA, FLETE, UTILIDAD BRUTA
 */

import type { Workbook } from 'exceljs';

export interface AcumGO2026Transaction {
  mes: number;
  año: number;
  fecha: Date;
  folio: string;
  cliente: string;
  producto: string;
  familiaProducto: string | null;
  unidad: string;
  cantidad: number;
  usd: number | null;
  importeMN: number | null;
  tipoCambio: number | null;
}

export interface AcumGO2026ParseResult {
  transacciones: AcumGO2026Transaction[];
  resumen: {
    totalFilas: number;
    excluidasCanceladas: number;
    excluidasNacionales: number;
    rangoFechas: { desde: Date | null; hasta: Date | null };
  };
  errores: Array<{ fila: number; error: string }>;
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return isNaN(value) ? null : value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

function parseDate(value: any, añoBase: number): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    // Excel serial date - usar UTC para evitar problemas de timezone
    const d = new Date(Date.UTC(1899, 11, 30) + (value - 1) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const parts = value.split(/[/\-.]/).map((p: string) => parseInt(p.trim(), 10));
    if (parts.length >= 3) {
      // Formato MM/DD/YY (formato US)
      const month = (parts[0] ?? 1) - 1;  // Mes es el primer valor
      const day = parts[1];                // Día es el segundo valor
      const year = parts[2]! < 100 ? 2000 + parts[2]! : parts[2]!;
      // Usar UTC para evitar problemas de timezone
      const d = new Date(Date.UTC(year, month, day));
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function getColumnIndex(headerValues: string[], ...names: string[]): number {
  for (const name of names) {
    const idx = headerValues.findIndex((h) =>
      (h || '').toLowerCase().includes(name.toLowerCase())
    );
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parsea la hoja "ACUMULADO 2026" del workbook
 */
export async function parseAcumGO2026(workbook: Workbook): Promise<AcumGO2026ParseResult> {
  const transacciones: AcumGO2026Transaction[] = [];
  const errores: Array<{ fila: number; error: string }> = [];
  let excluidasCanceladas = 0;
  let excluidasNacionales = 0;

  const sheet = workbook.worksheets.find((ws: any) => {
    const name = (ws.name || '').toUpperCase();
    return name.includes('ACUMULADO') && name.includes('2026');
  });

  if (!sheet) {
    return {
      transacciones: [],
      resumen: {
        totalFilas: 0,
        excluidasCanceladas: 0,
        excluidasNacionales: 0,
        rangoFechas: { desde: null, hasta: null },
      },
      errores: [{ fila: 0, error: 'No se encontró hoja ACUMULADO 2026' }],
    };
  }

  const headerRow = sheet.getRow(1);
  const headerValues: string[] = [];
  headerRow.eachCell((cell: any, colNumber: number) => {
    headerValues[colNumber - 1] = cell.value ? String(cell.value).trim() : '';
  });

  const colMes = getColumnIndex(headerValues, '# mes', 'mes');
  const colFactura = getColumnIndex(headerValues, 'factura');
  const colFecha = getColumnIndex(headerValues, 'fecha');
  const colCliente = getColumnIndex(headerValues, 'cliente');
  const colProducto = getColumnIndex(headerValues, 'producto');
  const colFamilia = getColumnIndex(headerValues, 'familia', 'familia del producto');
  const colUnidad = getColumnIndex(headerValues, 'unidad');
  const colCantidad = getColumnIndex(headerValues, 'cantidad');
  const colUSD = getColumnIndex(headerValues, 'usd');
  const colImporteMN = getColumnIndex(headerValues, 'importe m.n.', 'importe m.n', 'importe mn');
  const colTipoCambio = getColumnIndex(headerValues, 'tipo de cambio', 'tipo cambio');

  if (colCliente < 0 || colProducto < 0 || colCantidad < 0) {
    return {
      transacciones: [],
      resumen: {
        totalFilas: 0,
        excluidasCanceladas: 0,
        excluidasNacionales: 0,
        rangoFechas: { desde: null, hasta: null },
      },
      errores: [{ fila: 1, error: 'Faltan columnas requeridas: Cliente, Producto, Cantidad' }],
    };
  }

  const añoBase = 2026;
  let rangoDesde: Date | null = null;
  let rangoHasta: Date | null = null;

  for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum);
    const getVal = (col: number) => (col >= 0 ? row.getCell(col + 1).value : null);
    const getStr = (col: number) => {
      const v = getVal(col);
      return v != null ? String(v).trim() : '';
    };

    const cliente = getStr(colCliente);
    if (!cliente) continue;

    if (/C\s*A\s*N\s*C\s*E\s*L\s*A\s*D\s*A/i.test(cliente)) {
      excluidasCanceladas++;
      continue;
    }
    if (/^NACIONALES$/i.test(cliente)) {
      excluidasNacionales++;
      continue;
    }

    const cantidad = parseNumber(getVal(colCantidad));
    if (cantidad == null || cantidad <= 0) continue;

    const mes = colMes >= 0 ? (parseNumber(getVal(colMes)) ?? 0) : 0;
    const año = mes >= 1 && mes <= 12 ? añoBase : añoBase;
    const fechaVal = getVal(colFecha);
    const fecha = parseDate(fechaVal, año) ?? (mes >= 1 && mes <= 12 ? new Date(Date.UTC(año, mes - 1, 1)) : new Date(Date.UTC(año, 0, 1)));
    const folio = colFactura >= 0 ? getStr(colFactura) : '';
    const producto = getStr(colProducto);
    if (!producto) continue;

    const familiaProducto = colFamilia >= 0 ? getStr(colFamilia) || null : null;
    const unidadRaw = colUnidad >= 0 ? getStr(colUnidad) : '';
    const unidad = unidadRaw || 'UNIDADES';
    const usd = colUSD >= 0 ? parseNumber(getVal(colUSD)) : null;
    const importeMN = colImporteMN >= 0 ? parseNumber(getVal(colImporteMN)) : null;
    const tipoCambio = colTipoCambio >= 0 ? parseNumber(getVal(colTipoCambio)) : null;

    if (!rangoDesde || fecha < rangoDesde) rangoDesde = fecha;
    if (!rangoHasta || fecha > rangoHasta) rangoHasta = fecha;

    transacciones.push({
      mes: fecha.getUTCMonth() + 1,
      año: fecha.getUTCFullYear(),
      fecha,
      folio,
      cliente,
      producto,
      familiaProducto: familiaProducto || null,
      unidad,
      cantidad,
      usd,
      importeMN,
      tipoCambio,
    });
  }

  return {
    transacciones,
    resumen: {
      totalFilas: sheet.rowCount - 1,
      excluidasCanceladas,
      excluidasNacionales,
      rangoFechas: { desde: rangoDesde, hasta: rangoHasta },
    },
    errores,
  };
}

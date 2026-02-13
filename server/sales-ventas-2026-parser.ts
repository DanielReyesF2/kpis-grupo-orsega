/**
 * Parser para los nuevos archivos Excel de ventas 2026
 * Formato:
 * - DI (Dura): Hojas por mes con columnas FECHA, FOLIO, CLIENTE, PRODUCTO, CANTIDAD, PRECIO UNITARIO, IMPORTE, T.C., IMPORTE M.N.
 * - GO (Orsega): Hojas por mes con columnas Factura, Fecha, Cliente, Producto, FAMILIA, UNIDAD, Cantidad, USD, MN, USD
 */

import type { Workbook, Worksheet } from 'exceljs';

export interface VentasTransaction {
  fecha: Date;
  folio: string | null;
  cliente: string;
  producto: string;
  cantidad: number;
  precioUnitario: number | null;
  importe: number | null;
  tipoCambio: number | null;
  importeMN: number | null;
  familiaProducto: string | null;
  unidad: string | null;
  año: number;
  mes: number;
  // Nuevos campos de utilidad (DI)
  costoUnitario: number | null;
  utilidadBruta: number | null;
}

export interface ParsedVentas2026 {
  transactions: VentasTransaction[];
  monthsFound: string[];
  totalRows: number;
  errors: string[];
}

/**
 * Detecta si es formato DI (Dura) o GO (Orsega)
 */
export function detectCompanyFormat(workbook: Workbook): 'DI' | 'GO' | 'UNKNOWN' {
  for (const sheet of workbook.worksheets) {
    const firstCell = sheet.getCell(1, 1).value?.toString() || '';
    const secondCell = sheet.getCell(1, 2).value?.toString() || '';

    // GO tiene "Grupo Orsega" en la primera celda
    if (firstCell.toLowerCase().includes('orsega') || firstCell.toLowerCase().includes('grupo orsega')) {
      return 'GO';
    }

    // DI tiene "DURA" o "VENTAS" como título
    if (firstCell.toLowerCase().includes('dura') || firstCell.toLowerCase().includes('ventas')) {
      return 'DI';
    }

    // Buscar en headers de fila 2 o 3
    const row2 = sheet.getRow(2);
    const row3 = sheet.getRow(3);

    // DI tiene "FOLIO" en columna 2, fila 2
    if (row2.getCell(2).value?.toString()?.toUpperCase() === 'FOLIO') {
      return 'DI';
    }

    // GO tiene "Factura" en columna 1, fila 3
    if (row3.getCell(1).value?.toString()?.toLowerCase() === 'factura') {
      return 'GO';
    }
  }

  return 'UNKNOWN';
}

/**
 * Extrae valor de celda (maneja fórmulas de ExcelJS)
 */
function getCellValue(value: any): any {
  if (value === null || value === undefined) return null;

  // Si es un objeto de fórmula, extraer el resultado
  if (typeof value === 'object' && value !== null) {
    // ExcelJS formula object: { formula: string, result: number | string }
    if ('result' in value) {
      return value.result;
    }
    // Rich text object
    if ('richText' in value) {
      return value.richText.map((rt: any) => rt.text).join('');
    }
    // Si tiene propiedad text
    if ('text' in value) {
      return value.text;
    }
  }

  return value;
}

/**
 * Parsea número del Excel
 */
function parseNumber(value: any): number | null {
  // Primero extraer el valor real (puede ser fórmula)
  const realValue = getCellValue(value);

  if (realValue === null || realValue === undefined || realValue === '') return null;
  if (typeof realValue === 'number') return realValue;
  if (typeof realValue === 'string') {
    let cleaned = realValue.replace(/[$,\s]/g, '').trim();
    // Manejar formato español (puntos como miles)
    if (cleaned.match(/^\d+\.\d{3}/)) {
      cleaned = cleaned.replace(/\./g, '');
    }
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Parsea fecha del Excel (usando UTC)
 */
function parseDate(value: any): Date | null {
  // Primero extraer el valor real (puede ser fórmula)
  const realValue = getCellValue(value);

  if (!realValue) return null;

  if (realValue instanceof Date) {
    return realValue;
  }

  if (typeof realValue === 'number') {
    // Excel serial date
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + realValue * 86400000);
  }

  if (typeof realValue === 'string') {
    const dateStr = realValue.trim();
    // Intentar varios formatos
    const dateParts = dateStr.split(/[\/\-]/);
    if (dateParts.length === 3) {
      let [part1, part2, part3] = dateParts.map(p => parseInt(p));

      // Detectar formato
      if (part1 > 1000) {
        // YYYY-MM-DD
        return new Date(Date.UTC(part1, part2 - 1, part3));
      } else if (part3 > 1000) {
        // DD/MM/YYYY o MM/DD/YYYY
        // Asumir DD/MM/YYYY si part1 > 12
        if (part1 > 12) {
          return new Date(Date.UTC(part3, part2 - 1, part1));
        }
        // MM/DD/YYYY
        return new Date(Date.UTC(part3, part1 - 1, part2));
      } else {
        // DD/MM/YY o MM/DD/YY
        const year = part3 < 50 ? 2000 + part3 : 1900 + part3;
        if (part1 > 12) {
          return new Date(Date.UTC(year, part2 - 1, part1));
        }
        return new Date(Date.UTC(year, part1 - 1, part2));
      }
    }

    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Obtiene el mes de un nombre de hoja
 */
function getMonthFromSheetName(name: string): number | null {
  const monthMap: { [key: string]: number } = {
    'enero': 1, 'february': 2, 'febrero': 2, 'march': 3, 'marzo': 3,
    'april': 4, 'abril': 4, 'may': 5, 'mayo': 5, 'june': 6, 'junio': 6,
    'july': 7, 'julio': 7, 'august': 8, 'agosto': 8, 'september': 9,
    'septiembre': 9, 'october': 10, 'octubre': 10, 'november': 11,
    'noviembre': 11, 'december': 12, 'diciembre': 12
  };

  const lower = name.toLowerCase();
  for (const [month, num] of Object.entries(monthMap)) {
    if (lower.includes(month)) {
      return num;
    }
  }
  return null;
}

/**
 * Parsea hoja "Acumulado" de DI
 * Headers en fila 4: FECHA, FOLIO, CLIENTE, PRODUCTO, CANTIDAD, PRECIO UNITARIO, IMPORTE
 * Datos desde fila 5
 */
export function parseAcumuladoDI(workbook: Workbook): VentasTransaction[] {
  // Buscar hoja Acumulado (case insensitive)
  const sheet = workbook.worksheets.find(
    ws => ws.name.toLowerCase().includes('acumulado')
  );

  if (!sheet) {
    console.log('⚠️ [parseAcumuladoDI] No se encontró hoja Acumulado');
    return [];
  }

  console.log(`📄 [parseAcumuladoDI] Procesando hoja: "${sheet.name}"`);
  const transactions: VentasTransaction[] = [];
  const headerRow = 4;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;

    // Obtener folio y saltar canceladas
    const folioValue = getCellValue(row.getCell(2));
    const folio = folioValue?.toString()?.trim() || '';

    if (!folio || folio.toUpperCase().includes('CANCELA')) {
      return;
    }

    const fechaValue = row.getCell(1).value;
    const fecha = parseDate(fechaValue);
    const cliente = getCellValue(row.getCell(3))?.toString()?.trim();
    const producto = getCellValue(row.getCell(4))?.toString()?.trim();
    const cantidad = parseNumber(row.getCell(5).value);

    // Validar campos requeridos
    if (!fecha || !cliente || !producto || !cantidad || cantidad <= 0) {
      return;
    }

    const precioUnitario = parseNumber(row.getCell(6).value);
    const importe = parseNumber(row.getCell(7).value);
    // Columnas de utilidad (formato DI 2026):
    // Col 9 = COSTO UNITARIO PUESTO EN BODEGA
    // Col 11 = UTILIDAD / PÉRDIDA (total por línea)
    const costoUnitario = parseNumber(row.getCell(9).value);
    const utilidadBruta = parseNumber(row.getCell(11).value);
    // T.C. e IMPORTE M.N. podrían estar en otras columnas o no existir
    const tipoCambio = null; // Ya no está en col 9
    const importeMN = null; // Ya no está en col 10

    transactions.push({
      fecha,
      folio,
      cliente,
      producto,
      cantidad,
      precioUnitario,
      importe,
      tipoCambio,
      importeMN,
      familiaProducto: null,
      unidad: 'KG',
      año: fecha.getUTCFullYear(),
      mes: fecha.getUTCMonth() + 1,
      costoUnitario,
      utilidadBruta
    });
  });

  console.log(`   ✅ ${transactions.length} transacciones del acumulado DI`);
  return transactions;
}

/**
 * Parsea hoja de ventas formato DI
 * Headers en fila 2: FECHA, FOLIO, CLIENTE, PRODUCTO, CANTIDAD, PRECIO UNITARIO, IMPORTE, (vacío), T.C., IMPORTE M.N.
 */
function parseSheetDI(worksheet: Worksheet, sheetMonth: number | null): VentasTransaction[] {
  const transactions: VentasTransaction[] = [];
  const headerRow = 2;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;

    const fechaValue = row.getCell(1).value;
    const fecha = parseDate(fechaValue);

    // Saltar filas sin fecha válida o filas de "CANCELA"
    const folioCell = row.getCell(2).value?.toString() || '';
    if (folioCell.toUpperCase().includes('CANCELA')) {
      return;
    }

    const cliente = row.getCell(3).value?.toString()?.trim();
    const producto = row.getCell(4).value?.toString()?.trim();
    const cantidad = parseNumber(row.getCell(5).value);

    // Validar campos requeridos
    if (!cliente || !producto || !cantidad || cantidad <= 0) {
      return;
    }

    const precioUnitario = parseNumber(row.getCell(6).value);
    const importe = parseNumber(row.getCell(7).value);
    // DI 2026: Col 9 = COSTO UNITARIO, Col 11 = UTILIDAD / PÉRDIDA
    const costoUnitario = parseNumber(row.getCell(9).value);
    const utilidadBruta = parseNumber(row.getCell(11).value);

    // Usar fecha de la fila o construir del mes de la hoja
    const finalDate = fecha || (sheetMonth ? new Date(Date.UTC(2026, sheetMonth - 1, 1)) : new Date());

    transactions.push({
      fecha: finalDate,
      folio: folioCell || null,
      cliente,
      producto,
      cantidad,
      precioUnitario,
      importe,
      tipoCambio: null,
      importeMN: null,
      familiaProducto: null,
      unidad: 'KG',
      año: finalDate.getUTCFullYear(),
      mes: finalDate.getUTCMonth() + 1,
      costoUnitario,
      utilidadBruta
    });
  });

  return transactions;
}

/**
 * Parsea hoja de ventas formato GO
 * Headers en fila 3: Factura, Fecha, Cliente, Producto, FAMILIA DEL PRODUCTO, UNIDAD, Cantidad, USD, MN, USD
 */
function parseSheetGO(worksheet: Worksheet, sheetMonth: number | null): VentasTransaction[] {
  const transactions: VentasTransaction[] = [];
  const headerRow = 3;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;

    // Saltar filas de separador (NACIONALES, EXPORTACIONES, etc.)
    const firstCell = row.getCell(1).value?.toString()?.trim() || '';
    if (firstCell.toUpperCase() === 'NACIONALES' ||
        firstCell.toUpperCase() === 'EXPORTACIONES' ||
        firstCell.toUpperCase() === 'TOTAL' ||
        !firstCell) {
      return;
    }

    const folio = firstCell;
    const fechaValue = row.getCell(2).value;
    const fecha = parseDate(fechaValue);

    const cliente = row.getCell(3).value?.toString()?.trim();
    const producto = row.getCell(4).value?.toString()?.trim();
    const familiaProducto = row.getCell(5).value?.toString()?.trim() || null;
    const unidad = row.getCell(6).value?.toString()?.trim() || 'KG';
    const cantidad = parseNumber(row.getCell(7).value);
    const precioUSD = parseNumber(row.getCell(8).value);
    const precioMN = parseNumber(row.getCell(9).value);
    const importeUSD = parseNumber(row.getCell(10).value);
    const importeMN = parseNumber(row.getCell(11).value);
    const tipoCambio = parseNumber(row.getCell(12).value);

    // Validar campos requeridos
    if (!cliente || !producto || !cantidad || cantidad <= 0) {
      return;
    }

    // Usar fecha de la fila o construir del mes de la hoja
    const finalDate = fecha || (sheetMonth ? new Date(Date.UTC(2026, sheetMonth - 1, 1)) : new Date());

    transactions.push({
      fecha: finalDate,
      folio: folio || null,
      cliente,
      producto,
      cantidad,
      precioUnitario: precioUSD,
      importe: importeUSD,
      tipoCambio,
      importeMN,
      familiaProducto,
      unidad,
      año: finalDate.getUTCFullYear(),
      mes: finalDate.getUTCMonth() + 1,
      costoUnitario: null, // GO no tiene estos campos
      utilidadBruta: null
    });
  });

  return transactions;
}

/**
 * Parsea hoja "ACUMULADO 2026" de GO
 * Headers en fila 3: # MES, Factura, Fecha, Cliente, Producto, FAMILIA, UNIDAD, Cantidad, USD, MN, USD, MN
 * Datos desde fila 5 (saltando fila de headers y fila NACIONALES)
 */
export function parseAcumuladoGO(workbook: Workbook): VentasTransaction[] {
  // Buscar hoja ACUMULADO 2026
  const sheet = workbook.worksheets.find(
    ws => ws.name.toUpperCase().includes('ACUMULADO') && ws.name.includes('2026')
  );

  if (!sheet) {
    console.log('⚠️ [parseAcumuladoGO] No se encontró hoja ACUMULADO 2026');
    return [];
  }

  console.log(`📄 [parseAcumuladoGO] Procesando hoja: "${sheet.name}"`);
  const transactions: VentasTransaction[] = [];
  const headerRow = 3;

  sheet.eachRow((row, rowNumber) => {
    // Saltar filas de headers (hasta fila 4)
    if (rowNumber <= headerRow + 1) return;

    // Saltar filas de separador (NACIONALES, EXPORTACIONES, TOTAL, etc.)
    const firstCell = getCellValue(row.getCell(1))?.toString()?.trim() || '';
    if (!firstCell ||
        firstCell.toUpperCase() === 'NACIONALES' ||
        firstCell.toUpperCase() === 'EXPORTACIONES' ||
        firstCell.toUpperCase() === 'TOTAL' ||
        firstCell.toUpperCase().includes('TOTAL')) {
      return;
    }

    const folio = getCellValue(row.getCell(2))?.toString()?.trim() || null;
    const fechaValue = row.getCell(3).value;
    const fecha = parseDate(fechaValue);

    const cliente = getCellValue(row.getCell(4))?.toString()?.trim();
    const producto = getCellValue(row.getCell(5))?.toString()?.trim();
    const familiaProducto = getCellValue(row.getCell(6))?.toString()?.trim() || null;
    const unidad = getCellValue(row.getCell(7))?.toString()?.trim() || 'KG';
    const cantidad = parseNumber(row.getCell(8).value);
    const precioUSD = parseNumber(row.getCell(9).value);
    const importeMN = parseNumber(row.getCell(10).value);
    const importeUSD = parseNumber(row.getCell(11).value);

    // Validar campos requeridos
    if (!fecha || !cliente || !producto || !cantidad || cantidad <= 0 || !folio) {
      return;
    }

    transactions.push({
      fecha,
      folio,
      cliente,
      producto,
      cantidad,
      precioUnitario: precioUSD,
      importe: importeUSD || (precioUSD ? precioUSD * cantidad : null),
      tipoCambio: null,
      importeMN,
      familiaProducto,
      unidad,
      año: fecha.getUTCFullYear(),
      mes: fecha.getUTCMonth() + 1,
      costoUnitario: null, // GO no tiene estos campos
      utilidadBruta: null
    });
  });

  console.log(`   ✅ ${transactions.length} transacciones del acumulado GO`);
  return transactions;
}

/**
 * Parsea archivo Excel de ventas 2026
 */
export async function parseVentas2026(workbook: Workbook): Promise<ParsedVentas2026> {
  const format = detectCompanyFormat(workbook);
  console.log(`📊 [Ventas2026 Parser] Formato detectado: ${format}`);

  const result: ParsedVentas2026 = {
    transactions: [],
    monthsFound: [],
    totalRows: 0,
    errors: []
  };

  // Meses a buscar (2026)
  const monthSheets = [
    'ENERO 2026', 'FEBRERO 2026', 'MARZO 2026', 'ABRIL 2026',
    'MAYO 2026', 'JUNIO 2026', 'JULIO 2026', 'AGOSTO 2026',
    'SEPTIEMBRE 2026', 'OCTUBRE 2026', 'NOVIEMBRE 2026', 'DICIEMBRE 2026'
  ];

  for (const sheetName of monthSheets) {
    const worksheet = workbook.worksheets.find(
      ws => ws.name.toUpperCase().includes(sheetName.split(' ')[0])
        && ws.name.includes('2026')
    );

    if (!worksheet) continue;

    const monthNum = getMonthFromSheetName(sheetName);
    result.monthsFound.push(worksheet.name);

    console.log(`📄 [Ventas2026 Parser] Procesando hoja: "${worksheet.name}"`);

    try {
      let sheetTransactions: VentasTransaction[];

      if (format === 'DI') {
        sheetTransactions = parseSheetDI(worksheet, monthNum);
      } else if (format === 'GO') {
        sheetTransactions = parseSheetGO(worksheet, monthNum);
      } else {
        // Intentar detectar por estructura de la hoja
        const row2Cell2 = worksheet.getRow(2).getCell(2).value?.toString()?.toUpperCase();
        if (row2Cell2 === 'FOLIO') {
          sheetTransactions = parseSheetDI(worksheet, monthNum);
        } else {
          sheetTransactions = parseSheetGO(worksheet, monthNum);
        }
      }

      result.transactions.push(...sheetTransactions);
      result.totalRows += sheetTransactions.length;
      console.log(`   ✅ ${sheetTransactions.length} transacciones procesadas`);

    } catch (error: any) {
      result.errors.push(`Error en hoja "${worksheet.name}": ${error.message}`);
      console.error(`   ❌ Error: ${error.message}`);
    }
  }

  // Para GO, también intentar ACUMULADO 2026 si no hay hojas de meses
  if (format === 'GO' && result.transactions.length === 0) {
    const acumSheet = workbook.getWorksheet('ACUMULADO 2026');
    if (acumSheet) {
      console.log(`📄 [Ventas2026 Parser] Procesando hoja: "ACUMULADO 2026"`);
      // Usar la función que trabaja con workbook completo
      const acumTransactions = parseAcumuladoGO(workbook);
      result.transactions.push(...acumTransactions);
      result.totalRows += acumTransactions.length;
      result.monthsFound.push('ACUMULADO 2026');
    }
  }

  console.log(`\n✅ [Ventas2026 Parser] Total: ${result.transactions.length} transacciones`);
  console.log(`   Meses encontrados: ${result.monthsFound.join(', ')}`);

  return result;
}

/**
 * Detecta si el workbook es del nuevo formato 2026
 */
export function isVentas2026Format(workbook: Workbook): boolean {
  const sheetNames = workbook.worksheets.map(ws => ws.name.toUpperCase());

  // Buscar hojas de meses 2026
  const hasMonthSheets = sheetNames.some(name =>
    name.includes('2026') && (
      name.includes('ENERO') || name.includes('FEBRERO') ||
      name.includes('MARZO') || name.includes('ABRIL')
    )
  );

  // Buscar hoja ACUMULADO 2026
  const hasAcumulado = sheetNames.some(name => name.includes('ACUMULADO') && name.includes('2026'));

  // DI también puede tener solo "Acumulado" sin año
  const hasAcumuladoSimple = sheetNames.some(name => name === 'ACUMULADO');

  return hasMonthSheets || hasAcumulado || hasAcumuladoSimple;
}

/**
 * Construye clave única para deduplicación de transacciones
 * Formato: folio|fecha|producto|cantidad
 */
export function buildDedupKey(tx: VentasTransaction): string {
  const folio = (tx.folio || '').toLowerCase().trim();
  const fecha = tx.fecha.toISOString().split('T')[0];
  const producto = (tx.producto || '').toLowerCase().trim();
  const cantidad = tx.cantidad.toFixed(2);
  return `${folio}|${fecha}|${producto}|${cantidad}`;
}

/**
 * Parsea Excel usando SIEMPRE las hojas ACUMULADO como fuente principal
 * Esta es la función preferida para uploads semanales
 */
export async function parseVentas2026Acumulado(workbook: Workbook): Promise<ParsedVentas2026> {
  const format = detectCompanyFormat(workbook);
  console.log(`📊 [Ventas2026 Acumulado Parser] Formato detectado: ${format}`);

  const result: ParsedVentas2026 = {
    transactions: [],
    monthsFound: [],
    totalRows: 0,
    errors: []
  };

  try {
    if (format === 'DI') {
      const transactions = parseAcumuladoDI(workbook);
      result.transactions = transactions;
      result.totalRows = transactions.length;
      if (transactions.length > 0) {
        result.monthsFound.push('Acumulado DI');
      }
    } else if (format === 'GO') {
      const transactions = parseAcumuladoGO(workbook);
      result.transactions = transactions;
      result.totalRows = transactions.length;
      if (transactions.length > 0) {
        result.monthsFound.push('ACUMULADO 2026 GO');
      }
    } else {
      // Intentar ambos formatos
      let transactions = parseAcumuladoDI(workbook);
      if (transactions.length === 0) {
        transactions = parseAcumuladoGO(workbook);
        if (transactions.length > 0) {
          result.monthsFound.push('ACUMULADO 2026');
        }
      } else {
        result.monthsFound.push('Acumulado');
      }
      result.transactions = transactions;
      result.totalRows = transactions.length;
    }

    // Si no encontramos datos en ACUMULADO, intentar hojas por mes como fallback
    if (result.transactions.length === 0) {
      console.log('⚠️ [Ventas2026 Acumulado Parser] No se encontraron datos en ACUMULADO, intentando hojas por mes...');
      const fallbackResult = await parseVentas2026(workbook);
      return fallbackResult;
    }

    console.log(`\n✅ [Ventas2026 Acumulado Parser] Total: ${result.transactions.length} transacciones`);
    console.log(`   Fuente: ${result.monthsFound.join(', ')}`);

  } catch (error: any) {
    result.errors.push(`Error parseando acumulado: ${error.message}`);
    console.error(`❌ [Ventas2026 Acumulado Parser] Error: ${error.message}`);
  }

  return result;
}

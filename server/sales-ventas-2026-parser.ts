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
 * Detecta posiciones de columnas en header de DI
 */
function detectDIColumnPositions(sheet: Worksheet, headerRowNum: number): { [key: string]: number } {
  const positions: { [key: string]: number } = {};
  const headerRow = sheet.getRow(headerRowNum);

  headerRow.eachCell((cell, colNumber) => {
    const val = getCellValue(cell)?.toString()?.toUpperCase()?.trim() || '';
    if (val.includes('FECHA') && !val.includes('MES')) positions['fecha'] = colNumber;
    if (val.includes('FOLIO') || val === 'FACTURA') positions['folio'] = colNumber;
    if (val.includes('CLIENTE')) positions['cliente'] = colNumber;
    if (val.includes('PRODUCTO') && !val.includes('FAMILIA')) positions['producto'] = colNumber;
    if (val.includes('CANTIDAD') || val === 'CANT') positions['cantidad'] = colNumber;
    if (val.includes('PRECIO') && val.includes('UNIT')) positions['precioUnitario'] = colNumber;
    if (val === 'IMPORTE' || (val.includes('IMPORTE') && !val.includes('M.N'))) positions['importe'] = colNumber;
    if (val.includes('UTILIDAD') && val.includes('PÉRDIDA') && !val.includes('UNIT')) positions['utilidadBruta'] = colNumber;
    if (val.includes('COSTO') && val.includes('UNIT')) positions['costoUnitario'] = colNumber;
    if (val.includes('T.C') || val.includes('TIPO') && val.includes('CAMBIO')) positions['tipoCambio'] = colNumber;
    if (val.includes('IMPORTE') && val.includes('M.N')) positions['importeMN'] = colNumber;
  });

  return positions;
}

/**
 * Parsea hoja "Acumulado" de DI
 * Detecta posición de columnas dinámicamente
 */
export function parseAcumuladoDI(workbook: Workbook): VentasTransaction[] {
  // Listar todas las hojas para debug
  const allSheets = workbook.worksheets.map(ws => ws.name);
  console.log(`📑 [parseAcumuladoDI] Hojas en workbook: ${JSON.stringify(allSheets)}`);

  // Buscar hoja Acumulado (case insensitive) o la primera hoja que tenga datos DI
  let sheet = workbook.worksheets.find(
    ws => ws.name.toLowerCase().includes('acumulado')
  );

  // Si no encontramos "Acumulado", buscar hoja con estructura DI (FECHA en fila 4)
  if (!sheet) {
    console.log('   🔍 No se encontró hoja "Acumulado", buscando por estructura...');
    for (const ws of workbook.worksheets) {
      // Saltar hojas de meses conocidos
      const nameUpper = ws.name.toUpperCase();
      if (nameUpper.includes('ENERO') || nameUpper.includes('FEBRERO') ||
          nameUpper.includes('MARZO') || nameUpper.includes('ABRIL') ||
          nameUpper.includes('MAYO') || nameUpper.includes('JUNIO') ||
          nameUpper.includes('JULIO') || nameUpper.includes('AGOSTO') ||
          nameUpper.includes('SEPTIEMBRE') || nameUpper.includes('OCTUBRE') ||
          nameUpper.includes('NOVIEMBRE') || nameUpper.includes('DICIEMBRE')) {
        continue;
      }
      // Verificar si tiene estructura DI (FECHA en alguna fila cercana)
      for (let r = 1; r <= 6; r++) {
        const cell = getCellValue(ws.getRow(r).getCell(1))?.toString()?.toUpperCase()?.trim();
        if (cell === 'FECHA') {
          sheet = ws;
          console.log(`   ✅ Encontrada hoja con estructura DI: "${ws.name}" (FECHA en fila ${r})`);
          break;
        }
      }
      if (sheet) break;
    }
  }

  if (!sheet) {
    console.log('⚠️ [parseAcumuladoDI] No se encontró hoja Acumulado ni hoja con estructura DI');
    return [];
  }

  console.log(`📄 [parseAcumuladoDI] Procesando hoja: "${sheet.name}" - NUEVO CÓDIGO v3`);

  // DEBUG: Mostrar contenido de primeras filas
  try {
    console.log(`   🔍 DEBUG: Analizando estructura del sheet...`);
    console.log(`   📊 Total filas en sheet: ${sheet.rowCount}`);

    for (let r = 1; r <= Math.min(6, sheet.rowCount); r++) {
      const row = sheet.getRow(r);
      const cells: string[] = [];
      for (let c = 1; c <= 15; c++) {
        const cellVal = row.getCell(c).value;
        const val = getCellValue(cellVal)?.toString()?.trim() || '';
        if (val) cells.push(`[${c}]${val.substring(0, 12)}`);
      }
      console.log(`      F${r}: ${cells.length > 0 ? cells.join(' ') : '(vacía)'}`);
    }
  } catch (debugError: any) {
    console.log(`   ❌ Error en debug: ${debugError.message}`);
  }

  // Buscar fila de headers (puede ser 2, 3 o 4)
  // Buscar FECHA en columnas 1-5
  let headerRow = 4; // Default para DI es fila 4
  let foundHeader = false;
  for (let r = 1; r <= 6; r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= 5; c++) {
      const cellVal = getCellValue(row.getCell(c))?.toString()?.toUpperCase()?.trim() || '';
      if (cellVal.includes('FECHA')) {
        headerRow = r;
        console.log(`   ✅ Headers encontrados en fila ${r}, col ${c} (FECHA)`);
        foundHeader = true;
        break;
      }
    }
    if (foundHeader) break;
  }
  if (!foundHeader) {
    console.log(`   ⚠️ No se encontró header FECHA, usando default fila ${headerRow}`);
  }

  const cols = detectDIColumnPositions(sheet, headerRow);
  console.log(`   📊 Columnas detectadas:`, JSON.stringify(cols));

  // Usar posiciones detectadas o valores por defecto para DI 2026
  // DI: 1=FECHA,2=FOLIO,3=CLIENTE,4=PRODUCTO,5=CANTIDAD,6=PRECIO,7=IMPORTE,8=(vacío),9=LOTE,10=COSTO,11=UT.BRUTA UNIT,12=UTILIDAD/PÉRDIDA
  const colFecha = cols['fecha'] || 1;
  const colFolio = cols['folio'] || 2;
  const colCliente = cols['cliente'] || 3;
  const colProducto = cols['producto'] || 4;
  const colCantidad = cols['cantidad'] || 5;
  const colPrecioUnit = cols['precioUnitario'] || 6;
  const colImporte = cols['importe'] || 7;
  const colCostoUnit = cols['costoUnitario'] || 10;  // COSTO UNITARIO en col 10
  const colUtilidad = cols['utilidadBruta'] || 12;   // UTILIDAD / PÉRDIDA en col 12
  const colTC = cols['tipoCambio'];
  const colImporteMN = cols['importeMN'];

  console.log(`   💰 Columnas: COSTO=${colCostoUnit}, UTILIDAD=${colUtilidad}`);

  const transactions: VentasTransaction[] = [];
  let primeraUtilidad: number | null = null;

  let rowsSkipped = 0;
  let firstDataRow = true;
  let rowsProcessed = 0;

  console.log(`   🔄 Iniciando eachRow desde headerRow=${headerRow}...`);

  sheet.eachRow((row, rowNumber) => {
    rowsProcessed++;
    if (rowNumber <= headerRow) return;

    // Obtener folio y saltar canceladas
    const folioValue = getCellValue(row.getCell(colFolio));
    const folio = folioValue?.toString()?.trim() || '';

    // DEBUG: Mostrar las primeras 3 filas de datos intentadas
    if (rowsProcessed <= headerRow + 3) {
      console.log(`      📝 Fila ${rowNumber}: folio="${folio?.substring(0,15) || '(vacío)'}"`);
    }

    if (!folio || folio.toUpperCase().includes('CANCELA')) {
      rowsSkipped++;
      return;
    }

    const fechaValue = row.getCell(colFecha).value;
    const fecha = parseDate(fechaValue);
    const cliente = getCellValue(row.getCell(colCliente))?.toString()?.trim();
    const producto = getCellValue(row.getCell(colProducto))?.toString()?.trim();
    const cantidad = parseNumber(row.getCell(colCantidad).value);

    // DEBUG: Log primera fila de datos
    if (firstDataRow) {
      firstDataRow = false;
      console.log(`   🔬 Primera fila datos (fila ${rowNumber}):`);
      console.log(`      Folio: "${folio}", Fecha: ${fecha}, Cliente: "${cliente?.substring(0,20)}"`);
      console.log(`      Producto: "${producto?.substring(0,20)}", Cantidad: ${cantidad}`);
      // Mostrar columnas de utilidad
      const rawUtilidad = row.getCell(colUtilidad).value;
      console.log(`      Col ${colUtilidad} (utilidad): raw=${JSON.stringify(rawUtilidad)}`);
    }

    // Validar campos requeridos
    if (!fecha || !cliente || !producto || !cantidad || cantidad <= 0) {
      if (transactions.length < 3) {
        console.log(`   ⚠️ Fila ${rowNumber} saltada: fecha=${!!fecha} cliente=${!!cliente} producto=${!!producto} cantidad=${cantidad}`);
      }
      rowsSkipped++;
      return;
    }

    const precioUnitario = parseNumber(row.getCell(colPrecioUnit).value);
    const importe = parseNumber(row.getCell(colImporte).value);
    const costoUnitario = parseNumber(row.getCell(colCostoUnit).value);
    const utilidadBruta = parseNumber(row.getCell(colUtilidad).value);
    const tipoCambio = colTC ? parseNumber(row.getCell(colTC).value) : null;
    const importeMN = colImporteMN ? parseNumber(row.getCell(colImporteMN).value) : null;

    // Log de la primera utilidad encontrada para debugging
    if (primeraUtilidad === null && utilidadBruta !== null) {
      primeraUtilidad = utilidadBruta;
      console.log(`   💵 Primera utilidad encontrada: ${utilidadBruta} (fila ${rowNumber})`);
    }

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

  console.log(`   📊 eachRow completado: ${rowsProcessed} filas procesadas, ${rowsSkipped} saltadas`);
  const conUtilidad = transactions.filter(t => t.utilidadBruta !== null).length;
  console.log(`   ✅ ${transactions.length} transacciones del acumulado DI (${conUtilidad} con utilidad)`);
  return transactions;
}

/**
 * Parsea hoja de ventas formato DI (hojas mensuales)
 */
function parseSheetDI(worksheet: Worksheet, sheetMonth: number | null): VentasTransaction[] {
  const transactions: VentasTransaction[] = [];

  // DEBUG: Mostrar contenido de headers
  console.log(`   🔍 [parseSheetDI] Headers de "${worksheet.name}":`);
  for (let r = 1; r <= 3; r++) {
    const row = worksheet.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= 18; c++) {
      const val = getCellValue(row.getCell(c))?.toString()?.trim() || '';
      if (val) cells.push(`[${c}]${val.substring(0, 12)}`);
    }
    if (cells.length > 0) console.log(`      F${r}: ${cells.join(' ')}`);
  }

  // Detectar columna de utilidad buscando en headers
  let headerRow = 2;
  let colUtilidad = 11; // Default más bajo por si no hay columna vacía
  let colCosto = 9;

  for (let r = 1; r <= 4; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= 20; c++) {
      const val = getCellValue(row.getCell(c))?.toString()?.toUpperCase()?.trim() || '';
      // Buscar UTILIDAD / PÉRDIDA (exacta o parcial)
      if (val.includes('UTILIDAD') && (val.includes('PERDIDA') || val.includes('PÉRDIDA'))) {
        if (!val.includes('UNIT') && !val.includes('BRUTA') && !val.includes('APROX')) {
          colUtilidad = c;
          headerRow = r;
          console.log(`   ✅ [parseSheetDI] UTILIDAD col=${c} fila=${r} "${val}"`);
        }
      }
      if (val.includes('COSTO') && val.includes('UNIT')) {
        colCosto = c;
      }
    }
  }

  console.log(`   📋 [parseSheetDI] FINAL: headerRow=${headerRow}, colUtilidad=${colUtilidad}, colCosto=${colCosto}`);

  let primeraUtilidad: number | null = null;

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
    // Columnas de utilidad - usar posiciones detectadas
    const costoUnitario = parseNumber(row.getCell(colCosto).value);
    const utilidadBruta = parseNumber(row.getCell(colUtilidad).value);

    // DEBUG: Log de primera fila de datos para verificar columnas
    if (transactions.length === 0) {
      const rawUtilidad = row.getCell(colUtilidad).value;
      const rawCosto = row.getCell(colCosto).value;
      console.log(`   🔬 Primera fila datos (fila ${rowNumber}):`);
      console.log(`      Col ${colCosto} (costo): raw="${rawCosto}" → ${costoUnitario}`);
      console.log(`      Col ${colUtilidad} (utilidad): raw="${rawUtilidad}" → ${utilidadBruta}`);
      // También mostrar cols cercanas
      for (let c = 8; c <= 14; c++) {
        const v = getCellValue(row.getCell(c));
        console.log(`      Col ${c}: "${v}"`);
      }
    }

    // Log primera utilidad encontrada
    if (primeraUtilidad === null && utilidadBruta !== null) {
      primeraUtilidad = utilidadBruta;
      console.log(`   💵 Primera utilidad en hoja: ${utilidadBruta}`);
    }

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

  const conUtilidad = transactions.filter(t => t.utilidadBruta !== null).length;
  console.log(`   📊 ${transactions.length} txns, ${conUtilidad} con utilidad`);

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
    // GO 2026: Col 16=COMPRA, Col 17=FLETE, Col 18=UTILIDAD BRUTA
    const compra = parseNumber(row.getCell(16).value);
    const utilidadBruta = parseNumber(row.getCell(18).value);

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
      costoUnitario: compra, // COMPRA es el costo para GO
      utilidadBruta
    });
  });

  const conUtilidad = transactions.filter(t => t.utilidadBruta !== null).length;
  console.log(`   📊 [parseSheetGO] ${transactions.length} txns, ${conUtilidad} con utilidad`);

  return transactions;
}

/**
 * Parsea hoja "ACUMULADO 2026" de GO
 * GO tiene 2 filas de headers:
 * - Fila 2: Headers de grupo (Precio, Importe)
 * - Fila 3: # MES, Factura, Fecha, Cliente, Producto, FAMILIA, UNIDAD, Cantidad, USD, MN, USD, MN, TIPO DE CAMBIO, IMPORTE M.N., (vacío), COMPRA, FLETE, UTILIDAD BRUTA
 * Datos desde fila 5 (saltando headers y fila NACIONALES)
 */
export function parseAcumuladoGO(workbook: Workbook): VentasTransaction[] {
  // Listar todas las hojas para debug
  const allSheets = workbook.worksheets.map(ws => ws.name);
  console.log(`📑 [parseAcumuladoGO] Hojas en workbook: ${JSON.stringify(allSheets)}`);

  // Buscar hoja ACUMULADO 2026
  let sheet = workbook.worksheets.find(
    ws => ws.name.toUpperCase().includes('ACUMULADO') && ws.name.includes('2026')
  );

  // Fallback: buscar solo "ACUMULADO"
  if (!sheet) {
    sheet = workbook.worksheets.find(
      ws => ws.name.toUpperCase().includes('ACUMULADO')
    );
    if (sheet) {
      console.log(`   🔍 Usando hoja fallback: "${sheet.name}"`);
    }
  }

  if (!sheet) {
    console.log('⚠️ [parseAcumuladoGO] No se encontró hoja ACUMULADO');
    return [];
  }

  console.log(`📄 [parseAcumuladoGO] Procesando hoja: "${sheet.name}"`);

  // Detectar columna de UTILIDAD BRUTA
  let colUtilidad = 18; // default para GO
  let colCompra = 16;   // COMPRA (costo)
  const headerRow = 3;

  const row3 = sheet.getRow(headerRow);
  row3.eachCell((cell, colNumber) => {
    const val = getCellValue(cell)?.toString()?.toUpperCase()?.trim() || '';
    if (val.includes('UTILIDAD') && val.includes('BRUTA')) {
      colUtilidad = colNumber;
    }
    if (val === 'COMPRA') {
      colCompra = colNumber;
    }
  });

  console.log(`   📋 [parseAcumuladoGO] Columnas: COMPRA=${colCompra}, UTILIDAD BRUTA=${colUtilidad}`);

  const transactions: VentasTransaction[] = [];
  let primeraUtilidad: number | null = null;

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
    const tipoCambio = parseNumber(row.getCell(13).value);
    // GO 2026: COMPRA y UTILIDAD BRUTA
    const compra = parseNumber(row.getCell(colCompra).value);
    const utilidadBruta = parseNumber(row.getCell(colUtilidad).value);

    // Validar campos requeridos
    if (!fecha || !cliente || !producto || !cantidad || cantidad <= 0 || !folio) {
      return;
    }

    // Log primera utilidad
    if (primeraUtilidad === null && utilidadBruta !== null) {
      primeraUtilidad = utilidadBruta;
      console.log(`   💵 Primera utilidad GO: ${utilidadBruta}`);
    }

    transactions.push({
      fecha,
      folio,
      cliente,
      producto,
      cantidad,
      precioUnitario: precioUSD,
      importe: importeUSD || (precioUSD ? precioUSD * cantidad : null),
      tipoCambio,
      importeMN,
      familiaProducto,
      unidad,
      año: fecha.getUTCFullYear(),
      mes: fecha.getUTCMonth() + 1,
      costoUnitario: compra,
      utilidadBruta
    });
  });

  const conUtilidad = transactions.filter(t => t.utilidadBruta !== null).length;
  console.log(`   ✅ ${transactions.length} transacciones del acumulado GO (${conUtilidad} con utilidad)`);
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
  console.log(`\n🔶🔶🔶 [NUEVO PARSER v2] Iniciando parseVentas2026Acumulado 🔶🔶🔶`);
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

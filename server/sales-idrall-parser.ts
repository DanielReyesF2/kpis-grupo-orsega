/**
 * Parser específico para archivos Excel de IDRALL (CRM de ventas)
 *
 * Estructura esperada (1 sola hoja):
 * A: MID / Folio (ej: "101441 / 45")
 * B: Status / com (ACTIVO, CANCELADO)
 * C: Fecha (DD/MM/YY)
 * D: Cliente
 * E: Producto
 * F: Cantidad
 * G: Tipo de cambio
 * H: Precio Unitario
 * I: Importe (USD)
 * J: Lote
 * K: Tipo de cambio (costo)
 * L: Costo unitario
 * M: Ut./Perdida
 * N: Utilidad/Pe Gastos
 * O: Utilidad aprc % UT
 */

import type { Workbook, Worksheet, Row } from 'exceljs';

export interface IDRALLTransaction {
  // Identificadores
  folio: string;
  folioNumero: number | null;
  folioSecuencia: number | null;

  // Status
  status: 'ACTIVO' | 'CANCELADO';

  // Fecha
  fecha: Date;
  año: number;
  mes: number;
  semana: number;

  // Entidades
  cliente: string;
  producto: string;
  lote: string | null;

  // Cantidades y precios
  cantidad: number;
  tipoCambio: number | null;
  precioUnitario: number | null;
  importe: number | null;

  // Costos y utilidad
  tipoCambioCosto: number | null;
  costoUnitario: number | null;
  utilidadPerdida: number | null;
  utilidadConGastos: number | null;
  utilidadPorcentaje: number | null;
}

export interface IDRALLParseResult {
  transacciones: IDRALLTransaction[];
  resumen: {
    totalRegistros: number;
    registrosActivos: number;
    registrosCancelados: number;
    registrosInvalidos: number;
    clientesUnicos: number;
    productosUnicos: number;
    rangoFechas: {
      desde: Date | null;
      hasta: Date | null;
    };
  };
  errores: Array<{
    fila: number;
    error: string;
    datos?: any;
  }>;
}

/**
 * Parsea un valor numérico del Excel, manejando formatos como "$1,234.56"
 */
function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;

  // Si ya es número, retornarlo
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  if (typeof value === 'string') {
    // Remover $, espacios y comas
    let cleaned = value.replace(/[$,\s]/g, '').trim();

    // Manejar paréntesis como negativos: ($100) -> -100
    if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
      cleaned = '-' + cleaned.slice(1, -1);
    }

    // Manejar porcentajes
    if (cleaned.endsWith('%')) {
      cleaned = cleaned.slice(0, -1);
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    }

    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Parsea una fecha del Excel (puede ser Date, número serial, o string)
 */
function parseDate(value: any, rowNum?: number): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    // Log para debugging de fechas (solo primeras 5 filas con datos)
    if (rowNum && rowNum <= 7) {
      console.log(`📅 [IDRALL Parser] Fila ${rowNum}: Fecha como Date object: ${value.toISOString()} → mes=${value.getMonth() + 1}, año=${value.getFullYear()}`);
    }
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    // Excel serial date (días desde 1899-12-30)
    // Usar UTC para evitar problemas de timezone
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + value * 86400000);
    if (rowNum && rowNum <= 7) {
      console.log(`📅 [IDRALL Parser] Fila ${rowNum}: Fecha como serial ${value} → ${date.toISOString()} → mes=${date.getMonth() + 1}, año=${date.getFullYear()}`);
    }
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const dateStr = value.trim();

    // Formato MM/DD/YY o MM/DD/YYYY (formato US usado en IDRALL)
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0]) - 1; // Mes es el primer valor
      const day = parseInt(parts[1]);       // Día es el segundo valor
      let year = parseInt(parts[2]);

      // Convertir año de 2 dígitos
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }

      // Usar UTC para evitar problemas de timezone
      const date = new Date(Date.UTC(year, month, day));
      if (rowNum && rowNum <= 7) {
        console.log(`📅 [IDRALL Parser] Fila ${rowNum}: Fecha string "${dateStr}" (MM/DD/YY) → ${date.toISOString()} → mes=${date.getUTCMonth() + 1}, año=${date.getUTCFullYear()}`);
      }
      return isNaN(date.getTime()) ? null : date;
    }

    // Intentar parseo genérico
    const date = new Date(dateStr);
    if (rowNum && rowNum <= 7) {
      console.log(`📅 [IDRALL Parser] Fila ${rowNum}: Fecha genérica "${dateStr}" → ${date.toISOString()}`);
    }
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Calcula el número de semana del año para una fecha (usando UTC)
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Parsea el campo MID/Folio que viene en formato "101441 / 45"
 */
function parseFolio(value: any): { folio: string; numero: number | null; secuencia: number | null } {
  if (!value) {
    return { folio: '', numero: null, secuencia: null };
  }

  const str = value.toString().trim();

  // Intentar extraer número y secuencia del formato "101441 / 45"
  const match = str.match(/(\d+)\s*\/\s*(\d+)/);
  if (match) {
    return {
      folio: str,
      numero: parseInt(match[1]),
      secuencia: parseInt(match[2])
    };
  }

  return { folio: str, numero: null, secuencia: null };
}

/**
 * Parsea el status de la transacción
 */
function parseStatus(value: any): 'ACTIVO' | 'CANCELADO' {
  if (!value) return 'ACTIVO';

  const str = value.toString().toUpperCase().trim();

  if (str.includes('CANCELADO') || str.includes('CANCEL')) {
    return 'CANCELADO';
  }

  return 'ACTIVO';
}

/**
 * Obtiene el valor de una celda de forma segura
 */
function getCellValue(row: Row, colIndex: number): any {
  try {
    const cell = row.getCell(colIndex);
    if (!cell) return null;

    // Manejar celdas con fórmulas
    if (cell.formula) {
      return cell.result ?? cell.value;
    }

    return cell.value;
  } catch {
    return null;
  }
}

/**
 * Detecta automáticamente en qué fila están los headers
 */
function findHeaderRow(worksheet: Worksheet): number {
  const headerKeywords = ['folio', 'status', 'fecha', 'cliente', 'producto', 'cantidad', 'mid'];

  for (let rowNum = 1; rowNum <= 10; rowNum++) {
    const row = worksheet.getRow(rowNum);
    let matchCount = 0;

    for (let col = 1; col <= 20; col++) {
      const value = getCellValue(row, col);
      if (value) {
        const cellText = value.toString().toLowerCase();
        for (const keyword of headerKeywords) {
          if (cellText.includes(keyword)) {
            matchCount++;
            break;
          }
        }
      }
    }

    // Si encontramos al menos 3 keywords, es probablemente el header
    if (matchCount >= 3) {
      return rowNum;
    }
  }

  // Default: header en fila 1
  return 1;
}

/**
 * Función principal: parsear Excel de IDRALL
 */
export async function parseExcelIDRALL(workbook: Workbook): Promise<IDRALLParseResult> {
  console.log('📊 [IDRALL Parser] Iniciando parseo de archivo...');

  const transacciones: IDRALLTransaction[] = [];
  const errores: IDRALLParseResult['errores'] = [];
  const clientesSet = new Set<string>();
  const productosSet = new Set<string>();
  let registrosInvalidos = 0;
  let registrosCancelados = 0;
  let fechaMin: Date | null = null;
  let fechaMax: Date | null = null;

  // Obtener la primera hoja (o la única)
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    console.error('❌ [IDRALL Parser] No se encontró ninguna hoja en el archivo');
    return {
      transacciones: [],
      resumen: {
        totalRegistros: 0,
        registrosActivos: 0,
        registrosCancelados: 0,
        registrosInvalidos: 0,
        clientesUnicos: 0,
        productosUnicos: 0,
        rangoFechas: { desde: null, hasta: null }
      },
      errores: [{ fila: 0, error: 'No se encontró ninguna hoja en el archivo' }]
    };
  }

  console.log(`📄 [IDRALL Parser] Procesando hoja: "${worksheet.name}"`);
  console.log(`📄 [IDRALL Parser] Total de filas: ${worksheet.rowCount}`);

  // Detectar fila de headers
  const headerRow = findHeaderRow(worksheet);
  console.log(`📄 [IDRALL Parser] Header detectado en fila: ${headerRow}`);

  // Procesar cada fila después del header
  worksheet.eachRow((row, rowNumber) => {
    // Saltar filas de header
    if (rowNumber <= headerRow) return;

    try {
      // Columnas según estructura IDRALL:
      // A(1): MID / Folio
      // B(2): Status / com
      // C(3): Fecha
      // D(4): Cliente
      // E(5): Producto
      // F(6): Cantidad
      // G(7): Tipo de cambio
      // H(8): Precio Unitario
      // I(9): Importe
      // J(10): Lote
      // K(11): Tipo de cambio (costo)
      // L(12): Costo unitario
      // M(13): Ut./Perdida
      // N(14): Utilidad/Pe Gastos
      // O(15): Utilidad aprc % UT

      const folioData = parseFolio(getCellValue(row, 1));
      const status = parseStatus(getCellValue(row, 2));
      const rawFecha = getCellValue(row, 3);
      const fecha = parseDate(rawFecha, rowNumber);
      const cliente = getCellValue(row, 4)?.toString().trim() || '';

      // Debug logging para las primeras 10 filas
      if (rowNumber <= 12) {
        console.log(`🔍 [IDRALL Parser] Fila ${rowNumber}: rawFecha=${JSON.stringify(rawFecha)}, tipo=${typeof rawFecha}, fecha=${fecha?.toISOString() || 'NULL'}, cliente=${cliente?.substring(0, 20)}`);
      }
      const producto = getCellValue(row, 5)?.toString().trim() || '';
      const cantidad = parseNumber(getCellValue(row, 6));
      const tipoCambio = parseNumber(getCellValue(row, 7));
      const precioUnitario = parseNumber(getCellValue(row, 8));
      const importe = parseNumber(getCellValue(row, 9));
      const lote = getCellValue(row, 10)?.toString().trim() || null;
      const tipoCambioCosto = parseNumber(getCellValue(row, 11));
      const costoUnitario = parseNumber(getCellValue(row, 12));
      const utilidadPerdida = parseNumber(getCellValue(row, 13));
      const utilidadConGastos = parseNumber(getCellValue(row, 14));
      const utilidadPorcentaje = parseNumber(getCellValue(row, 15));

      // Validaciones mínimas: debe tener cliente y producto
      if (!cliente || !producto) {
        // Fila vacía o sin datos principales, ignorar silenciosamente
        if (!cliente && !producto && !folioData.folio) {
          return; // Fila completamente vacía
        }

        registrosInvalidos++;
        errores.push({
          fila: rowNumber,
          error: 'Falta cliente o producto',
          datos: { folio: folioData.folio, cliente, producto }
        });
        return;
      }

      // Validar fecha
      if (!fecha) {
        registrosInvalidos++;
        errores.push({
          fila: rowNumber,
          error: 'Fecha inválida',
          datos: { folio: folioData.folio, cliente, fechaOriginal: getCellValue(row, 3) }
        });
        return;
      }

      // Cantidad es requerida y debe ser > 0 para registros activos
      if (cantidad === null || (status === 'ACTIVO' && cantidad <= 0)) {
        registrosInvalidos++;
        errores.push({
          fila: rowNumber,
          error: 'Cantidad inválida',
          datos: { folio: folioData.folio, cliente, cantidad }
        });
        return;
      }

      // Tracking de estadísticas
      clientesSet.add(cliente);
      productosSet.add(producto);

      if (status === 'CANCELADO') {
        registrosCancelados++;
      }

      // Tracking de rango de fechas
      if (!fechaMin || fecha < fechaMin) fechaMin = fecha;
      if (!fechaMax || fecha > fechaMax) fechaMax = fecha;

      // Crear registro
      // Usar métodos UTC para evitar problemas de timezone
      const transaccion: IDRALLTransaction = {
        folio: folioData.folio,
        folioNumero: folioData.numero,
        folioSecuencia: folioData.secuencia,
        status,
        fecha,
        año: fecha.getUTCFullYear(),
        mes: fecha.getUTCMonth() + 1,
        semana: getWeekNumber(fecha),
        cliente,
        producto,
        lote,
        cantidad: cantidad || 0,
        tipoCambio,
        precioUnitario,
        importe,
        tipoCambioCosto,
        costoUnitario,
        utilidadPerdida,
        utilidadConGastos,
        utilidadPorcentaje
      };

      transacciones.push(transaccion);

    } catch (error) {
      registrosInvalidos++;
      errores.push({
        fila: rowNumber,
        error: `Error procesando fila: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
    }
  });

  // Resumen final
  const result: IDRALLParseResult = {
    transacciones,
    resumen: {
      totalRegistros: transacciones.length,
      registrosActivos: transacciones.length - registrosCancelados,
      registrosCancelados,
      registrosInvalidos,
      clientesUnicos: clientesSet.size,
      productosUnicos: productosSet.size,
      rangoFechas: {
        desde: fechaMin,
        hasta: fechaMax
      }
    },
    errores: errores.slice(0, 100) // Limitar a primeros 100 errores
  };

  console.log(`✅ [IDRALL Parser] Parseo completado:`);
  console.log(`   - Total transacciones: ${result.resumen.totalRegistros}`);
  console.log(`   - Activos: ${result.resumen.registrosActivos}`);
  console.log(`   - Cancelados: ${result.resumen.registrosCancelados}`);
  console.log(`   - Inválidos: ${result.resumen.registrosInvalidos}`);
  console.log(`   - Clientes únicos: ${result.resumen.clientesUnicos}`);
  console.log(`   - Productos únicos: ${result.resumen.productosUnicos}`);
  if (result.resumen.rangoFechas.desde && result.resumen.rangoFechas.hasta) {
    console.log(`   - Rango: ${result.resumen.rangoFechas.desde.toLocaleDateString()} - ${result.resumen.rangoFechas.hasta.toLocaleDateString()}`);
  }

  return result;
}

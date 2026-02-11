/**
 * Parser mejorado para archivos Excel de ventas
 * Soporta 4 hojas: VENTAS (DI), RESUMEN DI, VENTAS GO, RESUMEN GO
 */

import type { Workbook, Worksheet } from 'exceljs';

export interface ParsedSalesData {
  di: {
    transacciones: SalesTransaction[];
    resumen: SalesResumen[];
  };
  go: {
    transacciones: SalesTransaction[];
    resumen: SalesResumen[];
  };
}

export interface SalesTransaction {
  fecha: Date;
  folio: string | null;
  cliente: string;
  producto: string;
  cantidad: number;
  precioUnitario: number | null;
  importe: number | null;
  año: number;
  mes: number;
  submodulo: 'DI' | 'GO';
  // Campos adicionales para GO
  tipoCambio?: number | null;
  importeMN?: number | null;
  familiaProducto?: string | null;
}

export interface SalesResumen {
  cliente: string;
  activo?: boolean; // Solo DI tiene este campo
  kilos2024: number;
  kilos2025: number;
  diferencial: number;
  usd2025?: number | null;
  utilidad?: number | null; // Porcentaje - solo DI
  accion: string | null;
  responsable: string | null;
  submodulo: 'DI' | 'GO';
}

/**
 * Función auxiliar para parsear números del Excel
 */
function parseNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remover comas, puntos (si son separadores de miles) y espacios
    // Ejemplo: "1.524.00" -> 1524.00, "$1,216.05" -> 1216.05
    let cleaned = value.replace(/[$,\s]/g, '').trim();
    // Manejar puntos como separadores de miles (formato español)
    if (cleaned.match(/^\d+\.\d+\.\d+/)) {
      // Formato: 1.524.00 -> 1524.00
      cleaned = cleaned.replace(/\./g, '');
    }
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Función auxiliar para parsear fechas del Excel (usando UTC para evitar problemas de timezone)
 */
function parseDate(value: any): Date {
  if (value instanceof Date) {
    return value;
  } else if (typeof value === 'number') {
    // Excel serial date (días desde 1899-12-30) - usar UTC
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86400000);
  } else if (typeof value === 'string') {
    // Intentar parsear formato MM/DD/YY o MM/DD/YYYY (formato US)
    const dateStr = value.trim();
    const dateParts = dateStr.split('/');
    if (dateParts.length === 3) {
      const month = parseInt(dateParts[0]) - 1; // Mes es el primer valor (0-indexed)
      const day = parseInt(dateParts[1]);       // Día es el segundo valor
      let year = parseInt(dateParts[2]);
      // Si el año es de 2 dígitos, asumir 2000-2099
      if (year < 100) {
        year = year < 50 ? 2000 + year : 1900 + year;
      }
      // Usar UTC para evitar problemas de timezone
      return new Date(Date.UTC(year, month, day));
    } else {
      return new Date(dateStr);
    }
  }
  // Default a fecha actual si no se puede parsear
  return new Date();
}

/**
 * Parsear hoja "VENTAS " (DI transacciones) - OJO: tiene espacio al final
 */
function parseVentasDI(workbook: Workbook): SalesTransaction[] {
  const sheetName = 'VENTAS '; // Con espacio al final
  const worksheet = workbook.getWorksheet(sheetName) || workbook.getWorksheet('VENTAS');

  if (!worksheet) {
    console.log(`⚠️ Hoja "${sheetName}" no encontrada, saltando...`);
    return [];
  }

  console.log(`📄 Procesando hoja: "${worksheet.name}"`);
  const transacciones: SalesTransaction[] = [];

  // Asumir que la fila 1 es el header
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const fecha = parseDate(row.getCell(1).value);
    const folio = row.getCell(2).value?.toString().trim() || null;
    const cliente = row.getCell(3).value?.toString().trim();
    const producto = row.getCell(4).value?.toString().trim();
    const cantidad = parseNumber(row.getCell(5).value);
    const precioUnitario = parseNumber(row.getCell(6).value);
    const importe = parseNumber(row.getCell(7).value);
    const año = parseInt(row.getCell(8).value?.toString() || '') || fecha.getUTCFullYear();
    const mes = parseInt(row.getCell(9).value?.toString() || '') || (fecha.getUTCMonth() + 1);

    // Validar campos requeridos
    if (!cliente || !producto || !cantidad || cantidad <= 0) {
      return; // Skip fila inválida
    }

    transacciones.push({
      fecha,
      folio,
      cliente,
      producto,
      cantidad,
      precioUnitario,
      importe,
      año,
      mes,
      submodulo: 'DI'
    });
  });

  console.log(`✅ ${transacciones.length} transacciones DI procesadas`);
  return transacciones;
}

/**
 * Parsear hoja "RESUMEN DI" (KPIs y acciones por cliente)
 */
function parseResumenDI(workbook: Workbook): SalesResumen[] {
  const sheetName = 'RESUMEN DI';
  const worksheet = workbook.getWorksheet(sheetName);

  if (!worksheet) {
    console.log(`⚠️ Hoja "${sheetName}" no encontrada, saltando...`);
    return [];
  }

  console.log(`📄 Procesando hoja: "${worksheet.name}"`);
  const resumen: SalesResumen[] = [];

  // Headers en fila 6 (índice 1-based en ExcelJS)
  const headerRowIndex = 6;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return; // Skip headers

    // Columnas según el documento:
    // C = Clientes
    // D = Activos (0 o 1)
    // F = Kilos Totales 2024
    // I = Kilos Totales 2025
    // J = Diferencial
    // M = USD totales 2025
    // N = % UTILIDAD
    // S = Acciones
    // T = Responsable

    const cliente = row.getCell(3).value?.toString().trim(); // Columna C
    if (!cliente) return; // Skip si no hay cliente

    const activo = row.getCell(4).value === 1; // Columna D
    const kilos2024 = parseNumber(row.getCell(6).value) || 0; // Columna F
    const kilos2025 = parseNumber(row.getCell(9).value) || 0; // Columna I
    const diferencial = parseNumber(row.getCell(10).value) || 0; // Columna J
    const usd2025 = parseNumber(row.getCell(13).value); // Columna M
    const utilidad = parseNumber(row.getCell(14).value); // Columna N (porcentaje)
    const accion = row.getCell(19).value?.toString().trim() || null; // Columna S
    const responsable = row.getCell(20).value?.toString().trim() || null; // Columna T

    resumen.push({
      cliente,
      activo,
      kilos2024,
      kilos2025,
      diferencial,
      usd2025,
      utilidad,
      accion,
      responsable,
      submodulo: 'DI'
    });
  });

  console.log(`✅ ${resumen.length} registros de resumen DI procesados`);
  return resumen;
}

/**
 * Parsear hoja "VENTAS GO" (GO transacciones)
 */
function parseVentasGO(workbook: Workbook): SalesTransaction[] {
  const sheetName = 'VENTAS GO';
  const worksheet = workbook.getWorksheet(sheetName);

  if (!worksheet) {
    console.log(`⚠️ Hoja "${sheetName}" no encontrada, saltando...`);
    return [];
  }

  console.log(`📄 Procesando hoja: "${worksheet.name}"`);
  const transacciones: SalesTransaction[] = [];

  // Asumir que la fila 1 es el header
  // Columnas: Factura, Fecha, Cliente, Producto, FAMILIA DEL PRODUCTO, Cantidad, USD, TIPO DE CAMBIO, IMPORTE M.N.
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const folio = row.getCell(1).value?.toString().trim() || null; // Factura
    const fecha = parseDate(row.getCell(2).value); // Fecha
    const cliente = row.getCell(3).value?.toString().trim(); // Cliente (minúscula en GO)
    const producto = row.getCell(4).value?.toString().trim(); // Producto
    const familiaProducto = row.getCell(5).value?.toString().trim() || null; // FAMILIA DEL PRODUCTO
    const cantidad = parseNumber(row.getCell(6).value); // Cantidad
    const importe = parseNumber(row.getCell(7).value); // USD
    const tipoCambio = parseNumber(row.getCell(8).value); // TIPO DE CAMBIO
    const importeMN = parseNumber(row.getCell(9).value); // IMPORTE M.N.

    // Validar campos requeridos
    if (!cliente || !producto || !cantidad || cantidad <= 0) {
      return; // Skip fila inválida
    }

    const año = fecha.getUTCFullYear();
    const mes = fecha.getUTCMonth() + 1;

    transacciones.push({
      fecha,
      folio,
      cliente,
      producto,
      cantidad,
      precioUnitario: null, // GO no tiene precio unitario en columna separada
      importe,
      año,
      mes,
      submodulo: 'GO',
      tipoCambio,
      importeMN,
      familiaProducto
    });
  });

  console.log(`✅ ${transacciones.length} transacciones GO procesadas`);
  return transacciones;
}

/**
 * Parsear hoja "RESUMEN GO" (KPIs y acciones por cliente)
 */
function parseResumenGO(workbook: Workbook): SalesResumen[] {
  const sheetName = 'RESUMEN GO';
  const worksheet = workbook.getWorksheet(sheetName);

  if (!worksheet) {
    console.log(`⚠️ Hoja "${sheetName}" no encontrada, saltando...`);
    return [];
  }

  console.log(`📄 Procesando hoja: "${worksheet.name}"`);
  const resumen: SalesResumen[] = [];

  // Headers en fila 6 (igual que DI)
  const headerRowIndex = 6;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIndex) return; // Skip headers

    // Columnas para GO (diferente a DI):
    // C = Clientes
    // NO tiene Activos
    // F = Kilos Totales 2024
    // I = Kilos Totales 2025
    // J = Diferencial
    // Accion (no "Acciones") - necesitamos identificar la columna
    // Responsable

    const cliente = row.getCell(3).value?.toString().trim(); // Columna C
    if (!cliente) return; // Skip si no hay cliente

    const kilos2024 = parseNumber(row.getCell(6).value) || 0; // Columna F (asumir igual)
    const kilos2025 = parseNumber(row.getCell(9).value) || 0; // Columna I (asumir igual)
    const diferencial = parseNumber(row.getCell(10).value) || 0; // Columna J (asumir igual)

    // GO no tiene USD ni Utilidad en las mismas columnas
    // Buscar "Accion" y "Responsable" - asumir mismas columnas S y T por ahora
    const accion = row.getCell(19).value?.toString().trim() || null; // Columna S (ajustar si es necesaria)
    const responsable = row.getCell(20).value?.toString().trim() || null; // Columna T (ajustar si es necesaria)

    resumen.push({
      cliente,
      // GO no tiene campo activo
      kilos2024,
      kilos2025,
      diferencial,
      accion,
      responsable,
      submodulo: 'GO'
    });
  });

  console.log(`✅ ${resumen.length} registros de resumen GO procesados`);
  return resumen;
}

/**
 * Función principal: parsear todas las hojas del workbook
 */
export async function parseExcelVentas(workbook: Workbook): Promise<ParsedSalesData> {
  console.log('📊 [Excel Parser] Iniciando parseo de 4 hojas...');

  const result: ParsedSalesData = {
    di: {
      transacciones: parseVentasDI(workbook),
      resumen: parseResumenDI(workbook)
    },
    go: {
      transacciones: parseVentasGO(workbook),
      resumen: parseResumenGO(workbook)
    }
  };

  const totalTransacciones = result.di.transacciones.length + result.go.transacciones.length;
  const totalResumen = result.di.resumen.length + result.go.resumen.length;

  console.log(`✅ [Excel Parser] Parseo completado:`);
  console.log(`   - Transacciones DI: ${result.di.transacciones.length}`);
  console.log(`   - Transacciones GO: ${result.go.transacciones.length}`);
  console.log(`   - Resumen DI: ${result.di.resumen.length}`);
  console.log(`   - Resumen GO: ${result.go.resumen.length}`);
  console.log(`   - TOTAL: ${totalTransacciones} transacciones, ${totalResumen} registros de resumen`);

  return result;
}

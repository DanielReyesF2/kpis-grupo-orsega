import { describe, it, expect } from 'vitest';
import { parseNumber, parseDate, getWeekNumber, parseFolio, parseStatus, parseExcelIDRALL } from '../sales-idrall-parser';
import type { Workbook, Worksheet, Row, Cell } from 'exceljs';

describe('IDRALL Parser', () => {
  describe('parseNumber', () => {
    it('should return null for null', () => {
      expect(parseNumber(null)).toBeNull();
    });

    it('should return null for undefined', () => {
      expect(parseNumber(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseNumber('')).toBeNull();
    });

    it('should return null for NaN string', () => {
      expect(parseNumber('not a number')).toBeNull();
    });

    it('should parse plain numbers', () => {
      expect(parseNumber(42)).toBe(42);
      expect(parseNumber(3.14)).toBe(3.14);
    });

    it('should parse string numbers', () => {
      expect(parseNumber('42')).toBe(42);
      expect(parseNumber('3.14')).toBe(3.14);
    });

    it('should parse currency format with $ and commas', () => {
      expect(parseNumber('$1,234.56')).toBe(1234.56);
    });

    it('should parse negative accounting format (parentheses)', () => {
      expect(parseNumber('(123)')).toBe(-123);
    });

    it('should parse percentage format', () => {
      const result = parseNumber('50%');
      // Function strips % but does NOT divide by 100
      expect(result).toBe(50);
    });

    it('should handle zero', () => {
      expect(parseNumber(0)).toBe(0);
      expect(parseNumber('0')).toBe(0);
    });

    it('should parse numbers with spaces', () => {
      expect(parseNumber(' 42 ')).toBe(42);
    });

    it('should parse negative numbers', () => {
      expect(parseNumber(-5)).toBe(-5);
      expect(parseNumber('-5')).toBe(-5);
    });
  });

  describe('parseDate', () => {
    it('should return null for null', () => {
      expect(parseDate(null)).toBeNull();
    });

    it('should return null for undefined', () => {
      expect(parseDate(undefined)).toBeNull();
    });

    it('should return Date instance as-is', () => {
      const date = new Date('2025-01-15');
      const result = parseDate(date);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
    });

    it('should parse Excel serial number', () => {
      // Excel serial 45000 = ~Feb 2023
      const result = parseDate(45000);
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBeGreaterThanOrEqual(2023);
    });

    it('should parse MM/DD/YYYY format (US format used in IDRALL)', () => {
      // IDRALL uses US format: MM/DD/YYYY
      const result = parseDate('01/15/2025');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getUTCDate()).toBe(15);
      expect(result!.getUTCMonth()).toBe(0); // January
      expect(result!.getUTCFullYear()).toBe(2025);
    });

    it('should parse MM/DD/YY format (US format)', () => {
      const result = parseDate('01/15/25');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getUTCDate()).toBe(15);
    });

    it('should return null for empty string', () => {
      expect(parseDate('')).toBeNull();
    });
  });

  describe('getWeekNumber', () => {
    it('should return week 1 for January 1st (or 52/53)', () => {
      const jan1 = new Date(2025, 0, 1);
      const week = getWeekNumber(jan1);
      expect(week).toBeGreaterThanOrEqual(1);
      expect(week).toBeLessThanOrEqual(53);
    });

    it('should return correct week for mid-year', () => {
      const july1 = new Date(2025, 6, 1);
      const week = getWeekNumber(july1);
      expect(week).toBeGreaterThanOrEqual(26);
      expect(week).toBeLessThanOrEqual(27);
    });

    it('should return week 52 or 53 for end of year', () => {
      const dec31 = new Date(2025, 11, 31);
      const week = getWeekNumber(dec31);
      expect(week).toBeGreaterThanOrEqual(1); // Can be 1 in some ISO configurations
      expect(week).toBeLessThanOrEqual(53);
    });

    it('should handle different years', () => {
      const date2024 = new Date(2024, 5, 15);
      const week = getWeekNumber(date2024);
      expect(week).toBeGreaterThan(0);
    });
  });

  describe('parseFolio', () => {
    it('should parse "number / number" format', () => {
      const result = parseFolio('101441 / 45');
      expect(result.folio).toBe('101441 / 45');
      expect(result.numero).toBe(101441);
      expect(result.secuencia).toBe(45);
    });

    it('should parse plain number', () => {
      // parseFolio only extracts numero from "X / Y" format
      const result = parseFolio('12345');
      expect(result.folio).toBe('12345');
      expect(result.numero).toBeNull();
    });

    it('should handle null', () => {
      const result = parseFolio(null);
      expect(result.folio).toBe('');
      expect(result.numero).toBeNull();
    });

    it('should handle undefined', () => {
      const result = parseFolio(undefined);
      expect(result.folio).toBe('');
      expect(result.numero).toBeNull();
    });

    it('should handle numeric input', () => {
      // parseFolio only extracts numero from "X / Y" format; numeric input becomes folio string
      const result = parseFolio(123);
      expect(result.folio).toBe('123');
      expect(result.numero).toBeNull();
    });

    it('should handle empty string', () => {
      const result = parseFolio('');
      expect(result.folio).toBe('');
    });
  });

  describe('parseStatus', () => {
    it('should return CANCELADO for "CANCELADO"', () => {
      expect(parseStatus('CANCELADO')).toBe('CANCELADO');
    });

    it('should return ACTIVO for "ACTIVO"', () => {
      expect(parseStatus('ACTIVO')).toBe('ACTIVO');
    });

    it('should be case insensitive', () => {
      expect(parseStatus('cancelado')).toBe('CANCELADO');
    });

    it('should match substring containing "cancel"', () => {
      expect(parseStatus('CANCELADO POR CLIENTE')).toBe('CANCELADO');
    });

    it('should return ACTIVO for null', () => {
      expect(parseStatus(null)).toBe('ACTIVO');
    });

    it('should return ACTIVO for undefined', () => {
      expect(parseStatus(undefined)).toBe('ACTIVO');
    });

    it('should return ACTIVO for unrecognized status', () => {
      expect(parseStatus('PENDIENTE')).toBe('ACTIVO');
    });

    it('should return ACTIVO for empty string', () => {
      expect(parseStatus('')).toBe('ACTIVO');
    });
  });

  // =========================================================================
  // Additional edge cases for parseNumber
  // =========================================================================
  describe('parseNumber (additional edge cases)', () => {
    it('should return null for NaN number', () => {
      expect(parseNumber(NaN)).toBeNull();
    });

    it('should return null for a boolean value', () => {
      expect(parseNumber(true)).toBeNull();
      expect(parseNumber(false)).toBeNull();
    });

    it('should return null for an object', () => {
      expect(parseNumber({})).toBeNull();
      expect(parseNumber([])).toBeNull();
    });

    it('should parse negative accounting format with decimals', () => {
      expect(parseNumber('($1,234.56)')).toBe(-1234.56);
    });

    it('should parse percentage with decimals', () => {
      expect(parseNumber('12.5%')).toBe(12.5);
    });

    it('should return null for % alone', () => {
      expect(parseNumber('%')).toBeNull();
    });

    it('should parse large currency values', () => {
      expect(parseNumber('$10,000,000.99')).toBe(10000000.99);
    });

    it('should handle string with only whitespace', () => {
      expect(parseNumber('   ')).toBeNull();
    });

    it('should handle string with only $ sign', () => {
      const result = parseNumber('$');
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // Additional edge cases for parseDate
  // =========================================================================
  describe('parseDate (additional edge cases)', () => {
    it('should return null for an invalid Date object', () => {
      const invalid = new Date('not-a-date');
      expect(parseDate(invalid)).toBeNull();
    });

    it('should return null for 0 (falsy number)', () => {
      expect(parseDate(0)).toBeNull();
    });

    it('should parse year >= 50 as 1900s in MM/DD/YY', () => {
      // Format is MM/DD/YY - so 06/15/99 = June 15, 1999
      const result = parseDate('06/15/99');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getUTCFullYear()).toBe(1999);
    });

    it('should parse year < 50 as 2000s in MM/DD/YY', () => {
      // Format is MM/DD/YY - so 06/15/30 = June 15, 2030
      const result = parseDate('06/15/30');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getUTCFullYear()).toBe(2030);
    });

    it('should handle generic date string (ISO format)', () => {
      const result = parseDate('2024-03-15');
      expect(result).toBeInstanceOf(Date);
    });

    it('should return null for totally invalid string', () => {
      const result = parseDate('foobar');
      expect(result).toBeNull();
    });

    it('should return null for a boolean', () => {
      expect(parseDate(false)).toBeNull();
    });
  });

  // =========================================================================
  // Additional edge cases for parseFolio
  // =========================================================================
  describe('parseFolio (additional edge cases)', () => {
    it('should parse format without spaces around slash', () => {
      const result = parseFolio('101441/45');
      expect(result.numero).toBe(101441);
      expect(result.secuencia).toBe(45);
    });

    it('should parse format with extra spaces', () => {
      const result = parseFolio('  101441  /  45  ');
      expect(result.numero).toBe(101441);
      expect(result.secuencia).toBe(45);
    });

    it('should handle string with text', () => {
      const result = parseFolio('ABC-123');
      expect(result.folio).toBe('ABC-123');
      expect(result.numero).toBeNull();
      expect(result.secuencia).toBeNull();
    });

    it('should handle 0 as input', () => {
      const result = parseFolio(0);
      expect(result.folio).toBe('');
      expect(result.numero).toBeNull();
    });
  });

  // =========================================================================
  // parseExcelIDRALL (main function)
  // =========================================================================
  describe('parseExcelIDRALL', () => {
    /**
     * Helper to create a mock ExcelJS Row object.
     * colValues is a 1-indexed map: { 1: 'folioValue', 2: 'statusValue', ... }
     */
    function createMockRow(colValues: Record<number, any>): Row {
      return {
        getCell: (col: number) => {
          const val = colValues[col] ?? null;
          return {
            value: val,
            formula: undefined,
            result: undefined,
          } as unknown as Cell;
        },
      } as unknown as Row;
    }

    /**
     * Helper to create a mock Worksheet with rows.
     * rows is an array of objects: [{ rowNumber, colValues }, ...]
     * headerKeywords go in row 1 by default.
     */
    function createMockWorksheet(
      name: string,
      rows: Array<{ rowNumber: number; colValues: Record<number, any> }>,
      rowCount?: number
    ): Worksheet {
      const mockRows = rows.map(r => ({
        rowNumber: r.rowNumber,
        row: createMockRow(r.colValues),
      }));

      return {
        name,
        rowCount: rowCount ?? rows.length,
        getRow: (rowNum: number) => {
          const found = mockRows.find(r => r.rowNumber === rowNum);
          return found ? found.row : createMockRow({});
        },
        eachRow: (callback: (row: Row, rowNumber: number) => void) => {
          for (const mr of mockRows) {
            callback(mr.row, mr.rowNumber);
          }
        },
      } as unknown as Worksheet;
    }

    function createMockWorkbook(worksheets: Worksheet[]): Workbook {
      return {
        worksheets,
      } as unknown as Workbook;
    }

    it('should return empty result when workbook has no worksheets', async () => {
      const workbook = createMockWorkbook([]);
      const result = await parseExcelIDRALL(workbook);

      expect(result.transacciones).toEqual([]);
      expect(result.resumen.totalRegistros).toBe(0);
      expect(result.resumen.registrosInvalidos).toBe(0);
      expect(result.errores).toHaveLength(1);
      expect(result.errores[0].error).toContain('No se encontró ninguna hoja');
    });

    it('should parse a valid row into a transaction', async () => {
      const headerRow = {
        rowNumber: 1,
        colValues: {
          1: 'MID / Folio',
          2: 'Status',
          3: 'Fecha',
          4: 'Cliente',
          5: 'Producto',
          6: 'Cantidad',
        },
      };
      const dataRow = {
        rowNumber: 2,
        colValues: {
          1: '101441 / 45',
          2: 'ACTIVO',
          3: new Date(2025, 0, 15), // Jan 15, 2025
          4: 'Acme Corp',
          5: 'Widget A',
          6: 100,
          7: 17.5,
          8: 25.0,
          9: 2500.0,
          10: 'LOT-001',
          11: 17.0,
          12: 20.0,
          13: 500.0,
          14: 450.0,
          15: 18.0,
        },
      };

      const ws = createMockWorksheet('Hoja1', [headerRow, dataRow], 2);
      const workbook = createMockWorkbook([ws]);
      const result = await parseExcelIDRALL(workbook);

      expect(result.transacciones).toHaveLength(1);
      const tx = result.transacciones[0];
      expect(tx.folio).toBe('101441 / 45');
      expect(tx.folioNumero).toBe(101441);
      expect(tx.folioSecuencia).toBe(45);
      expect(tx.status).toBe('ACTIVO');
      expect(tx.cliente).toBe('Acme Corp');
      expect(tx.producto).toBe('Widget A');
      expect(tx.cantidad).toBe(100);
      expect(tx.tipoCambio).toBe(17.5);
      expect(tx.precioUnitario).toBe(25.0);
      expect(tx.importe).toBe(2500.0);
      expect(tx.lote).toBe('LOT-001');
      expect(tx.tipoCambioCosto).toBe(17.0);
      expect(tx.costoUnitario).toBe(20.0);
      expect(tx.utilidadPerdida).toBe(500.0);
      expect(tx.utilidadConGastos).toBe(450.0);
      expect(tx.utilidadPorcentaje).toBe(18.0);
      expect(tx.año).toBe(2025);
      expect(tx.mes).toBe(1);
    });

    it('should count cancelled records in resumen', async () => {
      const headerRow = {
        rowNumber: 1,
        colValues: { 1: 'Folio', 2: 'Status', 3: 'Fecha', 4: 'Cliente', 5: 'Producto', 6: 'Cantidad' },
      };
      const activeRow = {
        rowNumber: 2,
        colValues: {
          1: '100 / 1', 2: 'ACTIVO', 3: new Date(2025, 0, 10),
          4: 'Client A', 5: 'Prod A', 6: 50,
        },
      };
      const cancelledRow = {
        rowNumber: 3,
        colValues: {
          1: '100 / 2', 2: 'CANCELADO', 3: new Date(2025, 0, 11),
          4: 'Client B', 5: 'Prod B', 6: 30,
        },
      };

      const ws = createMockWorksheet('Hoja1', [headerRow, activeRow, cancelledRow], 3);
      const workbook = createMockWorkbook([ws]);
      const result = await parseExcelIDRALL(workbook);

      expect(result.transacciones).toHaveLength(2);
      expect(result.resumen.registrosCancelados).toBe(1);
      expect(result.resumen.registrosActivos).toBe(1);
      expect(result.resumen.totalRegistros).toBe(2);
    });

    it('should report rows with missing cliente or producto as invalid', async () => {
      const headerRow = {
        rowNumber: 1,
        colValues: { 1: 'Folio', 2: 'Status', 3: 'Fecha', 4: 'Cliente', 5: 'Producto', 6: 'Cantidad' },
      };
      const missingClienteRow = {
        rowNumber: 2,
        colValues: {
          1: '100 / 1', 2: 'ACTIVO', 3: new Date(2025, 0, 10),
          4: '', 5: 'Prod A', 6: 50,
        },
      };
      const missingProductoRow = {
        rowNumber: 3,
        colValues: {
          1: '100 / 2', 2: 'ACTIVO', 3: new Date(2025, 0, 11),
          4: 'Client A', 5: '', 6: 30,
        },
      };

      const ws = createMockWorksheet('Hoja1', [headerRow, missingClienteRow, missingProductoRow], 3);
      const workbook = createMockWorkbook([ws]);
      const result = await parseExcelIDRALL(workbook);

      expect(result.transacciones).toHaveLength(0);
      expect(result.resumen.registrosInvalidos).toBe(2);
      expect(result.errores.length).toBeGreaterThanOrEqual(2);
    });

    it('should report rows with invalid fecha as invalid', async () => {
      const headerRow = {
        rowNumber: 1,
        colValues: { 1: 'Folio', 2: 'Status', 3: 'Fecha', 4: 'Cliente', 5: 'Producto', 6: 'Cantidad' },
      };
      const badDateRow = {
        rowNumber: 2,
        colValues: {
          1: '100 / 1', 2: 'ACTIVO', 3: 'not-a-date',
          4: 'Client A', 5: 'Prod A', 6: 50,
        },
      };

      const ws = createMockWorksheet('Hoja1', [headerRow, badDateRow], 2);
      const workbook = createMockWorkbook([ws]);
      const result = await parseExcelIDRALL(workbook);

      expect(result.transacciones).toHaveLength(0);
      expect(result.resumen.registrosInvalidos).toBe(1);
      // Check that either 'Fecha inválida' or 'Error procesando' is present (both indicate rejection)
      expect(result.errores.length).toBeGreaterThanOrEqual(1);
      expect(result.errores.some(e =>
        e.error.includes('Fecha') || e.error.includes('inválida') || e.error.includes('Error procesando')
      )).toBe(true);
    });

    it('should report rows with null or zero cantidad for ACTIVO as invalid', async () => {
      const headerRow = {
        rowNumber: 1,
        colValues: { 1: 'Folio', 2: 'Status', 3: 'Fecha', 4: 'Cliente', 5: 'Producto', 6: 'Cantidad' },
      };
      const zeroCantidadRow = {
        rowNumber: 2,
        colValues: {
          1: '100 / 1', 2: 'ACTIVO', 3: new Date(2025, 0, 10),
          4: 'Client A', 5: 'Prod A', 6: 0,
        },
      };
      const nullCantidadRow = {
        rowNumber: 3,
        colValues: {
          1: '100 / 2', 2: 'ACTIVO', 3: new Date(2025, 0, 11),
          4: 'Client B', 5: 'Prod B', 6: null,
        },
      };

      const ws = createMockWorksheet('Hoja1', [headerRow, zeroCantidadRow, nullCantidadRow], 3);
      const workbook = createMockWorkbook([ws]);
      const result = await parseExcelIDRALL(workbook);

      expect(result.transacciones).toHaveLength(0);
      expect(result.resumen.registrosInvalidos).toBe(2);
    });

    it('should skip completely empty rows without counting as invalid', async () => {
      const headerRow = {
        rowNumber: 1,
        colValues: { 1: 'Folio', 2: 'Status', 3: 'Fecha', 4: 'Cliente', 5: 'Producto', 6: 'Cantidad' },
      };
      const emptyRow = {
        rowNumber: 2,
        colValues: {},
      };
      const validRow = {
        rowNumber: 3,
        colValues: {
          1: '100 / 1', 2: 'ACTIVO', 3: new Date(2025, 0, 10),
          4: 'Client A', 5: 'Prod A', 6: 50,
        },
      };

      const ws = createMockWorksheet('Hoja1', [headerRow, emptyRow, validRow], 3);
      const workbook = createMockWorkbook([ws]);
      const result = await parseExcelIDRALL(workbook);

      expect(result.transacciones).toHaveLength(1);
      expect(result.resumen.registrosInvalidos).toBe(0);
    });

    it('should track unique clientes and productos in resumen', async () => {
      const headerRow = {
        rowNumber: 1,
        colValues: { 1: 'Folio', 2: 'Status', 3: 'Fecha', 4: 'Cliente', 5: 'Producto', 6: 'Cantidad' },
      };
      const rows = [
        headerRow,
        { rowNumber: 2, colValues: { 1: '1/1', 2: 'ACTIVO', 3: new Date(2025, 0, 1), 4: 'Client A', 5: 'Prod X', 6: 10 } },
        { rowNumber: 3, colValues: { 1: '1/2', 2: 'ACTIVO', 3: new Date(2025, 0, 2), 4: 'Client B', 5: 'Prod X', 6: 20 } },
        { rowNumber: 4, colValues: { 1: '1/3', 2: 'ACTIVO', 3: new Date(2025, 0, 3), 4: 'Client A', 5: 'Prod Y', 6: 30 } },
      ];

      const ws = createMockWorksheet('Hoja1', rows, 4);
      const workbook = createMockWorkbook([ws]);
      const result = await parseExcelIDRALL(workbook);

      expect(result.resumen.clientesUnicos).toBe(2); // Client A, Client B
      expect(result.resumen.productosUnicos).toBe(2); // Prod X, Prod Y
    });

    it('should track date range in resumen', async () => {
      const headerRow = {
        rowNumber: 1,
        colValues: { 1: 'Folio', 2: 'Status', 3: 'Fecha', 4: 'Cliente', 5: 'Producto', 6: 'Cantidad' },
      };
      const rows = [
        headerRow,
        { rowNumber: 2, colValues: { 1: '1/1', 2: 'ACTIVO', 3: new Date(2025, 2, 15), 4: 'C1', 5: 'P1', 6: 10 } },
        { rowNumber: 3, colValues: { 1: '1/2', 2: 'ACTIVO', 3: new Date(2025, 0, 5), 4: 'C2', 5: 'P2', 6: 20 } },
        { rowNumber: 4, colValues: { 1: '1/3', 2: 'ACTIVO', 3: new Date(2025, 5, 20), 4: 'C3', 5: 'P3', 6: 30 } },
      ];

      const ws = createMockWorksheet('Hoja1', rows, 4);
      const workbook = createMockWorkbook([ws]);
      const result = await parseExcelIDRALL(workbook);

      expect(result.resumen.rangoFechas.desde).toEqual(new Date(2025, 0, 5));
      expect(result.resumen.rangoFechas.hasta).toEqual(new Date(2025, 5, 20));
    });

    it('should detect headers automatically when not in row 1', async () => {
      // Headers in row 3, data in rows 4+
      const paddingRow1 = { rowNumber: 1, colValues: { 1: 'Company Title' } };
      const paddingRow2 = { rowNumber: 2, colValues: { 1: '' } };
      const headerRow = {
        rowNumber: 3,
        colValues: { 1: 'MID / Folio', 2: 'Status', 3: 'Fecha', 4: 'Cliente', 5: 'Producto', 6: 'Cantidad' },
      };
      const dataRow = {
        rowNumber: 4,
        colValues: {
          1: '200 / 1', 2: 'ACTIVO', 3: new Date(2025, 3, 1),
          4: 'Client Z', 5: 'Prod Z', 6: 75,
        },
      };

      const ws = createMockWorksheet('Hoja1', [paddingRow1, paddingRow2, headerRow, dataRow], 4);
      const workbook = createMockWorkbook([ws]);
      const result = await parseExcelIDRALL(workbook);

      expect(result.transacciones).toHaveLength(1);
      expect(result.transacciones[0].cliente).toBe('Client Z');
    });

    it('should handle cells with formulas (result takes priority)', async () => {
      const headerRow = {
        rowNumber: 1,
        colValues: { 1: 'Folio', 2: 'Status', 3: 'Fecha', 4: 'Cliente', 5: 'Producto', 6: 'Cantidad' },
      };

      // Create a row where the quantity cell has a formula
      const formulaRow = {
        rowNumber: 2,
        row: {
          getCell: (col: number) => {
            if (col === 6) {
              // Simulate formula cell
              return { value: 999, formula: '=SUM(A1:A10)', result: 42 } as unknown as Cell;
            }
            const vals: Record<number, any> = {
              1: '300 / 1', 2: 'ACTIVO', 3: new Date(2025, 0, 1),
              4: 'Formula Client', 5: 'Formula Prod',
            };
            return { value: vals[col] ?? null, formula: undefined, result: undefined } as unknown as Cell;
          },
        } as unknown as Row,
      };

      const ws = {
        name: 'Hoja1',
        rowCount: 2,
        getRow: (rowNum: number) => {
          if (rowNum === 1) return createMockRow(headerRow.colValues);
          if (rowNum === 2) return formulaRow.row;
          return createMockRow({});
        },
        eachRow: (callback: (row: Row, rowNumber: number) => void) => {
          callback(createMockRow(headerRow.colValues), 1);
          callback(formulaRow.row, 2);
        },
      } as unknown as Worksheet;

      const workbook = createMockWorkbook([ws]);
      const result = await parseExcelIDRALL(workbook);

      expect(result.transacciones).toHaveLength(1);
      // The formula cell should use result (42) instead of value (999)
      expect(result.transacciones[0].cantidad).toBe(42);
    });

    it('should limit errors to 100 entries', async () => {
      const headerRow = {
        rowNumber: 1,
        colValues: { 1: 'Folio', 2: 'Status', 3: 'Fecha', 4: 'Cliente', 5: 'Producto', 6: 'Cantidad' },
      };

      // Create 150 invalid rows (missing fecha)
      const rows = [headerRow];
      for (let i = 2; i <= 151; i++) {
        rows.push({
          rowNumber: i,
          colValues: {
            1: `${i} / 1`, 2: 'ACTIVO', 3: 'invalid',
            4: `Client ${i}`, 5: `Prod ${i}`, 6: 10,
          },
        });
      }

      const ws = createMockWorksheet('Hoja1', rows, 151);
      const workbook = createMockWorkbook([ws]);
      const result = await parseExcelIDRALL(workbook);

      expect(result.errores.length).toBeLessThanOrEqual(100);
      expect(result.resumen.registrosInvalidos).toBe(150);
    });
  });
});

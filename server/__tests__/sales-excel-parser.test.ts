import { describe, it, expect } from 'vitest';
import { parseNumber, parseDate, parseExcelVentas } from '../sales-excel-parser';
import type { Workbook, Worksheet, Row, Cell } from 'exceljs';

describe('Sales Excel Parser', () => {
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

    it('should parse plain numbers', () => {
      expect(parseNumber(42)).toBe(42);
      expect(parseNumber(3.14)).toBe(3.14);
    });

    it('should parse string numbers', () => {
      expect(parseNumber('42')).toBe(42);
    });

    it('should handle zero', () => {
      expect(parseNumber(0)).toBe(0);
    });

    it('should parse numbers with $ prefix', () => {
      expect(parseNumber('$100')).toBe(100);
    });

    it('should parse negative numbers', () => {
      expect(parseNumber(-5)).toBe(-5);
      expect(parseNumber('-5')).toBe(-5);
    });

    it('should return null for non-numeric strings', () => {
      expect(parseNumber('abc')).toBeNull();
    });

    it('should handle numbers with commas', () => {
      expect(parseNumber('1,234')).toBe(1234);
    });

    it('should handle whitespace', () => {
      expect(parseNumber(' 42 ')).toBe(42);
    });
  });

  describe('parseDate', () => {
    it('should parse DD/MM/YYYY format', () => {
      const result = parseDate('15/06/2025');
      expect(result).toBeInstanceOf(Date);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(5); // June
      expect(result.getFullYear()).toBe(2025);
    });

    it('should return a Date for null input', () => {
      const result = parseDate(null);
      expect(result).toBeInstanceOf(Date);
    });

    it('should return a Date for undefined input', () => {
      const result = parseDate(undefined);
      expect(result).toBeInstanceOf(Date);
    });

    it('should handle Date instance', () => {
      const date = new Date('2025-03-15');
      const result = parseDate(date);
      expect(result).toBeInstanceOf(Date);
    });

    it('should parse Excel serial number', () => {
      const result = parseDate(45000);
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBeGreaterThanOrEqual(2023);
    });

    it('should handle empty string', () => {
      const result = parseDate('');
      expect(result).toBeInstanceOf(Date);
    });

    it('should parse DD/MM/YY format', () => {
      const result = parseDate('15/06/25');
      expect(result).toBeInstanceOf(Date);
    });

    it('should handle string date', () => {
      const result = parseDate('2025-01-15');
      expect(result).toBeInstanceOf(Date);
    });
  });

  // =========================================================================
  // Additional parseNumber edge cases
  // =========================================================================
  describe('parseNumber (additional edge cases)', () => {
    it('should return null for boolean values', () => {
      expect(parseNumber(true)).toBeNull();
      expect(parseNumber(false)).toBeNull();
    });

    it('should return null for an object', () => {
      expect(parseNumber({})).toBeNull();
    });

    it('should handle Spanish-style thousand separators (1.524.00)', () => {
      // The function detects patterns like "1.524.00" (two dots) and strips dots
      const result = parseNumber('1.524.00');
      expect(result).toBe(152400);
    });

    it('should handle "$1,216.05" format', () => {
      expect(parseNumber('$1,216.05')).toBe(1216.05);
    });

    it('should parse a string with only commas', () => {
      expect(parseNumber('1,000,000')).toBe(1000000);
    });

    it('should handle very large numbers', () => {
      expect(parseNumber(99999999.99)).toBe(99999999.99);
    });
  });

  // =========================================================================
  // Additional parseDate edge cases
  // =========================================================================
  describe('parseDate (additional edge cases)', () => {
    it('should return current date for a non-parseable object', () => {
      const before = Date.now();
      const result = parseDate({});
      const after = Date.now();
      // Should default to new Date()
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(result.getTime()).toBeLessThanOrEqual(after + 1000);
    });

    it('should parse 2-digit year >= 50 as 1900s', () => {
      const result = parseDate('01/01/75');
      expect(result.getFullYear()).toBe(1975);
    });

    it('should parse 2-digit year < 50 as 2000s', () => {
      const result = parseDate('01/01/25');
      expect(result.getFullYear()).toBe(2025);
    });

    it('should handle an Excel serial date of 1', () => {
      // Excel serial 1 = Jan 1, 1900 (approximately, with Lotus bug)
      const result = parseDate(1);
      expect(result).toBeInstanceOf(Date);
      expect(result.getFullYear()).toBe(1899 + Math.floor(1 / 365) || 1899);
    });
  });

  // =========================================================================
  // parseExcelVentas (main function)
  // =========================================================================
  describe('parseExcelVentas', () => {
    /**
     * Helper to create a mock ExcelJS Row.
     * colValues is 1-indexed: { 1: val1, 2: val2, ... }
     */
    function createMockRow(colValues: Record<number, any>): Row {
      return {
        getCell: (col: number) => ({
          value: colValues[col] ?? null,
        }),
      } as unknown as Row;
    }

    /**
     * Helper to create a mock Worksheet.
     */
    function createMockWorksheet(
      name: string,
      rows: Array<{ rowNumber: number; colValues: Record<number, any> }>
    ): Worksheet {
      const mockRows = rows.map(r => ({
        rowNumber: r.rowNumber,
        row: createMockRow(r.colValues),
      }));

      return {
        name,
        rowCount: rows.length,
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

    function createMockWorkbook(sheets: { name: string; ws: Worksheet }[]): Workbook {
      return {
        worksheets: sheets.map(s => s.ws),
        getWorksheet: (name: string) => {
          const found = sheets.find(s => s.name === name || s.ws.name === name);
          return found ? found.ws : undefined;
        },
      } as unknown as Workbook;
    }

    it('should return empty data when no sheets exist', async () => {
      const workbook = {
        worksheets: [],
        getWorksheet: () => undefined,
      } as unknown as Workbook;

      const result = await parseExcelVentas(workbook);

      expect(result.di.transacciones).toEqual([]);
      expect(result.di.resumen).toEqual([]);
      expect(result.go.transacciones).toEqual([]);
      expect(result.go.resumen).toEqual([]);
    });

    it('should parse VENTAS (DI) sheet transactions', async () => {
      const ventasDI = createMockWorksheet('VENTAS ', [
        { rowNumber: 1, colValues: { 1: 'Fecha', 2: 'Folio', 3: 'Cliente', 4: 'Producto', 5: 'Cantidad', 6: 'PU', 7: 'Importe', 8: '2025', 9: '1' } },
        {
          rowNumber: 2,
          colValues: {
            1: new Date(2025, 0, 15), 2: 'F-001', 3: 'Acme Corp', 4: 'Widget A',
            5: 100, 6: 25.0, 7: 2500.0, 8: '2025', 9: '1',
          },
        },
      ]);

      const workbook = createMockWorkbook([
        { name: 'VENTAS ', ws: ventasDI },
      ]);

      const result = await parseExcelVentas(workbook);

      expect(result.di.transacciones).toHaveLength(1);
      const tx = result.di.transacciones[0];
      expect(tx.cliente).toBe('Acme Corp');
      expect(tx.producto).toBe('Widget A');
      expect(tx.cantidad).toBe(100);
      expect(tx.precioUnitario).toBe(25.0);
      expect(tx.importe).toBe(2500.0);
      expect(tx.submodulo).toBe('DI');
      expect(tx.año).toBe(2025);
      expect(tx.mes).toBe(1);
    });

    it('should skip VENTAS DI rows missing cliente or producto', async () => {
      const ventasDI = createMockWorksheet('VENTAS ', [
        { rowNumber: 1, colValues: { 1: 'Fecha', 2: 'Folio', 3: 'Cliente', 4: 'Producto', 5: 'Cantidad' } },
        { rowNumber: 2, colValues: { 1: new Date(2025, 0, 15), 2: 'F-001', 3: '', 4: 'Widget A', 5: 100 } },
        { rowNumber: 3, colValues: { 1: new Date(2025, 0, 16), 2: 'F-002', 3: 'Client', 4: '', 5: 50 } },
        { rowNumber: 4, colValues: { 1: new Date(2025, 0, 17), 2: 'F-003', 3: 'Client', 4: 'Prod', 5: 0 } },
      ]);

      const workbook = createMockWorkbook([{ name: 'VENTAS ', ws: ventasDI }]);
      const result = await parseExcelVentas(workbook);

      // Row 2: empty cliente, Row 3: empty producto, Row 4: zero cantidad
      expect(result.di.transacciones).toHaveLength(0);
    });

    it('should parse VENTAS GO sheet transactions', async () => {
      const ventasGO = createMockWorksheet('VENTAS GO', [
        { rowNumber: 1, colValues: { 1: 'Factura', 2: 'Fecha', 3: 'Cliente', 4: 'Producto', 5: 'Familia', 6: 'Cantidad', 7: 'USD', 8: 'TC', 9: 'MN' } },
        {
          rowNumber: 2,
          colValues: {
            1: 'GO-001', 2: new Date(2025, 1, 10), 3: 'Beta Inc', 4: 'Gadget B',
            5: 'Familia X', 6: 200, 7: 5000.0, 8: 17.5, 9: 87500.0,
          },
        },
      ]);

      const workbook = createMockWorkbook([{ name: 'VENTAS GO', ws: ventasGO }]);
      const result = await parseExcelVentas(workbook);

      expect(result.go.transacciones).toHaveLength(1);
      const tx = result.go.transacciones[0];
      expect(tx.folio).toBe('GO-001');
      expect(tx.cliente).toBe('Beta Inc');
      expect(tx.producto).toBe('Gadget B');
      expect(tx.cantidad).toBe(200);
      expect(tx.importe).toBe(5000.0);
      expect(tx.tipoCambio).toBe(17.5);
      expect(tx.importeMN).toBe(87500.0);
      expect(tx.familiaProducto).toBe('Familia X');
      expect(tx.submodulo).toBe('GO');
    });

    it('should parse RESUMEN DI sheet (rows after header row 6)', async () => {
      const resumenDI = createMockWorksheet('RESUMEN DI', [
        // Rows 1-6 are header area; only row 7+ should be parsed
        { rowNumber: 1, colValues: {} },
        { rowNumber: 6, colValues: { 3: 'Clientes', 4: 'Activos', 6: 'Kilos 2024' } },
        {
          rowNumber: 7,
          colValues: {
            3: 'Client Alpha', 4: 1, 6: 5000, 9: 6000, 10: 1000,
            13: 150000, 14: 0.15, 19: 'Retener', 20: 'Juan',
          },
        },
      ]);

      const workbook = createMockWorkbook([{ name: 'RESUMEN DI', ws: resumenDI }]);
      const result = await parseExcelVentas(workbook);

      expect(result.di.resumen).toHaveLength(1);
      const r = result.di.resumen[0];
      expect(r.cliente).toBe('Client Alpha');
      expect(r.activo).toBe(true);
      expect(r.kilos2024).toBe(5000);
      expect(r.kilos2025).toBe(6000);
      expect(r.diferencial).toBe(1000);
      expect(r.usd2025).toBe(150000);
      expect(r.utilidad).toBe(0.15);
      expect(r.accion).toBe('Retener');
      expect(r.responsable).toBe('Juan');
      expect(r.submodulo).toBe('DI');
    });

    it('should parse RESUMEN GO sheet', async () => {
      const resumenGO = createMockWorksheet('RESUMEN GO', [
        { rowNumber: 1, colValues: {} },
        { rowNumber: 6, colValues: { 3: 'Clientes' } },
        {
          rowNumber: 7,
          colValues: {
            3: 'Client Beta', 6: 3000, 9: 4000, 10: 1000,
            19: 'Crecer', 20: 'Maria',
          },
        },
      ]);

      const workbook = createMockWorkbook([{ name: 'RESUMEN GO', ws: resumenGO }]);
      const result = await parseExcelVentas(workbook);

      expect(result.go.resumen).toHaveLength(1);
      const r = result.go.resumen[0];
      expect(r.cliente).toBe('Client Beta');
      expect(r.kilos2024).toBe(3000);
      expect(r.kilos2025).toBe(4000);
      expect(r.diferencial).toBe(1000);
      expect(r.accion).toBe('Crecer');
      expect(r.responsable).toBe('Maria');
      expect(r.submodulo).toBe('GO');
      // GO does not have activo field
      expect(r.activo).toBeUndefined();
    });

    it('should skip RESUMEN rows without cliente name', async () => {
      const resumenDI = createMockWorksheet('RESUMEN DI', [
        { rowNumber: 6, colValues: { 3: 'Clientes' } },
        { rowNumber: 7, colValues: { 3: '', 6: 1000 } },
        { rowNumber: 8, colValues: { 3: null, 6: 2000 } },
        { rowNumber: 9, colValues: { 3: 'Valid Client', 6: 3000, 9: 0, 10: 0 } },
      ]);

      const workbook = createMockWorkbook([{ name: 'RESUMEN DI', ws: resumenDI }]);
      const result = await parseExcelVentas(workbook);

      expect(result.di.resumen).toHaveLength(1);
      expect(result.di.resumen[0].cliente).toBe('Valid Client');
    });

    it('should parse all four sheets in a complete workbook', async () => {
      const ventasDI = createMockWorksheet('VENTAS ', [
        { rowNumber: 1, colValues: {} },
        { rowNumber: 2, colValues: { 1: new Date(2025, 0, 1), 2: 'F1', 3: 'C1', 4: 'P1', 5: 10, 6: 5, 7: 50 } },
      ]);
      const resumenDI = createMockWorksheet('RESUMEN DI', [
        { rowNumber: 6, colValues: {} },
        { rowNumber: 7, colValues: { 3: 'C1', 4: 1, 6: 100, 9: 120, 10: 20 } },
      ]);
      const ventasGO = createMockWorksheet('VENTAS GO', [
        { rowNumber: 1, colValues: {} },
        { rowNumber: 2, colValues: { 1: 'GO1', 2: new Date(2025, 1, 1), 3: 'C2', 4: 'P2', 5: 'Fam', 6: 20, 7: 100, 8: 17, 9: 1700 } },
      ]);
      const resumenGO = createMockWorksheet('RESUMEN GO', [
        { rowNumber: 6, colValues: {} },
        { rowNumber: 7, colValues: { 3: 'C2', 6: 200, 9: 250, 10: 50 } },
      ]);

      const workbook = createMockWorkbook([
        { name: 'VENTAS ', ws: ventasDI },
        { name: 'RESUMEN DI', ws: resumenDI },
        { name: 'VENTAS GO', ws: ventasGO },
        { name: 'RESUMEN GO', ws: resumenGO },
      ]);

      const result = await parseExcelVentas(workbook);

      expect(result.di.transacciones).toHaveLength(1);
      expect(result.di.resumen).toHaveLength(1);
      expect(result.go.transacciones).toHaveLength(1);
      expect(result.go.resumen).toHaveLength(1);
    });

    it('should fall back to VENTAS sheet name without trailing space', async () => {
      const ventasDI = createMockWorksheet('VENTAS', [
        { rowNumber: 1, colValues: {} },
        { rowNumber: 2, colValues: { 1: new Date(2025, 0, 1), 2: 'F1', 3: 'C1', 4: 'P1', 5: 10, 6: 5, 7: 50 } },
      ]);

      const workbook = createMockWorkbook([{ name: 'VENTAS', ws: ventasDI }]);
      const result = await parseExcelVentas(workbook);

      expect(result.di.transacciones).toHaveLength(1);
    });

    it('should derive año and mes from fecha when not provided in columns', async () => {
      const ventasDI = createMockWorksheet('VENTAS', [
        { rowNumber: 1, colValues: {} },
        {
          rowNumber: 2,
          colValues: {
            1: new Date(2025, 4, 20), // May 20, 2025
            2: 'F1', 3: 'C1', 4: 'P1', 5: 10,
            // columns 8 and 9 (año, mes) not present
          },
        },
      ]);

      const workbook = createMockWorkbook([{ name: 'VENTAS', ws: ventasDI }]);
      const result = await parseExcelVentas(workbook);

      expect(result.di.transacciones).toHaveLength(1);
      expect(result.di.transacciones[0].año).toBe(2025);
      expect(result.di.transacciones[0].mes).toBe(5);
    });
  });
});

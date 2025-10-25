// PARSER PARA EXCEL DE IDRALL
import * as XLSX from 'xlsx';
import { z } from 'zod';

// Schema para validar datos del Excel IDRALL
const IdrallPaymentSchema = z.object({
  // Campos básicos que esperamos del Excel IDRALL
  fecha: z.string().optional(),
  fecha_pago: z.string().optional(),
  monto: z.number().optional(),
  importe: z.number().optional(),
  proveedor: z.string().optional(),
  cliente: z.string().optional(),
  concepto: z.string().optional(),
  descripcion: z.string().optional(),
  referencia: z.string().optional(),
  banco: z.string().optional(),
  cuenta: z.string().optional(),
  moneda: z.string().optional(),
  // Campos adicionales que podrían estar presentes
  factura: z.string().optional(),
  folio: z.string().optional(),
  vencimiento: z.string().optional(),
  status: z.string().optional(),
});

export type IdrallPayment = z.infer<typeof IdrallPaymentSchema>;

export class IdrallParser {
  /**
   * Parsea un archivo Excel de IDRALL y extrae los pagos
   */
  static async parseExcel(filePath: string): Promise<{
    success: boolean;
    payments: IdrallPayment[];
    errors: string[];
    totalRows: number;
  }> {
    try {
      console.log(`📊 [IdrallParser] Procesando archivo: ${filePath}`);

      // Leer el archivo Excel
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0]; // Primera hoja
      const worksheet = workbook.Sheets[sheetName];

      // Convertir a JSON
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (rawData.length < 2) {
        return {
          success: false,
          payments: [],
          errors: ['El archivo Excel está vacío o no tiene datos'],
          totalRows: 0
        };
      }

      // Obtener headers (primera fila)
      const headers = rawData[0] as string[];
      console.log(`📋 [IdrallParser] Headers encontrados:`, headers);

      // Mapear headers a campos estándar
      const headerMapping = this.mapHeaders(headers);
      console.log(`🔄 [IdrallParser] Mapeo de headers:`, headerMapping);

      // Procesar filas de datos
      const payments: IdrallPayment[] = [];
      const errors: string[] = [];
      let validRows = 0;

      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i] as any[];
        
        if (!row || row.length === 0) continue;

        try {
          // Mapear datos de la fila usando el mapeo de headers
          const mappedData = this.mapRowData(row, headerMapping, headers);
          
          // Validar con schema
          const validatedData = IdrallPaymentSchema.parse(mappedData);
          
          // Solo agregar si tiene datos mínimos
          if (validatedData.monto || validatedData.importe) {
            payments.push(validatedData);
            validRows++;
          }
        } catch (error) {
          const errorMsg = `Fila ${i + 1}: ${error instanceof Error ? error.message : 'Error desconocido'}`;
          errors.push(errorMsg);
          console.warn(`⚠️ [IdrallParser] ${errorMsg}`);
        }
      }

      console.log(`✅ [IdrallParser] Procesamiento completado: ${validRows} pagos válidos, ${errors.length} errores`);

      return {
        success: validRows > 0,
        payments,
        errors,
        totalRows: rawData.length - 1
      };

    } catch (error) {
      console.error('❌ [IdrallParser] Error procesando Excel:', error);
      return {
        success: false,
        payments: [],
        errors: [`Error procesando archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`],
        totalRows: 0
      };
    }
  }

  /**
   * Mapea headers del Excel a campos estándar
   */
  private static mapHeaders(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      if (!header) return;
      
      const normalizedHeader = header.toLowerCase().trim();
      
      // Mapeo de campos comunes
      if (normalizedHeader.includes('fecha') && normalizedHeader.includes('pago')) {
        mapping[`col_${index}`] = 'fecha_pago';
      } else if (normalizedHeader.includes('fecha')) {
        mapping[`col_${index}`] = 'fecha';
      } else if (normalizedHeader.includes('monto') || normalizedHeader.includes('importe')) {
        mapping[`col_${index}`] = 'monto';
      } else if (normalizedHeader.includes('proveedor') || normalizedHeader.includes('supplier')) {
        mapping[`col_${index}`] = 'proveedor';
      } else if (normalizedHeader.includes('cliente') || normalizedHeader.includes('client')) {
        mapping[`col_${index}`] = 'cliente';
      } else if (normalizedHeader.includes('concepto') || normalizedHeader.includes('concept')) {
        mapping[`col_${index}`] = 'concepto';
      } else if (normalizedHeader.includes('descripcion') || normalizedHeader.includes('description')) {
        mapping[`col_${index}`] = 'descripcion';
      } else if (normalizedHeader.includes('referencia') || normalizedHeader.includes('reference')) {
        mapping[`col_${index}`] = 'referencia';
      } else if (normalizedHeader.includes('banco') || normalizedHeader.includes('bank')) {
        mapping[`col_${index}`] = 'banco';
      } else if (normalizedHeader.includes('cuenta') || normalizedHeader.includes('account')) {
        mapping[`col_${index}`] = 'cuenta';
      } else if (normalizedHeader.includes('moneda') || normalizedHeader.includes('currency')) {
        mapping[`col_${index}`] = 'moneda';
      } else if (normalizedHeader.includes('factura') || normalizedHeader.includes('invoice')) {
        mapping[`col_${index}`] = 'factura';
      } else if (normalizedHeader.includes('folio')) {
        mapping[`col_${index}`] = 'folio';
      } else if (normalizedHeader.includes('vencimiento') || normalizedHeader.includes('due')) {
        mapping[`col_${index}`] = 'vencimiento';
      } else if (normalizedHeader.includes('status') || normalizedHeader.includes('estado')) {
        mapping[`col_${index}`] = 'status';
      }
    });

    return mapping;
  }

  /**
   * Mapea datos de una fila usando el mapeo de headers
   */
  private static mapRowData(row: any[], headerMapping: Record<string, string>, headers: string[]): any {
    const mappedData: any = {};
    
    row.forEach((value, index) => {
      const columnKey = `col_${index}`;
      const fieldName = headerMapping[columnKey];
      
      if (fieldName && value !== undefined && value !== null && value !== '') {
        // Convertir números
        if (fieldName === 'monto' || fieldName === 'importe') {
          const numValue = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
          if (!isNaN(numValue)) {
            mappedData[fieldName] = numValue;
          }
        } else {
          mappedData[fieldName] = String(value).trim();
        }
      }
    });

    return mappedData;
  }

  /**
   * Busca un cliente/proveedor en la base de datos basado en los datos del Excel
   */
  static async findMatchingClient(payment: IdrallPayment, companyId: number): Promise<{
    found: boolean;
    client?: any;
    matchType: 'exact' | 'partial' | 'none';
  }> {
    try {
      // Importar dinámicamente para evitar dependencias circulares
      const { db } = await import('./db');
      const { clients } = await import('../shared/schema');
      const { eq, and, or, ilike } = await import('drizzle-orm');

      const searchTerms = [
        payment.proveedor,
        payment.cliente,
        payment.concepto,
        payment.descripcion
      ].filter(Boolean);

      if (searchTerms.length === 0) {
        return { found: false, matchType: 'none' };
      }

      // Buscar coincidencia exacta por nombre
      for (const term of searchTerms) {
        const exactMatch = await db.query.clients.findFirst({
          where: and(
            eq(clients.companyId, companyId),
            ilike(clients.name, `%${term}%`)
          )
        });

        if (exactMatch) {
          return { found: true, client: exactMatch, matchType: 'exact' };
        }
      }

      // Buscar coincidencia parcial
      for (const term of searchTerms) {
        const partialMatch = await db.query.clients.findFirst({
          where: and(
            eq(clients.companyId, companyId),
            or(
              ilike(clients.name, `%${term.split(' ')[0]}%`),
              ilike(clients.email, `%${term}%`)
            )
          )
        });

        if (partialMatch) {
          return { found: true, client: partialMatch, matchType: 'partial' };
        }
      }

      return { found: false, matchType: 'none' };

    } catch (error) {
      console.error('❌ [IdrallParser] Error buscando cliente:', error);
      return { found: false, matchType: 'none' };
    }
  }
}

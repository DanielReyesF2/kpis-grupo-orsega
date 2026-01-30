/**
 * ============================================================================
 * 📊 MCP SALES UPLOAD - Procesar Excel de ventas via Nova AI
 * ============================================================================
 *
 * Permite que Nova procese un archivo Excel arrastrado al chat
 * y guarde los datos de ventas en la base de datos.
 *
 * Flujo:
 * 1. Usuario arrastra Excel al chat de Nova
 * 2. El buffer se almacena en nova-file-store con un fileId
 * 3. Nova llama a process_sales_excel con el fileId
 * 4. Este tool recupera el buffer, parsea y guarda en la BD
 *
 * @module mcp/tools/sales-upload
 */

import type { MCPTool, MCPToolResult, MCPContext } from '../index';
import { getFile, removeFile } from '../../nova/nova-file-store';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// ============================================================================
// DEFINICIÓN DE HERRAMIENTA
// ============================================================================

export const salesUploadTools: MCPTool[] = [
  {
    name: 'process_sales_excel',
    description: `Procesa un archivo Excel de ventas que el usuario arrastró al chat y guarda los datos en la base de datos.

    Usar cuando el usuario diga cosas como:
    - "Actualiza ventas de Orsega"
    - "Sube estos datos de ventas"
    - "Procesa este Excel de ventas"
    - "Importa ventas"

    El Excel debe tener las hojas: VENTAS (DI), RESUMEN DI, VENTAS GO, RESUMEN GO.
    Los datos se guardan en sales_data, products, clients y sales_acciones.

    IMPORTANTE: Solo funciona si el usuario adjuntó un archivo Excel al mensaje.
    El file_id se proporciona automáticamente en el contexto del chat.`,
    category: 'sales',
    inputSchema: {
      type: 'object',
      properties: {
        file_id: {
          type: 'string',
          description: 'ID del archivo Excel almacenado (proporcionado automáticamente en el contexto del chat cuando el usuario adjunta un archivo)',
        },
      },
      required: ['file_id'],
    },
  },
];

// ============================================================================
// EJECUTOR
// ============================================================================

export async function executeSalesUploadTool(
  toolName: string,
  params: Record<string, any>,
  context: MCPContext
): Promise<MCPToolResult> {
  console.log(`📊 [MCP Sales] Ejecutando: ${toolName}`);

  switch (toolName) {
    case 'process_sales_excel':
      return await processSalesExcel(params, context);
    default:
      return {
        success: false,
        error: `Herramienta de ventas no implementada: ${toolName}`,
      };
  }
}

// ============================================================================
// IMPLEMENTACIÓN
// ============================================================================

function calcularPrioridad(diferencialKg: number): string {
  if (diferencialKg < -10000) return 'CRITICA';
  if (diferencialKg < -5000) return 'ALTA';
  if (diferencialKg < 0) return 'MEDIA';
  return 'BAJA';
}

async function processSalesExcel(
  params: Record<string, any>,
  context: MCPContext
): Promise<MCPToolResult> {
  const { file_id } = params;
  const userId = context.userId || '';

  if (!file_id) {
    return {
      success: false,
      error: 'No se proporcionó file_id. El usuario debe adjuntar un archivo Excel al mensaje.',
    };
  }

  // Retrieve the stored file
  const storedFile = getFile(file_id, userId);
  if (!storedFile) {
    return {
      success: false,
      error: 'Archivo no encontrado o expirado. El usuario debe volver a adjuntar el archivo Excel.',
    };
  }

  // Validate it's an Excel file
  if (!storedFile.mimetype.includes('spreadsheet') && !storedFile.mimetype.includes('excel')) {
    return {
      success: false,
      error: `El archivo "${storedFile.originalName}" no es un archivo Excel. Solo se aceptan archivos .xlsx o .xls.`,
    };
  }

  let uploadId: number | null = null;

  try {
    // Parse the Excel buffer
    const ExcelJS = await import('exceljs');
    const { parseExcelVentas } = await import('../../sales-excel-parser');

    const workbook = new ExcelJS.default.Workbook();
    await workbook.xlsx.load(storedFile.buffer);

    if (!workbook.worksheets || workbook.worksheets.length === 0) {
      return {
        success: false,
        error: 'El archivo Excel no contiene hojas de cálculo.',
      };
    }

    console.log(`📋 [MCP Sales] Hojas encontradas: ${workbook.worksheets.length}`);
    workbook.worksheets.forEach((ws: any, idx: number) => {
      console.log(`   - Hoja ${idx + 1}: "${ws.name}"`);
    });

    const parsedData = await parseExcelVentas(workbook);

    const totalTransacciones = parsedData.di.transacciones.length + parsedData.go.transacciones.length;
    const totalResumen = parsedData.di.resumen.length + parsedData.go.resumen.length;

    if (totalTransacciones === 0 && totalResumen === 0) {
      return {
        success: false,
        error: 'No se encontraron datos válidos en el Excel. Debe tener hojas: VENTAS (DI), RESUMEN DI, VENTAS GO, RESUMEN GO.',
      };
    }

    // Create upload record
    const resolvedCompanyId = 1; // DI by default; both DI and GO are processed
    const uploadResult = await sql(`
      INSERT INTO sales_uploads (
        company_id, uploaded_by, file_name, file_size,
        status
      ) VALUES ($1, $2, $3, $4, 'processing')
      RETURNING id
    `, [
      resolvedCompanyId,
      parseInt(userId) || 0,
      storedFile.originalName,
      storedFile.size,
    ]);

    uploadId = uploadResult[0].id;
    console.log(`📝 [MCP Sales] Upload record: ID ${uploadId}`);

    // ========== INSERT TRANSACTIONS ==========
    let transaccionesInsertadas = 0;

    // DI transactions
    for (const tx of parsedData.di.transacciones) {
      const clientResult = await sql(`
        SELECT id FROM clients
        WHERE company_id = 1 AND LOWER(name) = LOWER($1)
        LIMIT 1
      `, [tx.cliente]);
      const clientId = clientResult[0]?.id || null;

      let productId = null;
      const productResult = await sql(`
        SELECT id FROM products
        WHERE company_id = 1 AND LOWER(product_name) = LOWER($1)
        LIMIT 1
      `, [tx.producto]);

      if (productResult[0]) {
        productId = productResult[0].id;
      } else {
        const newProduct = await sql(`
          INSERT INTO products (company_id, product_name, unit, is_active)
          VALUES (1, $1, 'KG', true)
          RETURNING id
        `, [tx.producto]);
        if (newProduct[0]) {
          productId = newProduct[0].id;
        }
      }

      const fecha = new Date(tx.fecha);
      const d = new Date(Date.UTC(tx.año, tx.mes - 1, fecha.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const saleWeek = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

      await sql(`
        INSERT INTO sales_data (
          company_id, submodulo, client_id, client_name, product_id, product_name,
          quantity, unit, sale_date, sale_month, sale_year, sale_week,
          invoice_number, folio, unit_price, total_amount, upload_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        1, 'DI', clientId, tx.cliente, productId, tx.producto,
        tx.cantidad, 'KG', tx.fecha.toISOString().split('T')[0],
        tx.mes, tx.año, saleWeek, tx.folio, tx.folio,
        tx.precioUnitario, tx.importe, uploadId,
      ]);

      transaccionesInsertadas++;
    }

    // GO transactions
    for (const tx of parsedData.go.transacciones) {
      const clientResult = await sql(`
        SELECT id FROM clients
        WHERE company_id = 2 AND LOWER(name) = LOWER($1)
        LIMIT 1
      `, [tx.cliente]);
      const clientId = clientResult[0]?.id || null;

      let productId = null;
      const productResult = await sql(`
        SELECT id FROM products
        WHERE company_id = 2 AND LOWER(product_name) = LOWER($1)
        LIMIT 1
      `, [tx.producto]);

      if (productResult[0]) {
        productId = productResult[0].id;
      } else {
        const newProduct = await sql(`
          INSERT INTO products (company_id, product_name, familia_producto, unit, is_active)
          VALUES (2, $1, $2, 'unidades', true)
          RETURNING id
        `, [tx.producto, tx.familiaProducto || null]);
        if (newProduct[0]) {
          productId = newProduct[0].id;
        }
      }

      const fecha = new Date(tx.fecha);
      const d = new Date(Date.UTC(tx.año, tx.mes - 1, fecha.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const saleWeek = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

      await sql(`
        INSERT INTO sales_data (
          company_id, submodulo, client_id, client_name, product_id, product_name,
          quantity, unit, sale_date, sale_month, sale_year, sale_week,
          invoice_number, total_amount, tipo_cambio, importe_mn, upload_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      `, [
        2, 'GO', clientId, tx.cliente, productId, tx.producto,
        tx.cantidad, 'unidades', tx.fecha.toISOString().split('T')[0],
        tx.mes, tx.año, saleWeek, tx.folio, tx.importe,
        tx.tipoCambio, tx.importeMN, uploadId,
      ]);

      transaccionesInsertadas++;
    }

    // ========== CREATE ACTIONS FROM SUMMARIES ==========
    let accionesCreadas = 0;

    for (const resumen of parsedData.di.resumen) {
      if (resumen.accion && resumen.accion.trim() !== '') {
        const clientResult = await sql(`
          SELECT id FROM clients
          WHERE company_id = 1 AND LOWER(name) = LOWER($1)
          LIMIT 1
        `, [resumen.cliente]);
        const clientId = clientResult[0]?.id || null;
        const prioridad = calcularPrioridad(resumen.diferencial);

        await sql(`
          INSERT INTO sales_acciones (
            cliente_id, cliente_nombre, submodulo, descripcion, prioridad,
            estado, responsables, diferencial, kilos_2024, kilos_2025,
            usd_2025, utilidad, excel_origen_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          clientId, resumen.cliente, 'DI', resumen.accion, prioridad,
          'PENDIENTE', resumen.responsable, resumen.diferencial,
          resumen.kilos2024, resumen.kilos2025, resumen.usd2025,
          resumen.utilidad, uploadId,
        ]);
        accionesCreadas++;
      }
    }

    for (const resumen of parsedData.go.resumen) {
      if (resumen.accion && resumen.accion.trim() !== '') {
        const clientResult = await sql(`
          SELECT id FROM clients
          WHERE company_id = 2 AND LOWER(name) = LOWER($1)
          LIMIT 1
        `, [resumen.cliente]);
        const clientId = clientResult[0]?.id || null;
        const prioridad = calcularPrioridad(resumen.diferencial);

        await sql(`
          INSERT INTO sales_acciones (
            cliente_id, cliente_nombre, submodulo, descripcion, prioridad,
            estado, responsables, diferencial, kilos_2024, kilos_2025,
            excel_origen_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          clientId, resumen.cliente, 'GO', resumen.accion, prioridad,
          'PENDIENTE', resumen.responsable, resumen.diferencial,
          resumen.kilos2024, resumen.kilos2025, uploadId,
        ]);
        accionesCreadas++;
      }
    }

    // Update upload status
    await sql(`
      UPDATE sales_uploads
      SET status = 'processed', records_count = $1
      WHERE id = $2
    `, [transaccionesInsertadas, uploadId]);

    // Clean up the stored file
    removeFile(file_id);

    console.log(`✅ [MCP Sales] Procesamiento completo: ${transaccionesInsertadas} transacciones, ${accionesCreadas} acciones`);

    return {
      success: true,
      data: {
        message: 'Excel de ventas procesado exitosamente',
        uploadId,
        archivo: storedFile.originalName,
        transaccionesInsertadas,
        accionesCreadas,
        detalle: {
          di: {
            transacciones: parsedData.di.transacciones.length,
            resumen: parsedData.di.resumen.length,
          },
          go: {
            transacciones: parsedData.go.transacciones.length,
            resumen: parsedData.go.resumen.length,
          },
        },
      },
    };

  } catch (error: any) {
    console.error('❌ [MCP Sales] Error:', error);

    if (uploadId) {
      try {
        await sql(`
          UPDATE sales_uploads
          SET status = 'error', notes = $1
          WHERE id = $2
        `, [error.message || 'Error desconocido', uploadId]);
      } catch {
        // Ignore update error
      }
    }

    return {
      success: false,
      error: `Error procesando Excel de ventas: ${error.message || 'Error desconocido'}`,
    };
  }
}

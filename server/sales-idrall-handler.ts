/**
 * Handler para upload de Excel de IDRALL
 * Procesa el formato específico del CRM IDRALL
 * Escribe directamente a la tabla ventas (single source of truth)
 */

import type { Request, Response } from 'express';
import { parseExcelIDRALL, type IDRALLTransaction } from './sales-idrall-parser';
import { neon } from '@neondatabase/serverless';
import path from 'path';

const sql = neon(process.env.DATABASE_URL!);

// Re-export AuthRequest type from routes to avoid conflicts
interface AuthRequest extends Request {
  user: {
    id: number;
    role: string;
    email: string;
    name: string;
    areaId?: number | null;
    companyId?: number | null;
  };
}

interface UploadHandlerDependencies {
  getAuthUser: (req: AuthRequest) => any;
  ExcelJS: any;
}

/**
 * Asegura que los campos nuevos de IDRALL existan en la tabla ventas
 */
async function ensureIDRALLColumns(): Promise<void> {
  const columnsToAdd = [
    { name: 'status', definition: 'VARCHAR(20) DEFAULT \'ACTIVO\'' },
    { name: 'lote', definition: 'VARCHAR(100)' },
    { name: 'costo_unitario', definition: 'DECIMAL(15, 4)' },
    { name: 'utilidad_perdida', definition: 'DECIMAL(15, 4)' },
    { name: 'utilidad_con_gastos', definition: 'DECIMAL(15, 4)' },
    { name: 'utilidad_porcentaje', definition: 'DECIMAL(8, 4)' },
    { name: 'tipo_cambio_costo', definition: 'DECIMAL(10, 4)' },
    { name: 'folio_numero', definition: 'INTEGER' },
    { name: 'folio_secuencia', definition: 'INTEGER' },
    { name: 'client_id', definition: 'INTEGER' },
    { name: 'product_id', definition: 'INTEGER' },
    { name: 'upload_id', definition: 'INTEGER' },
    { name: 'submodulo', definition: 'VARCHAR(10)' },
  ];

  for (const col of columnsToAdd) {
    try {
      await sql(`
        ALTER TABLE ventas
        ADD COLUMN IF NOT EXISTS ${col.name} ${col.definition}
      `);
    } catch (error: any) {
      // Ignorar error si la columna ya existe
      if (!error.message?.includes('already exists')) {
        console.error(`Error adding column ${col.name}:`, error.message);
      }
    }
  }

  console.log('✅ [IDRALL Handler] Columnas verificadas en ventas');
}

/**
 * Handler principal para upload de Excel IDRALL
 */
export async function handleIDRALLUpload(
  req: Request,
  res: Response,
  deps: UploadHandlerDependencies
): Promise<void> {
  let uploadId: number | null = null;

  try {
    const { getAuthUser, ExcelJS } = deps;
    const user = getAuthUser(req as AuthRequest);
    const file = (req as any).file;
    const { companyId } = req.body;

    console.log('📁 [IDRALL Upload] Archivo recibido:', file ? {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path
    } : 'null');

    if (!file) {
      res.status(400).json({
        error: 'No se subió ningún archivo',
        details: 'Asegúrate de seleccionar un archivo Excel antes de subirlo'
      });
      return;
    }

    // Asegurar que las columnas de IDRALL existan
    await ensureIDRALLColumns();

    const resolvedCompanyId = parseInt(companyId) || 1;

    console.log(`📊 [IDRALL Upload] Procesando archivo de IDRALL...`);

    // Leer el archivo Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);

    if (!workbook.worksheets || workbook.worksheets.length === 0) {
      res.status(400).json({
        error: 'Archivo Excel inválido',
        details: 'El archivo no contiene hojas de cálculo'
      });
      return;
    }

    console.log(`📋 [IDRALL Upload] Hojas encontradas: ${workbook.worksheets.length}`);
    workbook.worksheets.forEach((ws: any, idx: number) => {
      console.log(`   - Hoja ${idx + 1}: "${ws.name}" (${ws.rowCount} filas)`);
    });

    // Parsear usando el parser de IDRALL
    const parseResult = await parseExcelIDRALL(workbook);

    if (parseResult.transacciones.length === 0) {
      res.status(400).json({
        error: 'No se encontraron datos válidos',
        details: `El archivo no contiene transacciones válidas. ${parseResult.errores.length > 0 ? `Se encontraron ${parseResult.errores.length} errores.` : ''}`,
        errores: parseResult.errores.slice(0, 10)
      });
      return;
    }

    // Crear registro de upload
    const uploadResult = await sql(`
      INSERT INTO sales_uploads (
        company_id, uploaded_by, file_name, file_url, file_size,
        period_start, period_end, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'processing', $8)
      RETURNING id
    `, [
      resolvedCompanyId,
      user.id,
      file.originalname,
      `/uploads/sales/${path.basename(file.path)}`,
      file.size,
      parseResult.resumen.rangoFechas.desde?.toISOString().split('T')[0] || null,
      parseResult.resumen.rangoFechas.hasta?.toISOString().split('T')[0] || null,
      `IDRALL Import: ${parseResult.resumen.totalRegistros} registros, ${parseResult.resumen.clientesUnicos} clientes`
    ]);

    uploadId = uploadResult[0].id;
    console.log(`📝 [IDRALL Upload] Registro de upload creado: ID ${uploadId}`);

    // ========== PROCESAR TRANSACCIONES ==========

    console.log(`💾 [IDRALL Upload] Insertando ${parseResult.transacciones.length} transacciones...`);

    let transaccionesInsertadas = 0;
    let transaccionesActualizadas = 0;
    const clientesCreados = new Set<string>();
    const productosCreados = new Set<string>();

    for (const tx of parseResult.transacciones) {
      try {
        // Buscar o crear cliente
        let clientId: number | null = null;
        const clientResult = await sql(`
          SELECT id FROM clients
          WHERE company_id = $1 AND LOWER(name) = LOWER($2)
          LIMIT 1
        `, [resolvedCompanyId, tx.cliente]);

        if (clientResult[0]) {
          clientId = clientResult[0].id;
        } else {
          // Crear cliente nuevo
          const newClient = await sql(`
            INSERT INTO clients (company_id, name, is_active, created_at)
            VALUES ($1, $2, true, CURRENT_TIMESTAMP)
            ON CONFLICT DO NOTHING
            RETURNING id
          `, [resolvedCompanyId, tx.cliente]);

          if (newClient[0]) {
            clientId = newClient[0].id;
            clientesCreados.add(tx.cliente);
          }
        }

        // Buscar o crear producto
        let productId: number | null = null;
        const productResult = await sql(`
          SELECT id FROM products
          WHERE company_id = $1 AND LOWER(product_name) = LOWER($2)
          LIMIT 1
        `, [resolvedCompanyId, tx.producto]);

        if (productResult[0]) {
          productId = productResult[0].id;
        } else {
          const newProduct = await sql(`
            INSERT INTO products (company_id, product_name, unit, is_active)
            VALUES ($1, $2, 'KG', true)
            ON CONFLICT DO NOTHING
            RETURNING id
          `, [resolvedCompanyId, tx.producto]);

          if (newProduct[0]) {
            productId = newProduct[0].id;
            productosCreados.add(tx.producto);
          }
        }

        // Verificar si ya existe este registro (por folio y fecha)
        const existingRecord = await sql(`
          SELECT id FROM ventas
          WHERE company_id = $1 AND folio = $2 AND fecha = $3
          LIMIT 1
        `, [resolvedCompanyId, tx.folio, tx.fecha.toISOString().split('T')[0]]);

        if (existingRecord[0]) {
          // Actualizar registro existente
          await sql(`
            UPDATE ventas SET
              status = $1,
              client_id = $2,
              cliente = $3,
              product_id = $4,
              producto = $5,
              cantidad = $6,
              tipo_cambio = $7,
              precio_unitario = $8,
              importe = $9,
              lote = $10,
              tipo_cambio_costo = $11,
              costo_unitario = $12,
              utilidad_perdida = $13,
              utilidad_con_gastos = $14,
              utilidad_porcentaje = $15,
              upload_id = $16,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $17
          `, [
            tx.status,
            clientId,
            tx.cliente,
            productId,
            tx.producto,
            tx.cantidad,
            tx.tipoCambio,
            tx.precioUnitario,
            tx.importe,
            tx.lote,
            tx.tipoCambioCosto,
            tx.costoUnitario,
            tx.utilidadPerdida,
            tx.utilidadConGastos,
            tx.utilidadPorcentaje,
            uploadId,
            existingRecord[0].id
          ]);
          transaccionesActualizadas++;
        } else {
          // Insertar nuevo registro en ventas
          await sql(`
            INSERT INTO ventas (
              company_id, submodulo, client_id, cliente, product_id, producto,
              cantidad, unidad, fecha,
              folio, folio_numero, folio_secuencia, status,
              tipo_cambio, precio_unitario, importe, lote,
              tipo_cambio_costo, costo_unitario, utilidad_perdida,
              utilidad_con_gastos, utilidad_porcentaje, upload_id
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9,
              $10, $11, $12, $13,
              $14, $15, $16, $17,
              $18, $19, $20,
              $21, $22, $23
            )
          `, [
            resolvedCompanyId,
            'DI', // Por default, IDRALL es para DI
            clientId,
            tx.cliente,
            productId,
            tx.producto,
            tx.cantidad,
            'KG',
            tx.fecha.toISOString().split('T')[0],
            tx.folio,
            tx.folioNumero,
            tx.folioSecuencia,
            tx.status,
            tx.tipoCambio,
            tx.precioUnitario,
            tx.importe,
            tx.lote,
            tx.tipoCambioCosto,
            tx.costoUnitario,
            tx.utilidadPerdida,
            tx.utilidadConGastos,
            tx.utilidadPorcentaje,
            uploadId
          ]);
          transaccionesInsertadas++;
        }

      } catch (txError: any) {
        console.error(`❌ Error procesando transacción ${tx.folio}:`, txError.message);
        // Continuar con la siguiente transacción
      }
    }

    // Actualizar registro de upload con estadísticas
    await sql(`
      UPDATE sales_uploads
      SET status = 'processed',
          records_count = $1,
          notes = $2
      WHERE id = $3
    `, [
      transaccionesInsertadas + transaccionesActualizadas,
      `IDRALL: ${transaccionesInsertadas} nuevos, ${transaccionesActualizadas} actualizados. ` +
      `${clientesCreados.size} clientes nuevos, ${productosCreados.size} productos nuevos. ` +
      `${parseResult.resumen.registrosCancelados} cancelados.`,
      uploadId
    ]);

    console.log(`✅ [IDRALL Upload] Procesamiento completado:`);
    console.log(`   - Transacciones nuevas: ${transaccionesInsertadas}`);
    console.log(`   - Transacciones actualizadas: ${transaccionesActualizadas}`);
    console.log(`   - Clientes nuevos: ${clientesCreados.size}`);
    console.log(`   - Productos nuevos: ${productosCreados.size}`);

    res.json({
      success: true,
      message: 'Archivo procesado exitosamente',
      uploadId,
      recordsProcessed: transaccionesInsertadas + transaccionesActualizadas,
      stats: {
        nuevos: transaccionesInsertadas,
        actualizados: transaccionesActualizadas,
        clientesNuevos: clientesCreados.size,
        productosNuevos: productosCreados.size,
        cancelados: parseResult.resumen.registrosCancelados,
        errores: parseResult.errores.length
      },
      resumen: parseResult.resumen,
      errores: parseResult.errores.slice(0, 10)
    });

  } catch (error: any) {
    console.error('❌ [IDRALL Upload] Error:', error);

    // Marcar upload como fallido si existe
    if (uploadId) {
      await sql(`
        UPDATE sales_uploads
        SET status = 'failed', notes = $1
        WHERE id = $2
      `, [`Error: ${error.message}`, uploadId]).catch(() => {});
    }

    res.status(500).json({
      error: 'Error al procesar el archivo',
      details: error.message || 'Error interno del servidor'
    });
  }
}

/**
 * Detecta automáticamente el formato del archivo Excel
 * y decide qué parser usar
 */
export async function detectExcelFormat(workbook: any): Promise<'IDRALL' | 'LEGACY' | 'ACUM_GO_2026' | 'UNKNOWN'> {
  const worksheets = workbook.worksheets;

  if (!worksheets || worksheets.length === 0) {
    return 'UNKNOWN';
  }

  // Buscar hoja ACUMULADO 2026 (GO - VENTAS 2026.xlsx)
  const acumSheet = worksheets.find((ws: any) => {
    const name = (ws.name || '').toUpperCase();
    return name.includes('ACUMULADO') && name.includes('2026');
  });
  if (acumSheet) {
    return 'ACUM_GO_2026';
  }

  // Buscar hojas del formato legacy (VENTAS DI, RESUMEN DI, etc.)
  const legacySheets = ['VENTAS', 'VENTAS ', 'RESUMEN DI', 'VENTAS GO', 'RESUMEN GO'];
  const foundLegacySheets = worksheets.filter((ws: any) =>
    legacySheets.some(name => ws.name.toUpperCase().includes(name.toUpperCase()))
  );

  if (foundLegacySheets.length >= 2) {
    return 'LEGACY';
  }

  // Verificar si es formato IDRALL (buscar columnas características)
  const firstSheet = worksheets[0];
  if (firstSheet) {
    const headerRow = firstSheet.getRow(1);
    const headerValues: string[] = [];

    headerRow.eachCell((cell: any) => {
      if (cell.value) {
        headerValues.push(cell.value.toString().toLowerCase());
      }
    });

    // Buscar columnas típicas de IDRALL
    const idrallKeywords = ['folio', 'mid', 'status', 'cliente', 'producto', 'cantidad', 'lote'];
    const matchCount = idrallKeywords.filter(kw =>
      headerValues.some(h => h.includes(kw))
    ).length;

    if (matchCount >= 4) {
      return 'IDRALL';
    }
  }

  return 'UNKNOWN';
}

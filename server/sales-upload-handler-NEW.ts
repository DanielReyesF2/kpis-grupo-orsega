/**
 * Nuevo handler para upload de Excel de ventas
 * Procesa 4 hojas: VENTAS (DI), RESUMEN DI, VENTAS GO, RESUMEN GO
 *
 * Este archivo será integrado en routes.ts
 */

import type { Request, Response } from 'express';
import { parseExcelVentas, type SalesTransaction, type SalesResumen } from './sales-excel-parser';

// Extended Request type for authenticated routes
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
import { neon } from '@neondatabase/serverless';
import path from 'path';

// Crear cliente SQL para queries directos
const sql = neon(process.env.DATABASE_URL!);

interface UploadHandlerDependencies {
  getAuthUser: (req: AuthRequest) => any;
  ExcelJS: any;
}

/**
 * Calcular prioridad basada en diferencial de kilos
 */
function calcularPrioridad(diferencialKg: number): string {
  if (diferencialKg < -10000) return 'CRITICA';  // 🔴
  if (diferencialKg < -5000) return 'ALTA';      // 🟠
  if (diferencialKg < 0) return 'MEDIA';         // 🟡
  return 'BAJA';                                  // 🟢
}

/**
 * Handler mejorado que procesa todas las hojas del Excel
 */
export async function handleSalesUpload(
  req: Request,
  res: Response,
  deps: UploadHandlerDependencies
): Promise<void> {
  let uploadId: number | null = null;

  try {
    const { getAuthUser, ExcelJS } = deps;
    const user = getAuthUser(req as AuthRequest);
    const file = (req as any).file;
    const { companyId, periodStart, periodEnd } = req.body;

    console.log('📁 [Sales Upload] Archivo recibido:', file ? {
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

    // Determinar company_id - siempre será 1 porque el Excel contiene DI y GO
    const resolvedCompanyId = 1; // Dura International by default
    // Nota: company_id se usa para tracking, pero ahora usamos submodulo para DI vs GO

    console.log(`📊 [Sales Upload] Procesando archivo con 4 hojas...`);

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

    console.log(`📋 [Sales Upload] Hojas encontradas: ${workbook.worksheets.length}`);
    workbook.worksheets.forEach((ws: { name: string }, idx: number) => {
      console.log(`   - Hoja ${idx + 1}: "${ws.name}"`);
    });

    // Parsear las 4 hojas usando el nuevo parser
    const parsedData = await parseExcelVentas(workbook);

    // Validar que tengamos al menos algo de datos
    const totalTransacciones = parsedData.di.transacciones.length + parsedData.go.transacciones.length;
    const totalResumen = parsedData.di.resumen.length + parsedData.go.resumen.length;

    if (totalTransacciones === 0 && totalResumen === 0) {
      res.status(400).json({
        error: 'No se encontraron datos válidos',
        details: 'El archivo Excel no contiene datos de ventas en ninguna de las 4 hojas esperadas'
      });
      return;
    }

    // Crear registro de upload
    const uploadResult = await sql(`
      INSERT INTO sales_uploads (
        company_id, uploaded_by, file_name, file_url, file_size,
        period_start, period_end, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'processing')
      RETURNING id
    `, [
      resolvedCompanyId,
      user.id,
      file.originalname,
      `/uploads/sales/${path.basename(file.path)}`,
      file.size,
      periodStart || null,
      periodEnd || null
    ]);

    uploadId = uploadResult[0].id;
    console.log(`📝 [Sales Upload] Registro de upload creado: ID ${uploadId}`);

    // ========== PROCESAR TRANSACCIONES ==========

    console.log(`💾 [Sales Upload] Insertando transacciones...`);
    let transaccionesInsertadas = 0;

    // Procesar transacciones DI
    for (const tx of parsedData.di.transacciones) {
      // Buscar client_id (DI usa company_id 1)
      const clientResult = await sql(`
        SELECT id FROM clients
        WHERE company_id = 1 AND LOWER(name) = LOWER($1)
        LIMIT 1
      `, [tx.cliente]);
      const clientId = clientResult[0]?.id || null;

      // Buscar o crear product_id
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

      // Calcular semana
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
        1, // company_id: DI
        'DI', // submodulo
        clientId,
        tx.cliente,
        productId,
        tx.producto,
        tx.cantidad,
        'KG',
        tx.fecha.toISOString().split('T')[0],
        tx.mes,
        tx.año,
        saleWeek,
        tx.folio,
        tx.folio,
        tx.precioUnitario,
        tx.importe,
        uploadId
      ]);

      transaccionesInsertadas++;
    }

    // Procesar transacciones GO
    for (const tx of parsedData.go.transacciones) {
      // Buscar client_id (GO usa company_id 2)
      const clientResult = await sql(`
        SELECT id FROM clients
        WHERE company_id = 2 AND LOWER(name) = LOWER($1)
        LIMIT 1
      `, [tx.cliente]);
      const clientId = clientResult[0]?.id || null;

      // Buscar o crear product_id con familia
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

      // Calcular semana
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
        2, // company_id: GO
        'GO', // submodulo
        clientId,
        tx.cliente,
        productId,
        tx.producto,
        tx.cantidad,
        'unidades',
        tx.fecha.toISOString().split('T')[0],
        tx.mes,
        tx.año,
        saleWeek,
        tx.folio,
        tx.importe,
        tx.tipoCambio,
        tx.importeMN,
        uploadId
      ]);

      transaccionesInsertadas++;
    }

    console.log(`✅ ${transaccionesInsertadas} transacciones insertadas`);

    // ========== PROCESAR RESÚMENES Y CREAR ACCIONES ==========

    console.log(`📋 [Sales Upload] Creando acciones desde resúmenes...`);
    let accionesCreadas = 0;

    // Procesar resumen DI
    for (const resumen of parsedData.di.resumen) {
      // Solo crear acción si hay texto en el campo acción y existe diferencial negativo
      if (resumen.accion && resumen.accion.trim() !== '') {
        // Buscar client_id
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
          clientId,
          resumen.cliente,
          'DI',
          resumen.accion,
          prioridad,
          'PENDIENTE',
          resumen.responsable,
          resumen.diferencial,
          resumen.kilos2024,
          resumen.kilos2025,
          resumen.usd2025,
          resumen.utilidad,
          uploadId
        ]);

        accionesCreadas++;
      }
    }

    // Procesar resumen GO
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
          clientId,
          resumen.cliente,
          'GO',
          resumen.accion,
          prioridad,
          'PENDIENTE',
          resumen.responsable,
          resumen.diferencial,
          resumen.kilos2024,
          resumen.kilos2025,
          uploadId
        ]);

        accionesCreadas++;
      }
    }

    console.log(`✅ ${accionesCreadas} acciones creadas`);

    // Actualizar el registro de upload
    await sql(`
      UPDATE sales_uploads
      SET status = 'processed', records_count = $1
      WHERE id = $2
    `, [transaccionesInsertadas, uploadId]);

    console.log(`✅ [Sales Upload] Upload completado exitosamente`);

    res.json({
      success: true,
      message: 'Archivo procesado exitosamente',
      uploadId,
      recordsProcessed: transaccionesInsertadas,
      accionesCreadas,
      resumen: {
        di: {
          transacciones: parsedData.di.transacciones.length,
          clientes: parsedData.di.resumen.length
        },
        go: {
          transacciones: parsedData.go.transacciones.length,
          clientes: parsedData.go.resumen.length
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [Sales Upload] Error:', error);

    // Actualizar status del upload a error si existe
    if (uploadId) {
      try {
        await sql(`
          UPDATE sales_uploads
          SET status = 'error', notes = $1
          WHERE id = $2
        `, [error.message || 'Error desconocido', uploadId]);
      } catch (updateError) {
        console.error('Error actualizando status del upload:', updateError);
      }
    }

    res.status(500).json({
      error: 'Error al procesar el archivo',
      details: error.message || 'Error desconocido al procesar el archivo Excel'
    });
  }
}

/**
 * Handler para upload de Excel de ventas formato 2026
 * Procesa archivos con hojas por mes (ENERO 2026, FEBRERO 2026, etc.)
 * Soporta tanto DI (Dura) como GO (Orsega) detectando automáticamente
 */

import type { Request, Response } from 'express';
import type { Workbook } from 'exceljs';
import {
  parseVentas2026Acumulado,
  detectCompanyFormat,
  buildDedupKey,
  type VentasTransaction
} from './sales-ventas-2026-parser';
import { neon } from '@neondatabase/serverless';
import path from 'path';

const sql = neon(process.env.DATABASE_URL!);

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
  workbook?: Workbook; // Workbook ya leído (opcional)
}

/**
 * Handler para el nuevo formato VENTAS 2026 (hojas por mes)
 */
export async function handleVentas2026Upload(
  req: Request,
  res: Response,
  deps: UploadHandlerDependencies
): Promise<void> {
  let uploadId: number | null = null;

  try {
    const { getAuthUser, ExcelJS, workbook: preloadedWorkbook } = deps;
    const user = getAuthUser(req as AuthRequest);
    const file = (req as any).file;
    const { companyId: bodyCompanyId, periodStart, periodEnd } = req.body;

    console.log('📁 [Ventas2026 Upload] Archivo recibido:', file ? {
      originalname: file.originalname,
      size: file.size
    } : 'null');

    if (!file) {
      res.status(400).json({
        error: 'No se subió ningún archivo',
        details: 'Asegúrate de seleccionar un archivo Excel antes de subirlo'
      });
      return;
    }

    // Usar workbook pre-cargado o leer de nuevo
    let workbook: Workbook;
    if (preloadedWorkbook) {
      workbook = preloadedWorkbook;
    } else {
      workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);
    }

    // Detectar formato (DI o GO)
    const companyFormat = detectCompanyFormat(workbook);
    console.log(`🏢 [Ventas2026 Upload] Formato de empresa: ${companyFormat}`);

    // Determinar company_id
    // DI = company_id 1 (Dura International)
    // GO = company_id 2 (Grupo Orsega)
    let resolvedCompanyId: number;
    let submodulo: 'DI' | 'GO';

    if (companyFormat === 'DI') {
      resolvedCompanyId = 1;
      submodulo = 'DI';
    } else if (companyFormat === 'GO') {
      resolvedCompanyId = 2;
      submodulo = 'GO';
    } else {
      // Usar valor del body o inferir del nombre del archivo
      const filename = file.originalname.toUpperCase();
      if (filename.includes('GO') || filename.includes('ORSEGA')) {
        resolvedCompanyId = 2;
        submodulo = 'GO';
      } else {
        resolvedCompanyId = 1;
        submodulo = 'DI';
      }
    }

    console.log(`📊 [Ventas2026 Upload] Company ID: ${resolvedCompanyId}, Submodulo: ${submodulo}`);

    // Parsear el archivo usando SIEMPRE la hoja ACUMULADO
    const parsedData = await parseVentas2026Acumulado(workbook);

    if (parsedData.transactions.length === 0) {
      res.status(400).json({
        error: 'No se encontraron datos válidos',
        details: `El archivo Excel no contiene datos de ventas en la hoja ACUMULADO. Hojas encontradas: ${parsedData.monthsFound.join(', ') || 'ninguna'}`,
        errors: parsedData.errors
      });
      return;
    }

    console.log(`📋 [Ventas2026 Upload] ${parsedData.transactions.length} transacciones parseadas`);
    console.log(`   Fuente: ${parsedData.monthsFound.join(', ')}`);

    // ========== DEDUPLICACIÓN INTELIGENTE ==========
    // Estrategia: Cargar claves existentes y filtrar solo las nuevas
    // Clave única: folio|fecha|producto|cantidad

    console.log(`🔍 [Ventas2026 Upload] Cargando transacciones existentes para deduplicación...`);

    // Cargar claves existentes de BD (solo del año 2026 para optimizar)
    const existingKeysResult = await sql(`
      SELECT
        LOWER(TRIM(COALESCE(folio, ''))) || '|' ||
        fecha::TEXT || '|' ||
        LOWER(TRIM(COALESCE(producto, ''))) || '|' ||
        ROUND(cantidad::NUMERIC, 2)::TEXT as dedup_key
      FROM ventas
      WHERE company_id = $1
        AND submodulo = $2
        AND anio = 2026
    `, [resolvedCompanyId, submodulo]);

    const existingSet = new Set(existingKeysResult.map((r: any) => r.dedup_key));
    console.log(`   📊 ${existingSet.size} transacciones existentes en BD`);

    // Filtrar solo transacciones nuevas
    const nuevasTransacciones: VentasTransaction[] = [];
    let yaExistian = 0;

    for (const tx of parsedData.transactions) {
      const key = buildDedupKey(tx);
      if (existingSet.has(key)) {
        yaExistian++;
      } else {
        nuevasTransacciones.push(tx);
      }
    }

    console.log(`📊 [Ventas2026 Upload] Resumen de deduplicación:`);
    console.log(`   📥 Total en Excel: ${parsedData.transactions.length}`);
    console.log(`   ✅ Ya existen en BD: ${yaExistian}`);
    console.log(`   🆕 Nuevas a insertar: ${nuevasTransacciones.length}`);

    // Si no hay nada nuevo, responder temprano
    if (nuevasTransacciones.length === 0) {
      res.json({
        success: true,
        uploadId: null,
        message: 'No hay transacciones nuevas para insertar',
        details: {
          format: 'VENTAS_2026',
          company: submodulo === 'DI' ? 'Dura International' : 'Grupo Orsega',
          companyId: resolvedCompanyId,
          source: parsedData.monthsFound,
          totalEnExcel: parsedData.transactions.length,
          yaExistian,
          nuevasInsertadas: 0
        }
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
    console.log(`📝 [Ventas2026 Upload] Registro de upload creado: ID ${uploadId}`);

    // ========== INSERTAR SOLO TRANSACCIONES NUEVAS ==========

    console.log(`💾 [Ventas2026 Upload] Insertando ${nuevasTransacciones.length} transacciones nuevas...`);
    let transaccionesInsertadas = 0;
    let erroresInsercion = 0;

    for (const tx of nuevasTransacciones) {
      try {
        // Buscar client_id
        const clientResult = await sql(`
          SELECT id FROM clients
          WHERE company_id = $1 AND LOWER(name) = LOWER($2)
          LIMIT 1
        `, [resolvedCompanyId, tx.cliente]);
        const clientId = clientResult[0]?.id || null;

        // Buscar o crear product_id
        let productId = null;
        const productResult = await sql(`
          SELECT id FROM products
          WHERE company_id = $1 AND LOWER(name) = LOWER($2)
          LIMIT 1
        `, [resolvedCompanyId, tx.producto]);

        if (productResult[0]) {
          productId = productResult[0].id;
        } else {
          // Crear producto si no existe
          const newProduct = await sql(`
            INSERT INTO products (company_id, name, is_active)
            VALUES ($1, $2, true)
            ON CONFLICT DO NOTHING
            RETURNING id
          `, [resolvedCompanyId, tx.producto]);

          if (newProduct[0]) {
            productId = newProduct[0].id;
          }
        }

        // Insertar venta
        // mes y anio son GENERATED ALWAYS desde fecha en la tabla ventas
        await sql(`
          INSERT INTO ventas (
            company_id, submodulo, client_id, cliente, product_id, producto,
            cantidad, unidad, fecha,
            factura, folio, precio_unitario, importe,
            tipo_cambio, familia_producto, upload_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `, [
          resolvedCompanyId,
          submodulo,
          clientId,
          tx.cliente,
          productId,
          tx.producto,
          tx.cantidad,
          tx.unidad || 'KG',
          tx.fecha.toISOString().split('T')[0],
          tx.folio, // factura
          tx.folio, // folio
          tx.precioUnitario,
          tx.importe,
          tx.tipoCambio,
          tx.familiaProducto,
          uploadId
        ]);

        transaccionesInsertadas++;
      } catch (error: any) {
        erroresInsercion++;
        console.error(`   ❌ Error insertando transacción: ${error.message}`);
      }
    }

    console.log(`✅ [Ventas2026 Upload] ${transaccionesInsertadas} transacciones insertadas`);
    if (erroresInsercion > 0) {
      console.log(`⚠️ [Ventas2026 Upload] ${erroresInsercion} errores de inserción`);
    }

    // Actualizar estado del upload
    await sql(`
      UPDATE sales_uploads
      SET status = 'processed',
          records_count = $2,
          notes = $3
      WHERE id = $1
    `, [uploadId, transaccionesInsertadas, `Ventas 2026: ${transaccionesInsertadas} nuevas, ${erroresInsercion} errores`]);

    // Responder con información detallada de deduplicación
    res.json({
      success: true,
      uploadId,
      message: nuevasTransacciones.length === transaccionesInsertadas
        ? `${transaccionesInsertadas} transacciones nuevas insertadas`
        : `${transaccionesInsertadas} insertadas de ${nuevasTransacciones.length} nuevas`,
      details: {
        format: 'VENTAS_2026',
        company: submodulo === 'DI' ? 'Dura International' : 'Grupo Orsega',
        companyId: resolvedCompanyId,
        source: parsedData.monthsFound,
        totalEnExcel: parsedData.transactions.length,
        yaExistian,
        nuevasInsertadas: transaccionesInsertadas,
        erroresInsercion,
        parserErrors: parsedData.errors
      }
    });

  } catch (error: any) {
    console.error('❌ [Ventas2026 Upload] Error:', error.message);

    // Marcar upload como fallido si existe
    if (uploadId) {
      try {
        await sql(`
          UPDATE sales_uploads
          SET status = 'failed',
              notes = $2
          WHERE id = $1
        `, [uploadId, `Error: ${error.message}`]);
      } catch {
        // Ignorar error de actualización
      }
    }

    res.status(500).json({
      error: 'Error al procesar archivo',
      details: error.message
    });
  }
}

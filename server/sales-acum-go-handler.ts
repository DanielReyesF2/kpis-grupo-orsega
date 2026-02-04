/**
 * Handler para upload de Excel con hoja "ACUMULADO 2026" (GO - VENTAS 2026.xlsx)
 * Inserta en sales_data con company_id=2 (Grupo Orsega), submodulo GO.
 */

import type { Request, Response } from 'express';
import { neon } from '@neondatabase/serverless';
import path from 'path';
import { parseAcumGO2026 } from './sales-acum-go-parser';

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
}

export async function handleACUMGO2026Upload(
  req: Request,
  res: Response,
  deps: UploadHandlerDependencies
): Promise<void> {
  let uploadId: number | null = null;

  try {
    const { getAuthUser, ExcelJS } = deps;
    const user = getAuthUser(req as AuthRequest);
    const file = (req as any).file;

    if (!file) {
      res.status(400).json({
        error: 'No se subió ningún archivo',
        details: 'Asegúrate de seleccionar un archivo Excel antes de subirlo',
      });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);

    const parseResult = await parseAcumGO2026(workbook);

    if (parseResult.transacciones.length === 0) {
      res.status(400).json({
        error: 'No se encontraron transacciones válidas',
        details: parseResult.errores[0]?.error || 'Revisa la hoja ACUMULADO 2026 y las columnas Cliente, Producto, Cantidad.',
        resumen: parseResult.resumen,
      });
      return;
    }

    const uploadResult = await sql(`
      INSERT INTO sales_uploads (
        company_id, uploaded_by, file_name, file_url, file_size,
        period_start, period_end, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'processing', $8)
      RETURNING id
    `, [
      2,
      user.id,
      file.originalname,
      `/uploads/sales/${path.basename(file.path)}`,
      file.size,
      parseResult.resumen.rangoFechas.desde?.toISOString().split('T')[0] ?? null,
      parseResult.resumen.rangoFechas.hasta?.toISOString().split('T')[0] ?? null,
      `ACUM GO 2026: ${parseResult.transacciones.length} transacciones. Excluidas canceladas: ${parseResult.resumen.excluidasCanceladas}, NACIONALES: ${parseResult.resumen.excluidasNacionales}.`,
    ]);

    uploadId = uploadResult[0].id;

    let transaccionesInsertadas = 0;
    const clientesCreados = new Set<string>();
    const productosCreados = new Set<string>();

    for (const tx of parseResult.transacciones) {
      try {
        let clientId: number | null = null;
        const clientResult = await sql(`
          SELECT id FROM clients
          WHERE company_id = 2 AND LOWER(name) = LOWER($1)
          LIMIT 1
        `, [tx.cliente]);

        if (clientResult[0]) {
          clientId = clientResult[0].id;
        } else {
          const newClient = await sql(`
            INSERT INTO clients (company_id, name, is_active, created_at)
            VALUES (2, $1, true, CURRENT_TIMESTAMP)
            RETURNING id
          `, [tx.cliente]);
          if (newClient[0]) {
            clientId = newClient[0].id;
            clientesCreados.add(tx.cliente);
          }
        }

        let productId: number | null = null;
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
            VALUES (2, $1, $2, $3, true)
            RETURNING id
          `, [tx.producto, tx.familiaProducto ?? null, tx.unidad ?? 'unidades']);
          if (newProduct[0]) {
            productId = newProduct[0].id;
            productosCreados.add(tx.producto);
          }
        }

        const fecha = new Date(tx.fecha);
        const d = new Date(Date.UTC(tx.año, tx.mes - 1, fecha.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const saleWeek = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

        const totalAmount = tx.importeMN ?? tx.usd ?? 0;

        await sql(`
          INSERT INTO sales_data (
            company_id, submodulo, client_id, client_name, product_id, product_name,
            quantity, unit, sale_date, sale_month, sale_year, sale_week,
            invoice_number, folio, total_amount, tipo_cambio, importe_mn, upload_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          2,
          'GO',
          clientId,
          tx.cliente,
          productId,
          tx.producto,
          tx.cantidad,
          tx.unidad ?? 'unidades',
          tx.fecha.toISOString().split('T')[0],
          tx.mes,
          tx.año,
          saleWeek,
          tx.folio,
          tx.folio,
          totalAmount,
          tx.tipoCambio,
          tx.importeMN,
          uploadId,
        ]);

        transaccionesInsertadas++;
      } catch (txError: any) {
        console.error(`❌ Error procesando transacción ${tx.folio}:`, txError.message);
      }
    }

    await sql(`
      UPDATE sales_uploads
      SET status = 'processed',
          records_count = $1,
          notes = $2
      WHERE id = $3
    `, [
      transaccionesInsertadas,
      `ACUM GO 2026: ${transaccionesInsertadas} insertados. Clientes nuevos: ${clientesCreados.size}, productos nuevos: ${productosCreados.size}.`,
      uploadId,
    ]);

    res.json({
      success: true,
      message: 'Archivo ACUMULADO 2026 procesado correctamente',
      uploadId,
      recordsProcessed: transaccionesInsertadas,
      stats: {
        nuevos: transaccionesInsertadas,
        clientesNuevos: clientesCreados.size,
        productosNuevos: productosCreados.size,
        excluidasCanceladas: parseResult.resumen.excluidasCanceladas,
        excluidasNacionales: parseResult.resumen.excluidasNacionales,
      },
      resumen: parseResult.resumen,
      errores: parseResult.errores.slice(0, 10),
    });
  } catch (error: any) {
    console.error('❌ [ACUM GO 2026] Error:', error);

    if (uploadId) {
      await sql(`
        UPDATE sales_uploads
        SET status = 'failed', notes = $1
        WHERE id = $2
      `, [`Error: ${error.message}`, uploadId]).catch(() => {});
    }

    res.status(500).json({
      error: 'Error al procesar el archivo ACUMULADO 2026',
      details: error.message || 'Error interno del servidor',
    });
  }
}

import { Router } from 'express';
import { z } from 'zod';
import { sql, getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware } from '../auth';

const router = Router();

// ============================================================================
// SALES ACTIONS API - Gestion de Acciones de Ventas (FASE 2)
// ============================================================================

// GET /api/sales/acciones - Obtener acciones con filtros
router.get("/api/sales/acciones", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { submodulo, responsable, estado, prioridad, limit = '100', offset = '0' } = req.query;

    // Construir query dinamico con filtros
    const filters: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Filtro por submodulo
    if (submodulo) {
      filters.push(`submodulo = $${paramIndex}`);
      params.push(submodulo);
      paramIndex++;
    }

    // Filtro por responsable (busqueda parcial, ej: "ON" match "ON/EDV")
    if (responsable) {
      filters.push(`responsables LIKE $${paramIndex}`);
      params.push(`%${responsable}%`);
      paramIndex++;
    }

    // Filtro por estado
    if (estado) {
      filters.push(`estado = $${paramIndex}`);
      params.push(estado);
      paramIndex++;
    }

    // Filtro por prioridad
    if (prioridad) {
      filters.push(`prioridad = $${paramIndex}`);
      params.push(prioridad);
      paramIndex++;
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    // Agregar limit y offset
    params.push(parseInt(limit as string));
    const limitParam = `$${paramIndex}`;
    paramIndex++;
    params.push(parseInt(offset as string));
    const offsetParam = `$${paramIndex}`;

    const acciones = await sql(`
      SELECT
        id, cliente_id, cliente_nombre, submodulo, descripcion, prioridad, estado,
        responsables, diferencial, kilos_2024, kilos_2025, usd_2025, utilidad,
        fecha_creacion, fecha_limite, fecha_completado, notas, excel_origen_id,
        created_at, updated_at
      FROM sales_acciones
      ${whereClause}
      ORDER BY
        CASE prioridad
          WHEN 'CRITICA' THEN 1
          WHEN 'ALTA' THEN 2
          WHEN 'MEDIA' THEN 3
          WHEN 'BAJA' THEN 4
        END,
        created_at DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `, params);

    // Contar total para paginacion
    const countResult = await sql(`
      SELECT COUNT(*) as total
      FROM sales_acciones
      ${whereClause}
    `, params.slice(0, -2)); // Remover limit y offset del count

    res.json({
      acciones,
      total: parseInt(countResult[0].total),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('[GET /api/sales/acciones] Error:', error);
    res.status(500).json({
      error: 'Error al obtener acciones',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/sales/acciones/mias - Obtener mis acciones (del usuario logueado)
router.get("/api/sales/acciones/mias", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { estado, prioridad } = req.query;

    if (!user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Obtener codigo del responsable desde el usuario
    // Asumimos que el codigo esta en user.responsableCode o similar
    // Por ahora usamos el nombre del usuario para buscar en sales_responsables
    const responsableResult = await sql(`
      SELECT codigo FROM sales_responsables
      WHERE LOWER(nombre) LIKE LOWER($1) OR email = $2
      LIMIT 1
    `, [`%${user.name}%`, user.email]);

    if (responsableResult.length === 0) {
      return res.json({
        acciones: [],
        message: 'No se encontro un codigo de responsable para este usuario'
      });
    }

    const codigoResponsable = responsableResult[0].codigo;

    // Construir filtros
    const filters: string[] = [`responsables LIKE $1`];
    const params: any[] = [`%${codigoResponsable}%`];
    let paramIndex = 2;

    if (estado) {
      filters.push(`estado = $${paramIndex}`);
      params.push(estado);
      paramIndex++;
    }

    if (prioridad) {
      filters.push(`prioridad = $${paramIndex}`);
      params.push(prioridad);
      paramIndex++;
    }

    const acciones = await sql(`
      SELECT
        id, cliente_id, cliente_nombre, submodulo, descripcion, prioridad, estado,
        responsables, diferencial, kilos_2024, kilos_2025, usd_2025, utilidad,
        fecha_creacion, fecha_limite, fecha_completado, notas,
        created_at, updated_at
      FROM sales_acciones
      WHERE ${filters.join(' AND ')}
      ORDER BY
        CASE prioridad
          WHEN 'CRITICA' THEN 1
          WHEN 'ALTA' THEN 2
          WHEN 'MEDIA' THEN 3
          WHEN 'BAJA' THEN 4
        END,
        CASE estado
          WHEN 'EN_PROGRESO' THEN 1
          WHEN 'PENDIENTE' THEN 2
          WHEN 'COMPLETADO' THEN 3
          WHEN 'CANCELADO' THEN 4
        END,
        created_at DESC
    `, params);

    res.json({
      acciones,
      responsable: {
        codigo: codigoResponsable,
        nombre: user.name
      },
      total: acciones.length
    });
  } catch (error) {
    console.error('[GET /api/sales/acciones/mias] Error:', error);
    res.status(500).json({
      error: 'Error al obtener mis acciones',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// PATCH /api/sales/acciones/:id - Actualizar una accion
router.patch("/api/sales/acciones/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { id } = req.params;
    const { estado, notas, fecha_limite, prioridad } = req.body;

    if (!user) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Obtener accion actual
    const accionActual = await sql(`
      SELECT * FROM sales_acciones WHERE id = $1
    `, [parseInt(id)]);

    if (accionActual.length === 0) {
      return res.status(404).json({ error: 'Accion no encontrada' });
    }

    const accion = accionActual[0];

    // Construir update dinamico
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (estado !== undefined) {
      updates.push(`estado = $${paramIndex}`);
      params.push(estado);
      paramIndex++;

      // Si se marca como COMPLETADO, agregar fecha_completado
      if (estado === 'COMPLETADO') {
        updates.push(`fecha_completado = CURRENT_TIMESTAMP`);
      }
    }

    if (notas !== undefined) {
      updates.push(`notas = $${paramIndex}`);
      params.push(notas);
      paramIndex++;
    }

    if (fecha_limite !== undefined) {
      updates.push(`fecha_limite = $${paramIndex}`);
      params.push(fecha_limite);
      paramIndex++;
    }

    if (prioridad !== undefined) {
      updates.push(`prioridad = $${paramIndex}`);
      params.push(prioridad);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No se proporcionaron campos para actualizar' });
    }

    // Agregar updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Agregar ID al final de params
    params.push(parseInt(id));
    const idParam = `$${paramIndex}`;

    // Ejecutar update
    await sql(`
      UPDATE sales_acciones
      SET ${updates.join(', ')}
      WHERE id = ${idParam}
    `, params);

    // Crear historial de cambios
    const cambios = [];
    if (estado !== undefined && estado !== accion.estado) {
      await sql(`
        INSERT INTO sales_acciones_historial (accion_id, campo_modificado, valor_anterior, valor_nuevo, usuario_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [parseInt(id), 'estado', accion.estado, estado, user.id]);
      cambios.push({ campo: 'estado', anterior: accion.estado, nuevo: estado });
    }

    if (prioridad !== undefined && prioridad !== accion.prioridad) {
      await sql(`
        INSERT INTO sales_acciones_historial (accion_id, campo_modificado, valor_anterior, valor_nuevo, usuario_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [parseInt(id), 'prioridad', accion.prioridad, prioridad, user.id]);
      cambios.push({ campo: 'prioridad', anterior: accion.prioridad, nuevo: prioridad });
    }

    if (notas !== undefined && notas !== accion.notas) {
      await sql(`
        INSERT INTO sales_acciones_historial (accion_id, campo_modificado, valor_anterior, valor_nuevo, usuario_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [parseInt(id), 'notas', accion.notas || '', notas, user.id]);
      cambios.push({ campo: 'notas', anterior: accion.notas, nuevo: notas });
    }

    // Obtener accion actualizada
    const accionActualizada = await sql(`
      SELECT * FROM sales_acciones WHERE id = $1
    `, [parseInt(id)]);

    res.json({
      success: true,
      accion: accionActualizada[0],
      cambios,
      message: 'Accion actualizada correctamente'
    });
  } catch (error) {
    console.error('[PATCH /api/sales/acciones/:id] Error:', error);
    res.status(500).json({
      error: 'Error al actualizar accion',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/sales/acciones/:id/historial - Obtener historial de cambios de una accion
router.get("/api/sales/acciones/:id/historial", jwtAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const historial = await sql(`
      SELECT
        h.id,
        h.accion_id,
        h.campo_modificado,
        h.valor_anterior,
        h.valor_nuevo,
        h.created_at,
        u.name as usuario_nombre,
        u.email as usuario_email
      FROM sales_acciones_historial h
      LEFT JOIN users u ON h.usuario_id = u.id
      WHERE h.accion_id = $1
      ORDER BY h.created_at DESC
    `, [parseInt(id)]);

    res.json({
      historial,
      total: historial.length
    });
  } catch (error) {
    console.error('[GET /api/sales/acciones/:id/historial] Error:', error);
    res.status(500).json({
      error: 'Error al obtener historial',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

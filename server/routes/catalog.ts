import { Router } from 'express';
import { storage } from '../storage';
import { sql, getAuthUser, type AuthRequest } from './_helpers';
import { jwtAuthMiddleware } from '../auth';
import { insertClientSchema, insertProviderSchema } from '@shared/schema';
import { validateTenantFromBody } from '../middleware/tenant-validation';
import { z } from 'zod';

const router = Router();

// GET /api/clients-db - Obtener clientes desde la base de datos
router.get("/api/clients-db", jwtAuthMiddleware, async (req, res) => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user;
    const { companyId, search } = req.query;

    let whereClause = "WHERE is_active = true";
    const params: any[] = [];
    let paramIndex = 1;

    // Security: Multi-tenant filtering (admins can see all companies)
    if (user?.role !== 'admin') {
      // Non-admin users only see clients from their company
      if (user?.companyId) {
        whereClause += ` AND company_id = $${paramIndex}`;
        params.push(user.companyId);
        paramIndex++;
      } else {
        // User without company cannot see any clients
        return res.json([]);
      }
    } else if (companyId) {
      // Admins can filter by specific company if they want
      whereClause += ` AND company_id = $${paramIndex}`;
      params.push(parseInt(companyId as string));
      paramIndex++;
    }

    if (search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR client_code ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const result = await sql(`
      SELECT
        id, name, email, phone, contact_person, company, address,
        company_id as "companyId", client_code as "clientCode", city, state, postal_code, country,
        requires_receipt as "requiresReceipt", email_notifications as "emailNotifications", customer_type as "customerType",
        payment_terms as "paymentTerms", is_active as "isActive", created_at as "createdAt"
      FROM clients
      ${whereClause}
      ORDER BY name
    `, params);

    res.json(result);
  } catch (error) {
    console.error('Error fetching clients from database:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// GET /api/clients-db/:id - Obtener cliente específico
router.get("/api/clients-db/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);

    const result = await sql(`
      SELECT
        id, name, email, phone, contact_person, company, address,
        company_id as "companyId", client_code as "clientCode", city, state, postal_code, country,
        requires_receipt as "requiresReceipt", email_notifications as "emailNotifications", customer_type as "customerType",
        payment_terms as "paymentTerms", is_active as "isActive", notes, created_at as "createdAt", updated_at as "updatedAt"
      FROM clients
      WHERE id = $1 AND is_active = true
    `, [clientId]);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

// GET /api/clients - Alias para LogisticsPage (retorna clientes activos)
router.get("/api/clients", jwtAuthMiddleware, async (req, res) => {
  try {
    const result = await sql(`
      SELECT
        id, name, email, phone, contact_person as contact_name,
        address as billing_addr, address as shipping_addr,
        client_code as rfc, is_active, company_id,
        email_notifications
      FROM clients
      WHERE is_active = true
      ORDER BY name
    `);

    res.json(result);
  } catch (error) {
    console.error('Error fetching clients for logistics:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// GET /api/products - Obtener productos activos
router.get("/api/products", jwtAuthMiddleware, async (req, res) => {
  try {
    const { companyId } = req.query;
    console.log(`🔵 [GET /api/products] companyId recibido:`, companyId);

    let whereClause = "WHERE is_active = true";
    const params: any[] = [];

    if (companyId) {
      const companyIdNum = parseInt(companyId as string);
      whereClause += " AND company_id = $1";
      params.push(companyIdNum);
      console.log(`🔵 [GET /api/products] Filtrando por company_id = ${companyIdNum}`);
    } else {
      console.log(`⚠️  [GET /api/products] No se recibió companyId, retornando todos los productos activos`);
    }

    const result = await sql(`
      SELECT id, name, company_id, is_active
      FROM products
      ${whereClause}
      ORDER BY name
    `, params);

    console.log(`📊 [GET /api/products] Retornando ${result.length} productos`);
    res.json(result);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// POST /api/products - Crear nuevo producto
router.post("/api/products", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const { name, companyId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre del producto es requerido' });
    }

    // Verificar que no exista un producto con el mismo nombre para la misma compañía
    const existing = await sql(`
      SELECT id FROM products
      WHERE LOWER(name) = LOWER($1) AND company_id = $2 AND is_active = true
    `, [name.trim(), companyId || null]);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ya existe un producto con ese nombre' });
    }

    const result = await sql(`
      INSERT INTO products (name, company_id, is_active, created_at, updated_at)
      VALUES ($1, $2, true, NOW(), NOW())
      RETURNING id, name, company_id, is_active
    `, [name.trim(), companyId || null]);

    console.log(`✅ [POST /api/products] Producto creado por ${user.name}:`, result[0]);
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('[POST /api/products] Error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id - Actualizar producto
router.put("/api/products/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const id = parseInt(req.params.id);
    const { name, is_active, companyId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre del producto es requerido' });
    }

    // Verificar que no exista otro producto con el mismo nombre
    const existing = await sql(`
      SELECT id FROM products
      WHERE LOWER(name) = LOWER($1) AND company_id = $2 AND id != $3 AND is_active = true
    `, [name.trim(), companyId || null, id]);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ya existe otro producto con ese nombre' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (companyId !== undefined) {
      updates.push(`company_id = $${paramIndex++}`);
      values.push(companyId === '' || companyId === null ? null : companyId);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id); // El id va al final para el WHERE

    const result = await sql(`
      UPDATE products
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, company_id, is_active
    `, values);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    console.log(`✅ [PUT /api/products/${id}] Producto actualizado por ${user.name}`);
    res.json(result[0]);
  } catch (error) {
    console.error(`[PUT /api/products/:id] Error:`, error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id - Eliminar producto (soft delete)
router.delete("/api/products/:id", jwtAuthMiddleware, async (req, res) => {
  try {
    const user = getAuthUser(req as AuthRequest);
    const id = parseInt(req.params.id);

    const result = await sql(`
      UPDATE products
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING id, name
    `, [id]);

    if (result.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    console.log(`✅ [DELETE /api/products/${id}] Producto desactivado por ${user.name}:`, result[0].name);
    res.json({ success: true, message: 'Producto eliminado exitosamente' });
  } catch (error) {
    console.error(`[DELETE /api/products/:id] Error:`, error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// POST /api/clients - Crear un nuevo cliente
router.post("/api/clients", jwtAuthMiddleware, validateTenantFromBody('companyId') as any, async (req, res) => {
  try {
    const validatedData = insertClientSchema.parse(req.body);

    const result = await sql(`
      INSERT INTO clients (
        name, email, phone, contact_person, company, address,
        payment_terms, requires_receipt, reminder_frequency, is_active,
        notes, company_id, client_code, secondary_email, city, state,
        postal_code, country, email_notifications, customer_type
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      RETURNING *
    `, [
      validatedData.name,
      validatedData.email || null,
      validatedData.phone || null,
      validatedData.contactPerson || null,
      validatedData.company || null,
      validatedData.address || null,
      validatedData.paymentTerms || null,
      validatedData.requiresReceipt ?? true,
      validatedData.reminderFrequency || null,
      validatedData.isActive ?? true,
      validatedData.notes || null,
      validatedData.companyId || null,
      validatedData.clientCode || null,
      validatedData.secondaryEmail || null,
      validatedData.city || null,
      validatedData.state || null,
      validatedData.postalCode || null,
      validatedData.country || 'México',
      validatedData.emailNotifications ?? true,
      validatedData.customerType || null,
    ]);

    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating client:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validación fallida', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create client' });
  }
});

export default router;

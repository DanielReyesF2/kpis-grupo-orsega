import { Router, Request } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { sql } from './db-logistics.js'
import { createClientSchema, updateClientSchema, createProviderSchema, updateProviderSchema, createProviderChannelSchema } from '../shared/logistics-schema.js'
import { insertSupplierSchema } from '../shared/schema.js'

// Tenant validation middleware - VUL-001 fix
import { validateTenantFromBody, validateTenantAccess } from './middleware/tenant-validation.js'

// Extended Request type for authenticated routes
interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
    email: string;
    name: string;
    areaId?: number | null;
    companyId?: number | null;
  };
}

export const catalogRouter = Router()

// CLIENTS
catalogRouter.get('/clients', async (req, res) => {
  try {
    const companyIdParam = req.query.companyId ? Number(req.query.companyId) : undefined;
    console.log(`🔵 [GET /clients] Endpoint llamado, companyId=${companyIdParam ?? 'ALL'}`);

    let whereClause = 'WHERE c.is_active = TRUE';
    const params: any[] = [];

    if (companyIdParam) {
      whereClause += ' AND c.company_id = $1';
      params.push(companyIdParam);
    }

    const result = await sql(`
      SELECT c.id, c.code, c.name, c.contact, c.email, c.company_id, c.is_active, c.notes, c.created_at, c.updated_at,
             comp.name as company_name
      FROM clients c
      LEFT JOIN companies comp ON c.company_id = comp.id
      ${whereClause}
      ORDER BY c.name
    `, params)
    console.log(`📊 [GET /clients] Retornando ${result.rows.length} clientes`);
    res.json(result.rows)
  } catch (error) {
    console.error('❌ Error fetching clients:', error)
    res.status(500).json({ error: 'Failed to fetch clients' })
  }
})

catalogRouter.post('/clients', validateTenantFromBody('companyId') as any, async (req, res) => {
  try {
    console.log('🔵 [POST /clients] Creando nuevo cliente');
    console.log('📥 Request body:', JSON.stringify(req.body, null, 2));
    
    // Verificar usuario autenticado
    const authReq = req as AuthRequest;
    const user = authReq.user;
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    
    console.log(`👤 Usuario: ${user.name} (ID: ${user.id}), Role: ${user.role}, CompanyId: ${user.companyId}`);
    
    // Remover phone del body antes de validar (no se usa en la tabla)
    const { phone, ...bodyWithoutPhone } = req.body;
    
    const validated = createClientSchema.parse(bodyWithoutPhone)
    console.log('✅ Validated data:', JSON.stringify(validated, null, 2));
    
    // Mapear billingAddr y shippingAddr a address si existen
    const address = validated.billingAddr || validated.shippingAddr || null;
    
  // La tabla clients usa serial (integer) para id, no UUID
  // No especificamos id, la base de datos lo genera automáticamente
  // company_id es requerido: validar explícitamente y NO asumir Orsega por defecto
  const rawCompanyId = (req.body as any).companyId;
  if (!rawCompanyId) {
    return res.status(400).json({ error: 'companyId es requerido' });
  }
  const companyId = parseInt(rawCompanyId);
  
  // Si el usuario no tiene companyId asignado pero es admin, permitir
  // Si el usuario no tiene companyId y no es admin, usar el companyId del request
  // (la validación de tenant ya se hizo en el middleware)
  const finalCompanyId = (user.role === 'admin' || !user.companyId) ? companyId : (user.companyId || companyId);
    
    const result = await sql(`
      INSERT INTO clients (name, email, is_active, company_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      validated.name, 
      validated.email || null, // Email es el único campo obligatorio
      validated.isActive ?? true,
      finalCompanyId // Usar el companyId validado
    ])
    
    console.log(`✅ [POST /clients] Cliente creado: ${result.rows[0].name}`)
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('❌ Error creating client:', error)
    console.error('❌ Error details:', error instanceof Error ? error.message : String(error))
    if ((error as any)?.code) {
      console.error('❌ Database error code:', (error as any).code)
      console.error('❌ Database error detail:', (error as any).detail)
    }
    if (error instanceof z.ZodError) {
      console.error('❌ Validation errors:', JSON.stringify(error.errors, null, 2))
      return res.status(400).json({ error: 'Validation failed', details: error.errors })
    }
    res.status(400).json({ 
      error: 'Failed to create client', 
      message: error instanceof Error ? error.message : String(error),
      details: (error as any)?.detail || undefined
    })
  }
})

catalogRouter.patch('/clients/:id', async (req, res) => {
  try {
    console.log(`🔵 [PATCH /clients/${req.params.id}] Actualizando cliente`);
    
    // VUL-001: Validar acceso primero si se está cambiando companyId
    const { phone, billingAddr, shippingAddr, ...rest } = req.body as any
    const payload = { ...rest, id: parseInt(req.params.id) }
    if (payload.companyId !== undefined) {
      payload.companyId = parseInt(payload.companyId)
      const authReq = req as AuthRequest;
      if (authReq.user) {
        validateTenantAccess(authReq as any, payload.companyId as number)
      }
    }
    
    // Sanitizar payload: remover campos no soportados y normalizar tipos
    const validated = updateClientSchema.parse(payload)
    const address = billingAddr || shippingAddr || undefined
    
    const fields: string[] = []
    const values: any[] = []
    let index = 1
    
    const keyToColumn: Record<string, string> = {
      name: 'name',
      email: 'email',
      isActive: 'is_active',
      companyId: 'company_id',
      // Campos adicionales soportados por la tabla de catálogo si se agregan en el futuro:
      contactPerson: 'contact_person',
      paymentTerms: 'payment_terms',
      requiresReceipt: 'requires_receipt',
      reminderFrequency: 'reminder_frequency',
      clientCode: 'client_code',
      secondaryEmail: 'secondary_email',
      postalCode: 'postal_code',
      emailNotifications: 'email_notifications',
      customerType: 'customer_type',
      requiresPaymentComplement: 'requires_payment_complement',
      notes: 'notes',
    }

    Object.entries(validated).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        const dbField = keyToColumn[key]
        if (!dbField) {
          // Ignorar campos no soportados por la tabla (p.ej. rfc, billingAddr, shippingAddr)
          return
        }
        fields.push(`${dbField} = $${index}`)
        values.push(value)
        index++
      }
    })
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }
    
    // Add company_id validation to prevent cross-tenant updates
    const userCompanyId = (req as AuthRequest).user?.companyId;
    values.push(parseInt(req.params.id))
    let whereClause = `WHERE id = $${index}`;
    if (userCompanyId) {
      values.push(userCompanyId)
      whereClause += ` AND company_id = $${index + 1}`;
    }
    const result = await sql(`
      UPDATE clients SET ${fields.join(', ')}, updated_at = NOW()
      ${whereClause}
      RETURNING *
    `, values)

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' })
    }

    console.log(`✅ [PATCH /clients/${req.params.id}] Cliente actualizado: ${result.rows[0].name}`)
    res.json(result.rows[0])
  } catch (error) {
    console.error('❌ Error updating client:', error)
    res.status(400).json({ 
      error: 'Failed to update client',
      message: error instanceof Error ? error.message : String(error),
      details: (error as any)?.detail || undefined
    })
  }
})

catalogRouter.delete('/clients/:id', async (req, res) => {
  try {
    const authUser = (req as AuthRequest).user;
    const companyId = authUser?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    console.log(`🔵 [DELETE /clients/${req.params.id}] Eliminando cliente (companyId=${companyId})`);
    const result = await sql(`
      UPDATE clients SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING *
    `, [req.params.id, companyId])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found or not in your company' })
    }

    console.log(`✅ [DELETE /clients/${req.params.id}] Cliente eliminado: ${result.rows[0].name}`)
    res.json({ message: 'Client deleted successfully', client: result.rows[0] })
  } catch (error) {
    console.error('❌ Error deleting client:', error)
    res.status(500).json({ error: 'Failed to delete client' })
  }
})

// PROVIDERS
catalogRouter.get('/providers', async (req, res) => {
  try {
    const authUser = (req as AuthRequest).user;
    const companyIdParam = req.query.companyId ? Number(req.query.companyId) : authUser?.companyId;
    const companyId = companyIdParam ?? 1;
    console.log(`🔵 [GET /providers] Endpoint llamado, companyId=${companyId}`);
    const result = await sql(`
      SELECT * FROM provider
      WHERE is_active = TRUE AND company_id = $1
      ORDER BY name
    `, [companyId])
    console.log(`📊 [GET /providers] Retornando ${result.rows.length} proveedores para empresa ${companyId}`);
    res.json(result.rows)
  } catch (error) {
    console.error('❌ Error fetching providers:', error)
    res.status(500).json({ error: 'Failed to fetch providers' })
  }
})

catalogRouter.post('/providers', async (req, res) => {
  try {
    const { name, email, phone, contactName, notes, rating, isActive, shortName, companyId, location, requiresRep, repFrequency, reminderEmail } = req.body
    const id = randomUUID()
    
    const result = await sql(`
      INSERT INTO provider (id, name, email, phone, contact_name, notes, rating, is_active, short_name, company_id, location, requires_rep, rep_frequency, reminder_email)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [id, name, email, phone || null, contactName || null, notes || null, rating || null, isActive ?? true, shortName || null, companyId || null, location || null, requiresRep ?? true, repFrequency || 7, reminderEmail || null])
    
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error creating provider:', error)
    res.status(400).json({ error: 'Failed to create provider' })
  }
})

catalogRouter.patch('/providers/:id', async (req, res) => {
  try {
    const { name, email, phone, contactName, notes, rating, isActive, shortName, companyId, location, requiresRep, repFrequency, reminderEmail } = req.body
    
    const fields: string[] = []
    const values: any[] = []
    let index = 1
    
    // Mapear campos de JavaScript a nombres de columna en DB
    const fieldMap: Record<string, string> = {
      name: 'name',
      email: 'email',
      phone: 'phone',
      contactName: 'contact_name',
      shortName: 'short_name',
      companyId: 'company_id',
      location: 'location',
      requiresRep: 'requires_rep',
      repFrequency: 'rep_frequency',
      reminderEmail: 'reminder_email',
      notes: 'notes',
      rating: 'rating',
      isActive: 'is_active'
    }
    
    Object.entries({ name, email, phone, contactName, shortName, companyId, location, requiresRep, repFrequency, reminderEmail, notes, rating, isActive }).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbField = fieldMap[key] || key
        fields.push(`${dbField} = $${index}`)
        values.push(value)
        index++
      }
    })
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }
    
    values.push(req.params.id)
    const result = await sql(`
      UPDATE provider SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING *
    `, values)
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' })
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating provider:', error)
    res.status(400).json({ error: 'Failed to update provider' })
  }
})

// PROVIDER CHANNELS
// DELETE provider
catalogRouter.delete('/providers/:id', async (req, res) => {
  try {
    const authUser = (req as AuthRequest).user;
    const companyId = authUser?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    const result = await sql(`
      UPDATE provider SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING *
    `, [req.params.id, companyId])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found or not in your company' })
    }
    
    res.json({ message: 'Provider deleted successfully', provider: result.rows[0] })
  } catch (error) {
    console.error('Error deleting provider:', error)
    res.status(500).json({ error: 'Failed to delete provider' })
  }
})

// PROVIDER CHANNELS
catalogRouter.post('/providers/:id/channels', async (req, res) => {
  try {
    const validated = createProviderChannelSchema.parse({ ...req.body, providerId: req.params.id })
    const id = randomUUID()
    
    const result = await sql(`
      INSERT INTO provider_channel (id, provider_id, type, value, is_default)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, validated.providerId, validated.type, validated.value, validated.isDefault])
    
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error creating provider channel:', error)
    res.status(400).json({ error: 'Failed to create provider channel' })
  }
})

// ============================================
// SUPPLIERS (Proveedores de Tesorería - REP)
// ============================================

// GET /api/suppliers - Obtener proveedores de tesorería
catalogRouter.get('/suppliers', async (req, res) => {
  try {
    const authUser = (req as AuthRequest).user;
    const companyIdParam = req.query.companyId ? Number(req.query.companyId) : authUser?.companyId;
    const companyId = companyIdParam ?? 1;
    console.log(`🔵 [GET /suppliers] Endpoint llamado, companyId=${companyId}`);

    const result = await sql(`
      SELECT s.*, c.name as company_name
      FROM suppliers s
      LEFT JOIN companies c ON s.company_id = c.id
      WHERE s.company_id = $1
      ORDER BY s.name
    `, [companyId])

    console.log(`📊 [GET /suppliers] Retornando ${result.rows.length} proveedores de tesorería para empresa ${companyId}`)
    res.json(result.rows)
  } catch (error) {
    console.error('❌ Error fetching suppliers:', error)
    res.status(500).json({ error: 'Failed to fetch suppliers' })
  }
})

// POST /api/suppliers - Crear nuevo proveedor de tesorería
catalogRouter.post('/suppliers', validateTenantFromBody('companyId') as any, async (req, res) => {
  try {
    console.log('🔵 [POST /suppliers] Creando nuevo proveedor de tesorería');
    
    const validatedData = insertSupplierSchema.parse(req.body)
    
    const result = await sql(`
      INSERT INTO suppliers (
        name, short_name, email, location, requires_rep, 
        rep_frequency, company_id, is_active, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      validatedData.name,
      validatedData.shortName,
      validatedData.email,
      validatedData.location,
      validatedData.requiresRep,
      validatedData.repFrequency,
      validatedData.companyId,
      validatedData.isActive,
      validatedData.notes
    ])
    
    console.log(`✅ [POST /suppliers] Proveedor creado: ${result.rows[0].name}`)
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('❌ Error creating supplier:', error)
    res.status(400).json({ error: 'Failed to create supplier' })
  }
})

// PATCH /api/suppliers/:id - Actualizar proveedor de tesorería
catalogRouter.patch('/suppliers/:id', async (req, res) => {
  try {
    const { id } = req.params
    console.log(`🔵 [PATCH /suppliers/${id}] Actualizando proveedor`);
    
    const validatedData = insertSupplierSchema.partial().parse(req.body)
    
    // VUL-001: Validar acceso si se está cambiando companyId
    if (validatedData.companyId !== undefined) {
      const authReq = req as AuthRequest;
      if (authReq.user) {
        validateTenantAccess(authReq as any, validatedData.companyId as number)
      }
    }
    
    const result = await sql(`
      UPDATE suppliers 
      SET 
        name = COALESCE($1, name),
        short_name = COALESCE($2, short_name),
        email = COALESCE($3, email),
        location = COALESCE($4, location),
        requires_rep = COALESCE($5, requires_rep),
        rep_frequency = COALESCE($6, rep_frequency),
        company_id = COALESCE($7, company_id),
        is_active = COALESCE($8, is_active),
        notes = COALESCE($9, notes),
        updated_at = NOW()
      WHERE id = $10
      RETURNING *
    `, [
      validatedData.name,
      validatedData.shortName,
      validatedData.email,
      validatedData.location,
      validatedData.requiresRep,
      validatedData.repFrequency,
      validatedData.companyId,
      validatedData.isActive,
      validatedData.notes,
      id
    ])
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' })
    }
    
    console.log(`✅ [PATCH /suppliers/${id}] Proveedor actualizado: ${result.rows[0].name}`)
    res.json(result.rows[0])
  } catch (error) {
    console.error('❌ Error updating supplier:', error)
    res.status(400).json({ error: 'Failed to update supplier' })
  }
})

// DELETE /api/suppliers/:id - Eliminar proveedor de tesorería
catalogRouter.delete('/suppliers/:id', async (req, res) => {
  try {
    const { id } = req.params
    const authUser = (req as AuthRequest).user;
    const companyId = authUser?.companyId;
    if (!companyId) {
      return res.status(403).json({ error: 'No company access' });
    }

    console.log(`🔵 [DELETE /suppliers/${id}] Eliminando proveedor (companyId=${companyId})`);

    const result = await sql(`
      DELETE FROM suppliers
      WHERE id = $1 AND company_id = $2
      RETURNING name
    `, [id, companyId])

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found or not in your company' })
    }

    console.log(`✅ [DELETE /suppliers/${id}] Proveedor eliminado: ${result.rows[0].name}`)
    res.json({ message: 'Supplier deleted successfully' })
  } catch (error) {
    console.error('❌ Error deleting supplier:', error)
    res.status(500).json({ error: 'Failed to delete supplier' })
  }
})
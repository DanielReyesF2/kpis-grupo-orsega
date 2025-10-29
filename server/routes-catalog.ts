import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { sql } from './db-logistics.js'
import { createClientSchema, updateClientSchema, createProviderSchema, updateProviderSchema, createProviderChannelSchema } from '../shared/logistics-schema.js'
import { insertSupplierSchema } from '../shared/schema.js'

export const catalogRouter = Router()

// CLIENTS
catalogRouter.get('/clients', async (req, res) => {
  try {
    console.log('🔵 [GET /clients] Endpoint llamado');
    const result = await sql(`
      SELECT id, code, name, contact, email, company_id, is_active, notes, created_at, updated_at 
      FROM clients 
      WHERE is_active = TRUE 
      ORDER BY name
    `)
    console.log(`📊 [GET /clients] Retornando ${result.rows.length} clientes`);
    if (result.rows.length > 0) {
      console.log(`📋 Primer cliente:`, JSON.stringify(result.rows[0], null, 2));
    }
    res.json(result.rows)
  } catch (error) {
    console.error('❌ Error fetching clients:', error)
    res.status(500).json({ error: 'Failed to fetch clients' })
  }
})

catalogRouter.post('/clients', async (req, res) => {
  try {
    console.log('🔵 [POST /clients] Creando nuevo cliente');
    const validated = createClientSchema.parse(req.body)
    const id = randomUUID()
    
    const result = await sql(`
      INSERT INTO clients (id, name, email, phone, contact_person, company, address, payment_terms, requires_receipt, reminder_frequency, is_active, company_id, client_code, secondary_email, city, state, postal_code, country, email_notifications, customer_type, requires_payment_complement)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `, [id, validated.name, validated.email, validated.phone, validated.contactPerson, validated.company, validated.address, validated.paymentTerms, validated.requiresReceipt, validated.reminderFrequency, validated.isActive, validated.companyId, validated.clientCode, validated.secondaryEmail, validated.city, validated.state, validated.postalCode, validated.country, validated.emailNotifications, validated.customerType, validated.requiresPaymentComplement])
    
    console.log(`✅ [POST /clients] Cliente creado: ${result.rows[0].name}`)
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('❌ Error creating client:', error)
    res.status(400).json({ error: 'Failed to create client' })
  }
})

catalogRouter.patch('/clients/:id', async (req, res) => {
  try {
    console.log(`🔵 [PATCH /clients/${req.params.id}] Actualizando cliente`);
    const validated = updateClientSchema.parse({ ...req.body, id: req.params.id })
    
    const fields: string[] = []
    const values: any[] = []
    let index = 1
    
    Object.entries(validated).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        const dbField = key === 'contactPerson' ? 'contact_person' : 
                       key === 'paymentTerms' ? 'payment_terms' : 
                       key === 'requiresReceipt' ? 'requires_receipt' : 
                       key === 'reminderFrequency' ? 'reminder_frequency' : 
                       key === 'isActive' ? 'is_active' : 
                       key === 'companyId' ? 'company_id' : 
                       key === 'clientCode' ? 'client_code' : 
                       key === 'secondaryEmail' ? 'secondary_email' : 
                       key === 'postalCode' ? 'postal_code' : 
                       key === 'emailNotifications' ? 'email_notifications' : 
                       key === 'customerType' ? 'customer_type' : 
                       key === 'requiresPaymentComplement' ? 'requires_payment_complement' : key
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
      UPDATE clients SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING *
    `, values)
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' })
    }
    
    console.log(`✅ [PATCH /clients/${req.params.id}] Cliente actualizado: ${result.rows[0].name}`)
    res.json(result.rows[0])
  } catch (error) {
    console.error('❌ Error updating client:', error)
    res.status(400).json({ error: 'Failed to update client' })
  }
})

// PROVIDERS
catalogRouter.get('/providers', async (req, res) => {
  try {
    console.log('🔵 [GET /providers] Endpoint llamado');
    const result = await sql(`
      SELECT * FROM provider 
      WHERE is_active = TRUE
      ORDER BY name
    `)
    console.log(`📊 [GET /providers] Retornando ${result.rows.length} proveedores`);
    if (result.rows.length > 0) {
      console.log(`📋 Primer proveedor:`, JSON.stringify(result.rows[0], null, 2));
    }
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
    const result = await sql(`
      UPDATE provider SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [req.params.id])
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' })
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
    console.log('🔵 [GET /suppliers] Endpoint llamado');
    
    const result = await sql(`
      SELECT s.*, c.name as company_name
      FROM suppliers s
      LEFT JOIN companies c ON s.company_id = c.id
      ORDER BY s.company_id, s.name
    `)
    
    console.log(`📊 [GET /suppliers] Retornando ${result.rows.length} proveedores de tesorería`)
    res.json(result.rows)
  } catch (error) {
    console.error('❌ Error fetching suppliers:', error)
    res.status(500).json({ error: 'Failed to fetch suppliers' })
  }
})

// POST /api/suppliers - Crear nuevo proveedor de tesorería
catalogRouter.post('/suppliers', async (req, res) => {
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
    console.log(`🔵 [DELETE /suppliers/${id}] Eliminando proveedor`);
    
    const result = await sql(`
      DELETE FROM suppliers 
      WHERE id = $1
      RETURNING name
    `, [id])
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' })
    }
    
    console.log(`✅ [DELETE /suppliers/${id}] Proveedor eliminado: ${result.rows[0].name}`)
    res.json({ message: 'Supplier deleted successfully' })
  } catch (error) {
    console.error('❌ Error deleting supplier:', error)
    res.status(500).json({ error: 'Failed to delete supplier' })
  }
})
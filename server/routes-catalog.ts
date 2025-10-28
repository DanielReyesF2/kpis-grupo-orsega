import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { sql } from './db-logistics.js'
import { createClientSchema, updateClientSchema, createProviderSchema, updateProviderSchema, createProviderChannelSchema } from '../shared/logistics-schema.js'

export const catalogRouter = Router()

// CLIENTS
catalogRouter.get('/clients', async (req, res) => {
  try {
    const result = await sql(`
      SELECT id, name, rfc, email, phone, billing_addr, shipping_addr, is_active, created_at, updated_at 
      FROM client 
      WHERE is_active = TRUE 
      ORDER BY name
    `)
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching clients:', error)
    res.status(500).json({ error: 'Failed to fetch clients' })
  }
})

catalogRouter.post('/clients', async (req, res) => {
  try {
    const validated = createClientSchema.parse(req.body)
    const id = randomUUID()
    
    const result = await sql(`
      INSERT INTO client (id, name, rfc, email, phone, billing_addr, shipping_addr, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [id, validated.name, validated.rfc, validated.email, validated.phone, validated.billingAddr, validated.shippingAddr, validated.isActive])
    
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error creating client:', error)
    res.status(400).json({ error: 'Failed to create client' })
  }
})

catalogRouter.patch('/clients/:id', async (req, res) => {
  try {
    const validated = updateClientSchema.parse({ ...req.body, id: req.params.id })
    
    const fields: string[] = []
    const values: any[] = []
    let index = 1
    
    Object.entries(validated).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        const dbField = key === 'billingAddr' ? 'billing_addr' : 
                       key === 'shippingAddr' ? 'shipping_addr' : 
                       key === 'isActive' ? 'is_active' : key
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
      UPDATE client SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING *
    `, values)
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' })
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating client:', error)
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
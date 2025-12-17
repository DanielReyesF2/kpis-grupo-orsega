import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { sql } from './db-logistics.js'
import { createShipmentSchema, updateShipmentSchema, createShipmentEventSchema, createShipmentDocSchema } from '../shared/logistics-schema.js'
import { sendTransportRequest } from './email-logistics.js'
import { jwtAuthMiddleware } from './auth.js'

export const logisticsRouter = Router()

// ✅ SECURITY FIX: Aplicar autenticación JWT a todas las rutas de logística
// Antes estas rutas estaban expuestas sin autenticación
logisticsRouter.use(jwtAuthMiddleware)

// GET /api/shipments with filters
logisticsRouter.get('/shipments', async (req, res) => {
  try {
    const { status, q, clientId, providerId, page = '1', limit = '20' } = req.query
    
    let whereClause = '1=1'
    const params: any[] = []
    let paramIndex = 1
    
    if (status) {
      whereClause += ` AND s.status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }
    
    if (clientId) {
      whereClause += ` AND s.client_id = $${paramIndex}`
      params.push(clientId)
      paramIndex++
    }
    
    if (providerId) {
      whereClause += ` AND s.provider_id = $${paramIndex}`
      params.push(providerId)
      paramIndex++
    }
    
    if (q) {
      whereClause += ` AND (s.reference ILIKE $${paramIndex} OR s.origin ILIKE $${paramIndex} OR s.destination ILIKE $${paramIndex})`
      params.push(`%${q}%`)
      paramIndex++
    }
    
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string)
    params.push(parseInt(limit as string), offset)
    
    const result = await sql(`
      SELECT s.*,
        c.name as client_name,
        c.email as client_email,
        p.name as provider_name,
        p.email as provider_email
      FROM shipment s
      LEFT JOIN client c ON s.client_id = c.id
      LEFT JOIN provider p ON s.provider_id = p.id
      WHERE ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, params)
    
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching shipments:', error)
    res.status(500).json({ error: 'Failed to fetch shipments' })
  }
})

// GET /api/shipments/:id
logisticsRouter.get('/shipments/:id', async (req, res) => {
  try {
    const result = await sql(`
      SELECT s.*,
        c.name as client_name, c.email as client_email,
        p.name as provider_name, p.email as provider_email
      FROM shipment s
      LEFT JOIN client c ON s.client_id = c.id
      LEFT JOIN provider p ON s.provider_id = p.id
      WHERE s.id = $1
    `, [req.params.id])
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' })
    }
    
    // Get events
    const events = await sql(`
      SELECT * FROM shipment_event 
      WHERE shipment_id = $1 
      ORDER BY at DESC
    `, [req.params.id])
    
    // Get documents
    const docs = await sql(`
      SELECT * FROM shipment_doc 
      WHERE shipment_id = $1 
      ORDER BY uploaded_at DESC
    `, [req.params.id])
    
    const shipment = result.rows[0]
    shipment.events = events.rows
    shipment.documents = docs.rows
    
    res.json(shipment)
  } catch (error) {
    console.error('Error fetching shipment:', error)
    res.status(500).json({ error: 'Failed to fetch shipment' })
  }
})

// POST /api/shipments
// NOTA: Esta ruta está duplicada con server/routes.ts
// El endpoint principal está en routes.ts que usa insertShipmentSchema
// Este endpoint usa un schema diferente (createShipmentSchema) y se mantiene
// solo para compatibilidad legacy. Si falla, debe revisarse routes.ts
logisticsRouter.post('/shipments', async (req, res) => {
  try {
    console.log('[POST /api/shipments (logistics)] Datos recibidos:', JSON.stringify(req.body, null, 2));
    const validated = createShipmentSchema.parse(req.body)
    console.log('[POST /api/shipments (logistics)] Datos validados:', JSON.stringify(validated, null, 2));
    const id = randomUUID()
    
    const result = await sql(`
      INSERT INTO shipment (id, reference, client_id, provider_id, origin, destination, incoterm, etd, eta)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [id, validated.reference, validated.clientId, validated.providerId, validated.origin, validated.destination, validated.incoterm, validated.etd, validated.eta])
    
    console.log('[POST /api/shipments (logistics)] Envío creado exitosamente');
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('[POST /api/shipments (logistics)] Error completo:', error);
    if (error instanceof z.ZodError) {
      console.error('[POST /api/shipments (logistics)] Errores de validación:', JSON.stringify(error.errors, null, 2));
      return res.status(400).json({ 
        error: 'Failed to create shipment',
        message: 'Validation error',
        details: error.errors 
      });
    }
    console.error('[POST /api/shipments (logistics)] Error desconocido:', error);
    res.status(400).json({ error: 'Failed to create shipment', details: (error as Error).message })
  }
})

// PATCH /api/shipments/:id
logisticsRouter.patch('/shipments/:id', async (req, res) => {
  try {
    const validated = updateShipmentSchema.parse({ ...req.body, id: req.params.id })
    
    const fields: string[] = []
    const values: any[] = []
    let index = 1
    
    Object.entries(validated).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        const dbField = key === 'clientId' ? 'client_id' : 
                       key === 'providerId' ? 'provider_id' : key
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
      UPDATE shipment SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING *
    `, values)
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' })
    }
    
    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating shipment:', error)
    res.status(400).json({ error: 'Failed to update shipment' })
  }
})

// POST /api/shipments/:id/events
logisticsRouter.post('/shipments/:id/events', async (req, res) => {
  try {
    const validated = createShipmentEventSchema.parse({ ...req.body, shipmentId: req.params.id })
    const id = randomUUID()
    
    const result = await sql(`
      INSERT INTO shipment_event (id, shipment_id, type, at, lat, lng, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [id, validated.shipmentId, validated.type, validated.at, validated.lat, validated.lng, validated.notes, 'system'])
    
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error creating shipment event:', error)
    res.status(400).json({ error: 'Failed to create shipment event' })
  }
})

// POST /api/shipments/:id/docs
logisticsRouter.post('/shipments/:id/docs', async (req, res) => {
  try {
    const validated = createShipmentDocSchema.parse({ ...req.body, shipmentId: req.params.id })
    const id = randomUUID()
    
    const result = await sql(`
      INSERT INTO shipment_doc (id, shipment_id, kind, file_url, uploaded_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [id, validated.shipmentId, validated.kind, validated.fileUrl, validated.uploadedBy])
    
    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error creating shipment document:', error)
    res.status(400).json({ error: 'Failed to create shipment document' })
  }
})

// POST /api/shipments/:id/request-transport
logisticsRouter.post('/shipments/:id/request-transport', async (req, res) => {
  try {
    const { providerId, pickupWindow, notes } = req.body
    const shipmentId = req.params.id
    
    // Update shipment status
    await sql(`
      UPDATE shipment 
      SET status = 'asignando_transporte', provider_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [providerId, shipmentId])
    
    // Get shipment and provider details
    const shipmentResult = await sql(`
      SELECT s.*, c.name as client_name, p.name as provider_name, p.email as provider_email
      FROM shipment s
      JOIN client c ON s.client_id = c.id
      JOIN provider p ON s.provider_id = p.id
      WHERE s.id = $1
    `, [shipmentId])
    
    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' })
    }
    
    const shipment = shipmentResult.rows[0]
    
    // Generate tokens for confirm/reject
    const confirmToken = randomUUID()
    const rejectToken = randomUUID()
    
    // Send email
    try {
      await sendTransportRequest({
        to: shipment.provider_email,
        shipment,
        confirmToken,
        rejectToken,
        pickupWindow,
        notes
      })
      
      // Log the event
      await sql(`
        INSERT INTO shipment_event (id, shipment_id, type, at, notes, created_by)
        VALUES ($1, $2, 'note', NOW(), $3, 'system')
      `, [randomUUID(), shipmentId, `Solicitud de transporte enviada a ${shipment.provider_name}`])
      
      res.json({ success: true, message: 'Transport request sent successfully' })
    } catch (emailError) {
      console.error('Error sending email:', emailError)
      res.status(500).json({ error: 'Failed to send transport request' })
    }
  } catch (error) {
    console.error('Error requesting transport:', error)
    res.status(500).json({ error: 'Failed to request transport' })
  }
})

// POST /api/shipments/:id/confirm
logisticsRouter.post('/shipments/:id/confirm', async (req, res) => {
  try {
    const { token, pickupAt } = req.query
    const shipmentId = req.params.id
    
    // Validate token (in production, store tokens in DB)
    if (!token) {
      return res.status(400).json({ error: 'Invalid token' })
    }
    
    await sql(`
      UPDATE shipment 
      SET status = 'confirmado', updated_at = NOW()
      WHERE id = $1
    `, [shipmentId])
    
    // Log the confirmation
    await sql(`
      INSERT INTO shipment_event (id, shipment_id, type, at, notes, created_by)
      VALUES ($1, $2, 'pickup', $3, 'Transporte confirmado por proveedor', 'provider')
    `, [randomUUID(), shipmentId, pickupAt || new Date().toISOString()])
    
    res.json({ success: true, message: 'Transport confirmed successfully' })
  } catch (error) {
    console.error('Error confirming transport:', error)
    res.status(500).json({ error: 'Failed to confirm transport' })
  }
})

// POST /api/shipments/:id/reject
logisticsRouter.post('/shipments/:id/reject', async (req, res) => {
  try {
    const { token, reason } = req.query
    const shipmentId = req.params.id
    
    // Validate token
    if (!token) {
      return res.status(400).json({ error: 'Invalid token' })
    }
    
    await sql(`
      UPDATE shipment 
      SET status = 'pendiente', provider_id = NULL, updated_at = NOW()
      WHERE id = $1
    `, [shipmentId])
    
    // Log the rejection
    await sql(`
      INSERT INTO shipment_event (id, shipment_id, type, at, notes, created_by)
      VALUES ($1, $2, 'note', NOW(), $3, 'provider')
    `, [randomUUID(), shipmentId, `Transporte rechazado: ${reason || 'Sin razón especificada'}`])
    
    res.json({ success: true, message: 'Transport rejected' })
  } catch (error) {
    console.error('Error rejecting transport:', error)
    res.status(500).json({ error: 'Failed to reject transport' })
  }
})
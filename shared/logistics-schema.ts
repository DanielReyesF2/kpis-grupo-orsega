import { z } from "zod";

// Logistics schemas
const uuidSchema = () => z.string().uuid()
const intId = z.coerce.number().int().positive()
const email = z.string().email().optional().or(z.literal("").transform(() => undefined))

export const shipmentStatus = z.enum(["pendiente","asignando_transporte","confirmado","en_camino","retenido","entregado","cerrado"])
export const eventType = z.enum(["pickup","customs","delay","delivery","note"])

export const clientSchema = z.object({
  // En BD 'clients.id' es serial (integer). Usamos coerce para aceptar strings numéricas del path param
  id: intId,
  name: z.string().min(2),
  rfc: z.string().optional(), 
  email, 
  // phone removido - no se usa en la tabla clients
  billingAddr: z.string().optional(), 
  shippingAddr: z.string().optional(),
  isActive: z.boolean().default(true),
  // Permitir actualizar la empresa (company_id)
  companyId: intId.optional(),
})
export const createClientSchema = clientSchema.omit({ id: true })
export const updateClientSchema = clientSchema.partial().extend({ id: intId })

export const providerSchema = z.object({
  id: uuidSchema(), 
  name: z.string().min(2),
  email, 
  phone: z.string().optional(), 
  contactName: z.string().optional(),
  notes: z.string().optional(), 
  rating: z.number().min(0).max(5).optional(),
  isActive: z.boolean().default(true),
})
export const createProviderSchema = providerSchema.omit({ id: true })
export const updateProviderSchema = providerSchema.partial().extend({ id: uuidSchema() })

export const providerChannelSchema = z.object({
  id: uuidSchema(), 
  providerId: uuidSchema(),
  type: z.enum(["email","api","portal"]),
  value: z.string().min(3),
  isDefault: z.boolean().default(false),
})
export const createProviderChannelSchema = providerChannelSchema.omit({ id: true })

export const shipmentSchema = z.object({
  id: uuidSchema(),
  reference: z.string().min(2),
  clientId: uuidSchema(),
  providerId: uuidSchema().optional(),
  origin: z.string().min(2),
  destination: z.string().min(2),
  incoterm: z.string().optional(),
  status: shipmentStatus.default("pendiente"),
  etd: z.string().datetime().optional(),
  eta: z.string().datetime().optional(),
})
export const createShipmentSchema = shipmentSchema
  .omit({ id: true, status: true })
  .extend({ notifyClient: z.boolean().default(false), customerEmail: email })
export const updateShipmentSchema = shipmentSchema.partial().extend({ id: uuidSchema() })

export const shipmentEventSchema = z.object({
  id: uuidSchema(), 
  shipmentId: uuidSchema(), 
  type: eventType,
  at: z.string().datetime(),
  lat: z.number().optional(), 
  lng: z.number().optional(),
  notes: z.string().optional(),
})
export const createShipmentEventSchema = shipmentEventSchema.omit({ id: true })

export const shipmentDocSchema = z.object({
  id: uuidSchema(), 
  shipmentId: uuidSchema(),
  kind: z.enum(["bl","factura","foto","otro"]),
  fileUrl: z.string().url(),
  uploadedAt: z.string().datetime().optional(),
  uploadedBy: z.string().optional(),
})
export const createShipmentDocSchema = shipmentDocSchema.omit({ id: true })
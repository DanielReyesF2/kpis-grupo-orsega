import { triggerN8nLogistics } from './n8n-logistics';

interface TransportRequestData {
  to: string
  shipment: any
  confirmToken: string
  rejectToken: string
  pickupWindow?: string
  notes?: string
}

export async function sendTransportRequest(data: TransportRequestData) {
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://your-domain.replit.app'
    : 'http://localhost:5000'

  const confirmUrl = `${baseUrl}/api/shipments/${data.shipment.id}/confirm?token=${data.confirmToken}&pickupAt=${encodeURIComponent(data.pickupWindow || '')}`
  const rejectUrl = `${baseUrl}/api/shipments/${data.shipment.id}/reject?token=${data.rejectToken}`

  const subject = `Solicitud de Transporte - ${data.shipment.reference}`

  const result = await triggerN8nLogistics({
    event: 'transport_request',
    to: data.to,
    subject,
    data: {
      shipment: data.shipment,
      pickupWindow: data.pickupWindow,
      notes: data.notes,
      confirmUrl,
      rejectUrl,
    },
  })

  if (!result.success) {
    throw new Error(result.error || 'Failed to send transport request via N8N')
  }

  console.log(`Transport request sent via N8N to: ${data.to}`)
}

interface ShipmentStatusNotificationData {
  to: string
  shipment: any
  status: 'pending' | 'in_transit' | 'delayed' | 'delivered' | 'cancelled'
}

// Mapeo de estados a configuración de email
const STATUS_EMAIL_CONFIG = {
  pending: {
    subject: 'Envío Registrado',
    title: '📦 Envío Registrado',
    message: 'Su envío ha sido registrado en nuestro sistema y está pendiente de despacho.',
    color: '#6c757d'
  },
  in_transit: {
    subject: 'Envío en Tránsito',
    title: '🚚 Su Envío Está en Camino',
    message: 'Su envío ha sido despachado y está en tránsito hacia su destino.',
    color: '#0066cc'
  },
  delayed: {
    subject: 'Envío Retrasado',
    title: '⚠️ Actualización de Envío',
    message: 'Queremos informarle que su envío ha experimentado un retraso. Estamos trabajando para entregarlo lo antes posible.',
    color: '#ffc107'
  },
  delivered: {
    subject: 'Envío Entregado',
    title: '✅ Envío Entregado Exitosamente',
    message: '¡Excelentes noticias! Su envío ha sido entregado exitosamente.',
    color: '#28a745'
  },
  cancelled: {
    subject: 'Envío Cancelado',
    title: '❌ Envío Cancelado',
    message: 'Su envío ha sido cancelado. Si tiene preguntas, por favor contáctenos.',
    color: '#dc3545'
  }
}

export async function sendShipmentStatusNotification(data: ShipmentStatusNotificationData) {
  const config = STATUS_EMAIL_CONFIG[data.status]
  const trackingCode = data.shipment.tracking_code || data.shipment.trackingCode || 'N/A'

  const subject = `${config.subject} - ${trackingCode}`

  const result = await triggerN8nLogistics({
    event: 'shipment_status',
    to: data.to,
    subject,
    data: {
      shipment: {
        trackingCode,
        origin: data.shipment.origin,
        destination: data.shipment.destination,
        product: data.shipment.product,
        estimatedDeliveryDate: data.shipment.estimated_delivery_date || data.shipment.estimatedDeliveryDate,
      },
      status: data.status,
      statusDisplay: config.subject,
      statusMessage: config.message,
      statusColor: config.color,
    },
  })

  if (!result.success) {
    console.error('[N8N Error] Failed to send shipment notification:', result.error)
    throw new Error(result.error || 'Failed to send shipment notification via N8N')
  }

  console.log(`Shipment status notification sent via N8N to: ${data.to} (status: ${data.status})`)

  return {
    messageId: result.messageId || 'n8n',
    provider: 'n8n'
  }
}
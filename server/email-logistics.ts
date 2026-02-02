import { emailService } from './email-service';

interface TransportRequestData {
  to: string
  shipment: any
  confirmToken: string
  rejectToken: string
  pickupWindow?: string
  notes?: string
}

export async function sendTransportRequest(data: TransportRequestData) {
  if (!emailService.isEmailConfigured()) {
    console.log('[Simulation] Transport request email would be sent:', data)
    return
  }
  
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? 'https://your-domain.replit.app' 
    : 'http://localhost:5000'
  
  const confirmUrl = `${baseUrl}/api/shipments/${data.shipment.id}/confirm?token=${data.confirmToken}&pickupAt=${encodeURIComponent(data.pickupWindow || '')}`
  const rejectUrl = `${baseUrl}/api/shipments/${data.shipment.id}/reject?token=${data.rejectToken}`
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">Solicitud de Transporte</h1>
        <p style="margin: 5px 0 0 0;">Sistema Logístico DIGO</p>
      </div>
      
      <div style="padding: 30px; background: #f8f9fa;">
        <p>Estimado proveedor,</p>
        
        <p>Tenemos una nueva solicitud de transporte que requiere su atención:</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #333; margin-top: 0;">Detalles del Envío</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Referencia:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.shipment.reference}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Cliente:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.shipment.client_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Origen:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.shipment.origin}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Destino:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.shipment.destination}</td>
            </tr>
            ${data.shipment.incoterm ? `
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Incoterm:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.shipment.incoterm}</td>
            </tr>` : ''}
            ${data.pickupWindow ? `
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Ventana de Recolección:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.pickupWindow}</td>
            </tr>` : ''}
          </table>
          
          ${data.notes ? `
          <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 4px;">
            <strong>Notas adicionales:</strong><br>
            ${data.notes}
          </div>` : ''}
        </div>
        
        <p><strong>¿Puede realizar este transporte?</strong></p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmUrl}" 
             style="display: inline-block; background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 0 10px; font-weight: bold;">
            ✅ CONFIRMAR TRANSPORTE
          </a>
          
          <a href="${rejectUrl}" 
             style="display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 0 10px; font-weight: bold;">
            ❌ RECHAZAR
          </a>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
          <p>Este correo fue enviado automáticamente por el Sistema Logístico DIGO.</p>
          <p>Si tiene preguntas, responda directamente a este correo.</p>
        </div>
      </div>
    </div>
  `
  
  const subject = `Solicitud de Transporte - ${data.shipment.reference}`

  await emailService.sendEmail({
    to: data.to,
    subject,
    html,
  }, 'logistics')
  console.log(`Transport request email sent to: ${data.to}`)
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
  if (!emailService.isEmailConfigured()) {
    console.log('[Simulation] Email notification would be sent:', {
      to: data.to,
      status: data.status,
      trackingCode: data.shipment.tracking_code || data.shipment.trackingCode
    })
    return { messageId: 'simulated', provider: 'resend' }
  }
  
  const config = STATUS_EMAIL_CONFIG[data.status]
  const trackingCode = data.shipment.tracking_code || data.shipment.trackingCode || 'N/A'
  const estimatedDelivery = data.shipment.estimated_delivery_date || data.shipment.estimatedDeliveryDate
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${config.color}; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">${config.title}</h1>
        <p style="margin: 5px 0 0 0;">Sistema de Seguimiento Econova</p>
      </div>
      
      <div style="padding: 30px; background: #f8f9fa;">
        <p style="font-size: 16px; color: #333;">Estimado cliente,</p>
        
        <p style="font-size: 16px; color: #333;">${config.message}</p>
        
        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3 style="color: #333; margin-top: 0;">Detalles del Envío</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Código de Seguimiento:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee; font-family: monospace;">${trackingCode}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Origen:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.shipment.origin || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Destino:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.shipment.destination || 'N/A'}</td>
            </tr>
            ${data.shipment.product ? `
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Producto:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${data.shipment.product}</td>
            </tr>` : ''}
            ${estimatedDelivery ? `
            <tr>
              <td style="padding: 8px; font-weight: bold; border-bottom: 1px solid #eee;">Fecha Estimada de Entrega:</td>
              <td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date(estimatedDelivery).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 8px; font-weight: bold;">Estado Actual:</td>
              <td style="padding: 8px; color: ${config.color}; font-weight: bold;">${config.title.replace(/[📦🚚⚠️✅❌]/g, '').trim()}</td>
            </tr>
          </table>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
          <p>Este correo fue enviado automáticamente por el Sistema de Seguimiento Econova.</p>
          <p>Si tiene preguntas sobre su envío, por favor contáctenos respondiendo a este correo.</p>
        </div>
      </div>
    </div>
  `
  
  const subject = `${config.subject} - ${trackingCode}`

  try {
    const result = await emailService.sendEmail({
      to: data.to,
      subject,
      html,
    }, 'logistics')
    console.log(`Shipment status notification sent to: ${data.to} (status: ${data.status})`)

    return {
      messageId: result.messageId || 'sent',
      provider: 'resend'
    }
  } catch (error) {
    console.error('[Email Error] Failed to send shipment notification:', error)
    throw error
  }
}
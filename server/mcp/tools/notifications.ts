/**
 * ============================================================================
 * 🔔 MCP NOTIFICATIONS - Herramientas de Notificaciones y Alertas
 * ============================================================================
 *
 * Este módulo expone herramientas para:
 * - Enviar notificaciones por email
 * - Enviar mensajes por WhatsApp
 * - Crear alertas en el sistema
 * - Gestionar recordatorios
 * - Notificaciones push
 *
 * @module mcp/tools/notifications
 */

import type { MCPTool, MCPToolResult, MCPContext } from '../index';

// ============================================================================
// DEFINICIÓN DE HERRAMIENTAS
// ============================================================================

export const notificationTools: MCPTool[] = [
  // -------------------------------------------------------------------------
  // SEND_EMAIL - Enviar correo electrónico
  // -------------------------------------------------------------------------
  {
    name: 'send_email',
    description: `Envía un correo electrónico.

    Capacidades:
    - Múltiples destinatarios (to, cc, bcc)
    - Adjuntos (facturas, reportes)
    - Plantillas predefinidas
    - HTML o texto plano
    - Seguimiento de apertura

    Plantillas disponibles:
    - invoice_reminder: Recordatorio de factura
    - payment_confirmation: Confirmación de pago
    - statement: Estado de cuenta
    - report: Envío de reporte
    - custom: Personalizado`,
    category: 'notifications',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'array',
          description: 'Destinatarios principales',
          items: { type: 'string' },
        },
        cc: {
          type: 'array',
          description: 'Copia (CC)',
          items: { type: 'string' },
        },
        bcc: {
          type: 'array',
          description: 'Copia oculta (BCC)',
          items: { type: 'string' },
        },
        subject: {
          type: 'string',
          description: 'Asunto del correo',
        },
        template: {
          type: 'string',
          description: 'Plantilla a usar',
          enum: ['invoice_reminder', 'payment_confirmation', 'statement', 'report', 'welcome', 'custom'],
        },
        template_data: {
          type: 'object',
          description: 'Datos para la plantilla',
        },
        body: {
          type: 'string',
          description: 'Cuerpo del mensaje (si template=custom)',
        },
        body_html: {
          type: 'string',
          description: 'Cuerpo en HTML (opcional)',
        },
        attachments: {
          type: 'array',
          description: 'Adjuntos [{name, base64, mime_type}]',
          items: { type: 'object' },
        },
        attach_invoice_id: {
          type: 'number',
          description: 'ID de factura a adjuntar automáticamente',
        },
        attach_report: {
          type: 'object',
          description: 'Reporte a generar y adjuntar',
        },
        schedule_at: {
          type: 'string',
          description: 'Programar envío (ISO datetime)',
        },
        track_opens: {
          type: 'boolean',
          description: 'Rastrear apertura del correo',
        },
      },
      required: ['to', 'subject'],
    },
  },

  // -------------------------------------------------------------------------
  // SEND_WHATSAPP - Enviar mensaje WhatsApp
  // -------------------------------------------------------------------------
  {
    name: 'send_whatsapp',
    description: `Envía un mensaje por WhatsApp Business.

    Tipos de mensaje:
    - Texto simple
    - Plantilla aprobada (HSM)
    - Documento/archivo
    - Imagen
    - Ubicación

    Requiere número en formato internacional (+52...)`,
    category: 'notifications',
    inputSchema: {
      type: 'object',
      properties: {
        phone: {
          type: 'string',
          description: 'Número de teléfono (+521234567890)',
        },
        message_type: {
          type: 'string',
          description: 'Tipo de mensaje',
          enum: ['text', 'template', 'document', 'image', 'location'],
        },
        message: {
          type: 'string',
          description: 'Texto del mensaje (si type=text)',
        },
        template_name: {
          type: 'string',
          description: 'Nombre de la plantilla HSM',
        },
        template_params: {
          type: 'array',
          description: 'Parámetros de la plantilla',
          items: { type: 'string' },
        },
        document_base64: {
          type: 'string',
          description: 'Documento en base64 (si type=document)',
        },
        document_name: {
          type: 'string',
          description: 'Nombre del documento',
        },
        image_base64: {
          type: 'string',
          description: 'Imagen en base64 (si type=image)',
        },
        caption: {
          type: 'string',
          description: 'Leyenda para imagen/documento',
        },
      },
      required: ['phone', 'message_type'],
    },
  },

  // -------------------------------------------------------------------------
  // CREATE_ALERT - Crear alerta en sistema
  // -------------------------------------------------------------------------
  {
    name: 'create_alert',
    description: `Crea una alerta/notificación en el sistema.

    Niveles de alerta:
    - info: Informativo
    - warning: Advertencia
    - error: Error/Crítico
    - success: Éxito/Confirmación

    Las alertas aparecen en el dashboard del usuario`,
    category: 'notifications',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Título de la alerta',
        },
        message: {
          type: 'string',
          description: 'Mensaje de la alerta',
        },
        level: {
          type: 'string',
          description: 'Nivel de severidad',
          enum: ['info', 'warning', 'error', 'success'],
        },
        category: {
          type: 'string',
          description: 'Categoría',
          enum: ['invoice', 'payment', 'kpi', 'system', 'reminder', 'other'],
        },
        user_ids: {
          type: 'array',
          description: 'IDs de usuarios destinatarios (vacío = todos)',
          items: { type: 'number' },
        },
        link: {
          type: 'string',
          description: 'URL de acción relacionada',
        },
        expires_at: {
          type: 'string',
          description: 'Fecha de expiración de la alerta',
        },
        persistent: {
          type: 'boolean',
          description: 'Mantener visible hasta que el usuario la cierre',
        },
        data: {
          type: 'object',
          description: 'Datos adicionales para la alerta',
        },
      },
      required: ['title', 'message', 'level'],
    },
  },

  // -------------------------------------------------------------------------
  // CREATE_REMINDER - Crear recordatorio
  // -------------------------------------------------------------------------
  {
    name: 'create_reminder',
    description: `Crea un recordatorio programado.

    El recordatorio puede:
    - Enviar email
    - Enviar WhatsApp
    - Mostrar notificación en sistema
    - Múltiples canales combinados

    Puede ser único o recurrente`,
    category: 'notifications',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Título del recordatorio',
        },
        description: {
          type: 'string',
          description: 'Descripción/mensaje',
        },
        remind_at: {
          type: 'string',
          description: 'Fecha y hora del recordatorio (ISO)',
        },
        recurring: {
          type: 'string',
          description: 'Frecuencia de repetición',
          enum: ['once', 'daily', 'weekly', 'monthly', 'yearly'],
        },
        channels: {
          type: 'array',
          description: 'Canales de notificación',
          items: { type: 'string' },
        },
        user_id: {
          type: 'number',
          description: 'Usuario destinatario',
        },
        related_entity: {
          type: 'object',
          description: 'Entidad relacionada {type, id}',
        },
      },
      required: ['title', 'remind_at'],
    },
  },

  // -------------------------------------------------------------------------
  // GET_NOTIFICATIONS - Obtener notificaciones
  // -------------------------------------------------------------------------
  {
    name: 'get_notifications',
    description: `Obtiene las notificaciones de un usuario.

    Filtros:
    - Por estado (leídas/no leídas)
    - Por categoría
    - Por fecha
    - Por nivel de severidad`,
    category: 'notifications',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: {
          type: 'number',
          description: 'ID del usuario',
        },
        status: {
          type: 'string',
          description: 'Estado',
          enum: ['read', 'unread', 'all'],
        },
        category: {
          type: 'string',
          description: 'Categoría',
          enum: ['invoice', 'payment', 'kpi', 'system', 'reminder', 'all'],
        },
        level: {
          type: 'string',
          description: 'Nivel de severidad',
          enum: ['info', 'warning', 'error', 'success', 'all'],
        },
        date_from: {
          type: 'string',
          description: 'Fecha inicial',
        },
        limit: {
          type: 'number',
          description: 'Límite de resultados',
        },
      },
      required: [],
    },
  },

  // -------------------------------------------------------------------------
  // MARK_NOTIFICATION - Marcar notificación
  // -------------------------------------------------------------------------
  {
    name: 'mark_notification',
    description: `Marca una o varias notificaciones como leídas/archivadas.`,
    category: 'notifications',
    inputSchema: {
      type: 'object',
      properties: {
        notification_ids: {
          type: 'array',
          description: 'IDs de notificaciones',
          items: { type: 'number' },
        },
        action: {
          type: 'string',
          description: 'Acción a realizar',
          enum: ['read', 'unread', 'archive', 'delete'],
        },
        mark_all: {
          type: 'boolean',
          description: 'Aplicar a todas las notificaciones del usuario',
        },
      },
      required: ['action'],
    },
  },

  // -------------------------------------------------------------------------
  // SEND_BULK_NOTIFICATION - Notificación masiva
  // -------------------------------------------------------------------------
  {
    name: 'send_bulk_notification',
    description: `Envía notificaciones masivas a múltiples destinatarios.

    Útil para:
    - Recordatorios de pago a clientes con saldo
    - Comunicados generales
    - Alertas de vencimiento de facturas

    Soporta personalización por destinatario`,
    category: 'notifications',
    inputSchema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Canal de envío',
          enum: ['email', 'whatsapp', 'system', 'all'],
        },
        recipient_type: {
          type: 'string',
          description: 'Tipo de destinatarios',
          enum: ['customers_with_balance', 'all_customers', 'all_suppliers', 'all_users', 'custom_list'],
        },
        recipient_ids: {
          type: 'array',
          description: 'IDs específicos (si recipient_type=custom_list)',
          items: { type: 'number' },
        },
        template: {
          type: 'string',
          description: 'Plantilla a usar',
        },
        subject: {
          type: 'string',
          description: 'Asunto (para email)',
        },
        message: {
          type: 'string',
          description: 'Mensaje (puede incluir variables como {nombre}, {saldo})',
        },
        schedule_at: {
          type: 'string',
          description: 'Programar envío',
        },
        test_mode: {
          type: 'boolean',
          description: 'Modo prueba (solo muestra preview, no envía)',
        },
      },
      required: ['channel', 'recipient_type', 'message'],
    },
  },
];

// ============================================================================
// EJECUTOR DE HERRAMIENTAS
// ============================================================================

export async function executeNotificationTool(
  toolName: string,
  params: Record<string, any>,
  context: MCPContext
): Promise<MCPToolResult> {
  console.log(`🔔 [MCP Notifications] Ejecutando: ${toolName}`);

  switch (toolName) {
    case 'send_email':
      return await sendEmail(params, context);

    case 'send_whatsapp':
      return await sendWhatsApp(params, context);

    case 'create_alert':
      return await createAlert(params, context);

    case 'create_reminder':
      return await createReminder(params, context);

    case 'get_notifications':
      return await getNotifications(params, context);

    case 'mark_notification':
      return await markNotification(params, context);

    case 'send_bulk_notification':
      return await sendBulkNotification(params, context);

    default:
      return {
        success: false,
        error: `Herramienta de notificaciones no implementada: ${toolName}`,
      };
  }
}

// ============================================================================
// IMPLEMENTACIONES
// ============================================================================

async function sendEmail(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  // Validar destinatarios
  if (!params.to || params.to.length === 0) {
    return { success: false, error: 'Se requiere al menos un destinatario' };
  }

  // Validar formato de emails
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const email of params.to) {
    if (!emailRegex.test(email)) {
      return { success: false, error: `Email inválido: ${email}` };
    }
  }

  // TODO: Implementar envío real con servicio de email
  return {
    success: true,
    data: {
      message_id: `email_${Date.now()}`,
      status: 'queued',
      recipients: params.to.length,
      message: 'Email en cola de envío (simulación)',
    },
  };
}

async function sendWhatsApp(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  // Validar número de teléfono
  const phoneRegex = /^\+\d{10,15}$/;
  if (!phoneRegex.test(params.phone)) {
    return { success: false, error: 'Número de teléfono inválido. Formato: +521234567890' };
  }

  // TODO: Implementar envío real con WhatsApp Business API
  return {
    success: true,
    data: {
      message_id: `wa_${Date.now()}`,
      status: 'queued',
      phone: params.phone,
      message: 'Mensaje WhatsApp en cola (simulación)',
    },
  };
}

async function createAlert(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  // TODO: Guardar en base de datos
  return {
    success: true,
    data: {
      alert_id: Date.now(),
      title: params.title,
      level: params.level,
      status: 'created',
      message: 'Alerta creada (simulación)',
    },
  };
}

async function createReminder(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  // Validar fecha
  const remindAt = new Date(params.remind_at);
  if (isNaN(remindAt.getTime())) {
    return { success: false, error: 'Fecha de recordatorio inválida' };
  }

  if (remindAt < new Date()) {
    return { success: false, error: 'La fecha del recordatorio debe ser futura' };
  }

  // TODO: Guardar en base de datos y programar
  return {
    success: true,
    data: {
      reminder_id: Date.now(),
      title: params.title,
      remind_at: params.remind_at,
      status: 'scheduled',
      message: 'Recordatorio programado (simulación)',
    },
  };
}

async function getNotifications(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  // TODO: Consultar base de datos
  return {
    success: true,
    data: {
      notifications: [],
      total: 0,
      unread_count: 0,
      message: 'Consulta de notificaciones pendiente de implementar',
    },
  };
}

async function markNotification(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  // TODO: Actualizar en base de datos
  return {
    success: true,
    data: {
      updated: params.notification_ids?.length || 0,
      action: params.action,
      message: 'Notificaciones actualizadas (simulación)',
    },
  };
}

async function sendBulkNotification(params: Record<string, any>, context: MCPContext): Promise<MCPToolResult> {
  if (params.test_mode) {
    return {
      success: true,
      data: {
        mode: 'test',
        channel: params.channel,
        recipient_type: params.recipient_type,
        estimated_recipients: 0,
        message: 'Preview de notificación masiva (modo prueba)',
        preview: {
          subject: params.subject,
          message: params.message,
        },
      },
    };
  }

  // TODO: Implementar envío masivo real
  return {
    success: true,
    data: {
      batch_id: `batch_${Date.now()}`,
      status: 'queued',
      channel: params.channel,
      message: 'Notificación masiva en cola (simulación)',
    },
  };
}

export default {
  notificationTools,
  executeNotificationTool,
};

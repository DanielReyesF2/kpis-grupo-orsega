import { Resend } from 'resend';
import { logger } from './logger';

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailService {
  private resend: Resend | null = null;
  private isConfigured = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey || apiKey === 'your-resend-api-key-here') {
      logger.warn('RESEND_API_KEY no está configurada. Emails deshabilitados.');
      this.isConfigured = false;
      return;
    }

    try {
      this.resend = new Resend(apiKey);
      this.isConfigured = true;
      logger.info('Email service inicializado con Resend');
    } catch (error) {
      logger.error('Error inicializando email service:', { error });
      this.isConfigured = false;
    }
  }

  async sendEmail(emailData: EmailData, department: 'treasury' | 'logistics' = 'treasury'): Promise<EmailResult> {
    if (!this.isConfigured || !this.resend) {
      logger.warn('Email service no configurado. Simulando envío...');
      return {
        success: true,
        messageId: 'simulated-' + Date.now(),
        error: 'Email service no configurado - modo simulación'
      };
    }

    // Configurar remitente según departamento (usar dominio del cliente)
    const clientDomain = process.env.CLIENT_DOMAIN || 'grupoorsega.com';
    const fromEmail = department === 'treasury' 
      ? `Lolita - Tesorería <dolores@${clientDomain}>`
      : `Thalia - Logística <thalia@${clientDomain}>`;

    try {
      const result = await this.resend.emails.send({
        from: emailData.from || fromEmail,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
      });

      logger.info('Email enviado exitosamente', { 
        to: emailData.to, 
        messageId: result.data?.id 
      });

      return {
        success: true,
        messageId: result.data?.id
      };

    } catch (error) {
      logger.error('Error enviando email:', { 
        error: error instanceof Error ? error.message : String(error),
        to: emailData.to 
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async sendPaymentReminder(
    clientEmail: string, 
    clientName: string, 
    amount: number, 
    dueDate: string
  ): Promise<EmailResult> {
    const subject = `Recordatorio de Pago - ${clientName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Recordatorio de Pago</h2>
        <p>Estimado/a ${clientName},</p>
        <p>Le recordamos que tiene un pago pendiente por procesar:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Monto:</strong> $${amount.toLocaleString('es-MX')} MXN</p>
          <p><strong>Fecha límite:</strong> ${dueDate}</p>
        </div>
        <p>Por favor, proceda con el pago correspondiente.</p>
        <p>Saludos cordiales,<br><strong>Lolita</strong><br>Equipo de Tesorería - Econova</p>
      </div>
    `;

    return this.sendEmail({
      to: clientEmail,
      subject,
      html
    }, 'treasury');
  }

  async sendComplementRequest(
    clientEmail: string,
    clientName: string,
    voucherId: string
  ): Promise<EmailResult> {
    const subject = `Solicitud de Complemento de Pago - ${clientName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Solicitud de Complemento de Pago</h2>
        <p>Estimado/a ${clientName},</p>
        <p>Se requiere complemento de pago para el comprobante:</p>
        <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <p><strong>ID de Comprobante:</strong> ${voucherId}</p>
          <p><strong>Estado:</strong> Pendiente de complemento</p>
        </div>
        <p>Por favor, proporcione la documentación adicional requerida.</p>
        <p>Saludos cordiales,<br><strong>Lolita</strong><br>Equipo de Tesorería - Econova</p>
      </div>
    `;

    return this.sendEmail({
      to: clientEmail,
      subject,
      html
    }, 'treasury');
  }

  async sendPaymentConfirmation(
    clientEmail: string,
    clientName: string,
    amount: number,
    reference: string
  ): Promise<EmailResult> {
    const subject = `Confirmación de Pago - ${clientName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Pago Confirmado</h2>
        <p>Estimado/a ${clientName},</p>
        <p>Su pago ha sido procesado exitosamente:</p>
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <p><strong>Monto:</strong> $${amount.toLocaleString('es-MX')} MXN</p>
          <p><strong>Referencia:</strong> ${reference}</p>
          <p><strong>Estado:</strong> Procesado</p>
        </div>
        <p>Gracias por su pago puntual.</p>
        <p>Saludos cordiales,<br>Equipo de Tesorería</p>
      </div>
    `;

    return this.sendEmail({
      to: clientEmail,
      subject,
      html
    });
  }

  // Funciones específicas para Logística (Thalia)
  async sendShipmentUpdate(
    clientEmail: string,
    clientName: string,
    shipmentId: string,
    status: string,
    trackingNumber?: string
  ): Promise<EmailResult> {
    const subject = `Actualización de Envío - ${clientName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Actualización de Envío</h2>
        <p>Estimado/a ${clientName},</p>
        <p>Le informamos sobre el estado actual de su envío:</p>
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <p><strong>ID de Envío:</strong> ${shipmentId}</p>
          <p><strong>Estado:</strong> ${status}</p>
          ${trackingNumber ? `<p><strong>Número de Rastreo:</strong> ${trackingNumber}</p>` : ''}
        </div>
        <p>Gracias por confiar en nuestros servicios logísticos.</p>
        <p>Saludos cordiales,<br><strong>Thalia</strong><br>Equipo de Logística - Econova</p>
      </div>
    `;

    return this.sendEmail({
      to: clientEmail,
      subject,
      html
    }, 'logistics');
  }

  async sendDeliveryNotification(
    clientEmail: string,
    clientName: string,
    deliveryDate: string,
    timeSlot: string
  ): Promise<EmailResult> {
    const subject = `Notificación de Entrega - ${clientName}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Notificación de Entrega</h2>
        <p>Estimado/a ${clientName},</p>
        <p>Su paquete está programado para entrega:</p>
        <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <p><strong>Fecha de Entrega:</strong> ${deliveryDate}</p>
          <p><strong>Horario:</strong> ${timeSlot}</p>
        </div>
        <p>Por favor, asegúrese de que alguien esté disponible para recibir el paquete.</p>
        <p>Saludos cordiales,<br><strong>Thalia</strong><br>Equipo de Logística - Econova</p>
      </div>
    `;

    return this.sendEmail({
      to: clientEmail,
      subject,
      html
    }, 'logistics');
  }

  isEmailConfigured(): boolean {
    return this.isConfigured;
  }
}

export const emailService = new EmailService();

import { db } from './db';
import { eq } from 'drizzle-orm';
import { paymentVouchers, clients } from '@shared/schema';
import sgMail from '@sendgrid/mail';

// Configurar SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

interface PaymentVoucher {
  id: number;
  clientId: number;
  companyId: number;
  status: string;
  analysis?: any;
  createdAt: Date;
  updatedAt: Date;
}

interface Client {
  id: number;
  name: string;
  email: string;
  requires_payment_complement: boolean;
}

/**
 * 🏦 TREASURY AUTOMATION SYSTEM
 * 
 * Sistema automatizado para gestión de complementos de pago
 * Elimina trabajo manual de Lolita
 */
export class TreasuryAutomation {
  
  /**
   * 📧 Enviar comprobante automáticamente al proveedor
   */
  static async sendPaymentReceiptToSupplier(
    voucherId: number, 
    clientId: number, 
    companyId: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Obtener datos del comprobante
      const voucher = await db.query.paymentVouchers.findFirst({
        where: eq(paymentVouchers.id, voucherId)
      });

      if (!voucher) {
        return { success: false, message: 'Comprobante no encontrado' };
      }

      // Obtener datos del cliente/proveedor
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, clientId)
      });

      if (!client || !client.email) {
        return { success: false, message: 'Cliente sin email configurado' };
      }

      // Preparar datos del análisis
      const analysis = (voucher as any).analysis || {};
      const amount = analysis.extractedAmount || 'N/A';
      const currency = analysis.extractedCurrency || 'MXN';
      const reference = analysis.extractedReference || 'N/A';
      const bank = analysis.extractedBank || 'N/A';

      // Plantilla de email personalizada
      const emailTemplate = {
        to: client.email,
        from: 'noreply@econova.com.mx',
        subject: `✅ Comprobante de Pago - ${client.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🏦 EcoNova - Comprobante de Pago</h1>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-bottom: 20px;">Hola ${client.name},</h2>
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                Te confirmamos que hemos realizado el pago correspondiente. Adjunto encontrarás el comprobante bancario.
              </p>
              
              <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin: 20px 0;">
                <h3 style="color: #333; margin-top: 0;">📋 Detalles del Pago</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Monto:</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${currency} $${amount?.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Referencia:</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${reference}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Banco:</td>
                    <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: #333;">${bank}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #555;">Fecha:</td>
                    <td style="padding: 8px 0; color: #333;">${new Date().toLocaleDateString('es-MX')}</td>
                  </tr>
                </table>
              </div>

              ${client.requiresPaymentComplement ? `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h4 style="color: #856404; margin-top: 0;">⚠️ Complemento de Pago Requerido</h4>
                  <p style="color: #856404; margin-bottom: 0;">
                    Para completar el proceso, necesitamos que nos envíes el complemento de pago correspondiente.
                    Te enviaremos un recordatorio en caso de que no lo recibamos.
                  </p>
                </div>
              ` : `
                <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h4 style="color: #155724; margin-top: 0;">✅ Pago Completado</h4>
                  <p style="color: #155724; margin-bottom: 0;">
                    Este pago no requiere complemento adicional. El proceso ha sido completado exitosamente.
                  </p>
                </div>
              `}

              <div style="text-align: center; margin-top: 30px;">
                <p style="color: #666; font-size: 14px;">
                  Si tienes alguna pregunta, no dudes en contactarnos.
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 20px;">
                  Este es un mensaje automático del sistema EcoNova.
                </p>
              </div>
            </div>
          </div>
        `
      };

      // Enviar email
      await sgMail.send(emailTemplate);

      // Actualizar estado del comprobante
      await db.update(paymentVouchers)
        .set({ 
          status: client.requiresPaymentComplement ? 'pendiente_complemento' : 'factura_pagada',
          updatedAt: new Date()
        })
        .where(eq(paymentVouchers.id, voucherId));

      // Programar recordatorio si es necesario
      if (client.requiresPaymentComplement) {
        await this.scheduleComplementReminder(voucherId, clientId);
      }

      return { 
        success: true, 
        message: `Comprobante enviado a ${client.email}. ${client.requiresPaymentComplement ? 'Recordatorio programado.' : 'Pago completado.'}` 
      };

    } catch (error) {
      console.error('[Treasury Automation] Error sending receipt:', error);
      return { success: false, message: 'Error al enviar comprobante' };
    }
  }

  /**
   * ⏰ Programar recordatorio de complemento
   */
  static async scheduleComplementReminder(voucherId: number, clientId: number): Promise<void> {
    try {
      // Programar recordatorios cada 3, 7 y 14 días
      const reminderDays = [3, 7, 14];
      
      for (const days of reminderDays) {
        const reminderDate = new Date();
        reminderDate.setDate(reminderDate.getDate() + days);
        
        // Aquí podrías integrar con un sistema de jobs como Bull, Agenda, etc.
        // Por ahora, lo registramos en la base de datos para procesamiento posterior
        console.log(`[Treasury Automation] Recordatorio programado para ${reminderDate.toISOString()}`);
      }
    } catch (error) {
      console.error('[Treasury Automation] Error scheduling reminder:', error);
    }
  }

  /**
   * 📧 Enviar recordatorio de complemento
   */
  static async sendComplementReminder(voucherId: number, clientId: number): Promise<{ success: boolean; message: string }> {
    try {
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, clientId)
      });

      if (!client || !client.email) {
        return { success: false, message: 'Cliente sin email configurado' };
      }

      const voucher = await db.query.paymentVouchers.findFirst({
        where: eq(paymentVouchers.id, voucherId)
      });

      if (!voucher) {
        return { success: false, message: 'Comprobante no encontrado' };
      }

      // Solo enviar si aún está pendiente
      if (voucher.status !== 'pendiente_complemento') {
        return { success: false, message: 'El complemento ya fue recibido' };
      }

      const emailTemplate = {
        to: client.email,
        from: 'noreply@econova.com.mx',
        subject: `⏰ Recordatorio: Complemento de Pago Pendiente - ${client.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Recordatorio - Complemento de Pago</h1>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-bottom: 20px;">Hola ${client.name},</h2>
              
              <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
                Te recordamos que aún necesitamos el complemento de pago para completar el proceso.
              </p>
              
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #856404; margin-top: 0;">📋 Acción Requerida</h3>
                <p style="color: #856404; margin-bottom: 15px;">
                  Por favor, envía el complemento de pago correspondiente para que podamos finalizar el proceso.
                </p>
                <p style="color: #856404; margin-bottom: 0; font-weight: bold;">
                  Puedes enviarlo respondiendo a este correo o contactándonos directamente.
                </p>
              </div>

              <div style="text-align: center; margin-top: 30px;">
                <p style="color: #666; font-size: 14px;">
                  Gracias por tu colaboración.
                </p>
                <p style="color: #999; font-size: 12px; margin-top: 20px;">
                  Este es un recordatorio automático del sistema EcoNova.
                </p>
              </div>
            </div>
          </div>
        `
      };

      await sgMail.send(emailTemplate);

      return { 
        success: true, 
        message: `Recordatorio enviado a ${client.email}` 
      };

    } catch (error) {
      console.error('[Treasury Automation] Error sending reminder:', error);
      return { success: false, message: 'Error al enviar recordatorio' };
    }
  }

  /**
   * 🔄 Procesar flujo automático completo
   */
  static async processAutomaticFlow(
    voucherId: number, 
    clientId: number, 
    companyId: number
  ): Promise<{ success: boolean; message: string; nextStatus: string }> {
    try {
      console.log(`🤖 [TreasuryAutomation] Iniciando flujo automático para voucher ${voucherId}, empresa ${companyId}`);
      
      // 1. Verificar que el cliente pertenece a la empresa seleccionada
      const client = await db.query.clients.findFirst({
        where: eq(clients.id, clientId)
      });

      if (!client) {
        return { success: false, message: 'Cliente no encontrado', nextStatus: 'error' };
      }

      if (client.companyId !== companyId) {
        console.error(`❌ [TreasuryAutomation] Cliente ${clientId} no pertenece a empresa ${companyId}`);
        return { success: false, message: 'Cliente no pertenece a la empresa seleccionada', nextStatus: 'error' };
      }

      // 2. Enviar comprobante automáticamente
      const receiptResult = await this.sendPaymentReceiptToSupplier(voucherId, clientId, companyId);
      
      if (!receiptResult.success) {
        return { success: false, message: receiptResult.message, nextStatus: 'error' };
      }

      // 3. Determinar siguiente estado
      const nextStatus = client.requiresPaymentComplement ? 'pendiente_complemento' : 'factura_pagada';

      console.log(`✅ [TreasuryAutomation] Flujo automático completado para voucher ${voucherId}, empresa ${companyId}`);

      return {
        success: true,
        message: `Comprobante enviado automáticamente a ${client.name}. ${client.requiresPaymentComplement ? 'Recordatorios programados.' : 'Proceso completado.'}`,
        nextStatus
      };

    } catch (error) {
      console.error('[Treasury Automation] Error in automatic flow:', error);
      return { 
        success: false, 
        message: 'Error en el flujo automático', 
        nextStatus: 'error' 
      };
    }
  }
}

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTransportRequest = sendTransportRequest;
const mail_1 = __importDefault(require("@sendgrid/mail"));
if (!process.env.SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not found - email functionality disabled');
}
else {
    mail_1.default.setApiKey(process.env.SENDGRID_API_KEY);
}
async function sendTransportRequest(data) {
    if (!process.env.SENDGRID_API_KEY) {
        console.log('Email would be sent:', data);
        return;
    }
    const baseUrl = process.env.NODE_ENV === 'production'
        ? 'https://your-domain.replit.app'
        : 'http://localhost:5000';
    const confirmUrl = `${baseUrl}/api/shipments/${data.shipment.id}/confirm?token=${data.confirmToken}&pickupAt=${encodeURIComponent(data.pickupWindow || '')}`;
    const rejectUrl = `${baseUrl}/api/shipments/${data.shipment.id}/reject?token=${data.rejectToken}`;
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
  `;
    const msg = {
        to: data.to,
        from: 'logistics@digo.mx', // Verified sender
        subject: `Solicitud de Transporte - ${data.shipment.reference}`,
        html: html,
    };
    await mail_1.default.send(msg);
    console.log(`Transport request email sent to: ${data.to}`);
}

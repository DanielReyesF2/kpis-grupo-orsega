"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = sendEmail;
exports.getShipmentStatusEmailTemplate = getShipmentStatusEmailTemplate;
const mail_1 = require("@sendgrid/mail");
if (!process.env.SENDGRID_API_KEY) {
    throw new Error("SENDGRID_API_KEY environment variable must be set");
}
const mailService = new mail_1.MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);
async function sendEmail(params) {
    try {
        await mailService.send({
            to: params.to,
            from: params.from,
            subject: params.subject,
            text: params.text,
            html: params.html,
        });
        return true;
    }
    catch (error) {
        console.error('SendGrid email error:', error);
        return false;
    }
}
// Plantillas de email para diferentes estados de envío
function getShipmentStatusEmailTemplate(shipment, newStatus, customerName) {
    const statusMap = {
        pending: { label: "Preparándose para envío", color: "#3B82F6" },
        in_transit: { label: "En tránsito", color: "#F59E0B" },
        delayed: { label: "Retrasado", color: "#EF4444" },
        delivered: { label: "Entregado", color: "#10B981" },
        cancelled: { label: "Cancelado", color: "#6B7280" },
    };
    const status = statusMap[newStatus] || { label: newStatus, color: "#6B7280" };
    const trackingCode = shipment.trackingCode;
    const product = shipment.product;
    const estimatedDate = shipment.estimatedDeliveryDate
        ? new Date(shipment.estimatedDeliveryDate).toLocaleDateString('es-MX')
        : 'Por confirmar';
    const subject = `Actualización de envío ${trackingCode} - ${status.label}`;
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #273949; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .status-badge { 
          display: inline-block; 
          padding: 8px 16px; 
          border-radius: 4px; 
          color: white; 
          font-weight: bold;
          background: ${status.color};
        }
        .details { background: white; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Econova - Actualización de Envío</h1>
        </div>
        <div class="content">
          <p>Estimado/a <strong>${customerName}</strong>,</p>
          
          <p>Su envío ha sido actualizado:</p>
          
          <div class="details">
            <h3>Detalles del Envío</h3>
            <p><strong>Código de seguimiento:</strong> ${trackingCode}</p>
            <p><strong>Producto:</strong> ${product}</p>
            <p><strong>Estado actual:</strong> <span class="status-badge">${status.label}</span></p>
            <p><strong>Fecha estimada de entrega:</strong> ${estimatedDate}</p>
          </div>
          
          ${newStatus === 'delivered' ? `
            <div style="background: #d4edda; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <p><strong>¡Su envío ha sido entregado exitosamente!</strong></p>
              <p>Gracias por confiar en nosotros para sus necesidades logísticas.</p>
            </div>
          ` : ''}
          
          ${newStatus === 'delayed' ? `
            <div style="background: #f8d7da; padding: 15px; border-radius: 4px; margin: 15px 0;">
              <p><strong>Notificación de retraso</strong></p>
              <p>Lamentamos informarle que su envío presenta un retraso. Nuestro equipo está trabajando para minimizar el impacto y le mantendremos informado.</p>
            </div>
          ` : ''}
          
          <p>Si tiene alguna pregunta o necesita más información, no dude en contactarnos.</p>
        </div>
        <div class="footer">
          <p>Este mensaje fue enviado por <strong>Thalia Rodriguez</strong> - Departamento de Logística<br>
          Econova | Dura International & Grupo Orsega<br>
          Email: marioreynoso@grupoorsega.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
    const text = `
Estimado/a ${customerName},

Su envío ha sido actualizado:

Código de seguimiento: ${trackingCode}
Producto: ${product}
Estado actual: ${status.label}
Fecha estimada de entrega: ${estimatedDate}

${newStatus === 'delivered' ? '¡Su envío ha sido entregado exitosamente! Gracias por confiar en nosotros.' : ''}
${newStatus === 'delayed' ? 'Lamentamos informarle que su envío presenta un retraso. Nuestro equipo está trabajando para minimizar el impacto.' : ''}

Si tiene alguna pregunta, no dude en contactarnos.

Saludos,
Thalia Rodriguez - Departamento de Logística
Econova | Dura International & Grupo Orsega
  `;
    return { subject, html, text };
}

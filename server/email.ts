import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await sgMail.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    console.log(`[Email] Correo enviado exitosamente a ${params.to}`);
    return true;
  } catch (error) {
    console.error('[Email] Error al enviar correo:', error);
    return false;
  }
}

// Template para mensajes del equipo
export function createTeamMessageTemplate(
  senderName: string,
  recipientName: string,
  title: string,
  message: string,
  type: string,
  priority: string
): { html: string; text: string } {
  const priorityColor = priority === 'urgent' ? '#ef4444' : 
                       priority === 'high' ? '#f59e0b' : 
                       priority === 'normal' ? '#3b82f6' : '#6b7280';
  
  const typeIcon = type === 'success' ? '✅' : 
                  type === 'warning' ? '⚠️' : 
                  type === 'error' ? '❌' : 'ℹ️';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mensaje del Equipo - Econova</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f8fafc;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border: 1px solid #e2e8f0;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #273949;
        }
        .logo {
          font-size: 24px;
          font-weight: bold;
          color: #273949;
          margin-bottom: 10px;
        }
        .subtitle {
          color: #64748b;
          font-size: 14px;
        }
        .message-header {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
          padding: 15px;
          background: #f1f5f9;
          border-radius: 8px;
          border-left: 4px solid ${priorityColor};
        }
        .message-icon {
          font-size: 24px;
          margin-right: 15px;
        }
        .message-info {
          flex: 1;
        }
        .message-title {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 5px;
        }
        .message-meta {
          font-size: 14px;
          color: #64748b;
        }
        .message-content {
          background: #fefefe;
          padding: 25px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          margin: 20px 0;
          font-size: 16px;
          line-height: 1.7;
        }
        .sender-info {
          margin-top: 25px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
        }
        .sender-name {
          font-weight: 600;
          color: #273949;
          margin-bottom: 5px;
        }
        .company-info {
          color: #64748b;
          font-size: 14px;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          color: #64748b;
          font-size: 12px;
        }
        .priority-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          background: ${priorityColor};
          color: white;
          margin-left: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">ECONOVA</div>
          <div class="subtitle">Sistema de Gestión de KPIs</div>
        </div>
        
        <div class="message-header">
          <div class="message-icon">${typeIcon}</div>
          <div class="message-info">
            <div class="message-title">
              ${title}
              <span class="priority-badge">${priority === 'urgent' ? 'Urgente' : priority === 'high' ? 'Alta' : priority === 'normal' ? 'Normal' : 'Baja'}</span>
            </div>
            <div class="message-meta">Mensaje del equipo para ${recipientName}</div>
          </div>
        </div>
        
        <div class="message-content">
          ${message.replace(/\n/g, '<br>')}
        </div>
        
        <div class="sender-info">
          <div class="sender-name">Enviado por: Mario Reynoso (Gerente General)</div>
          <div class="company-info">Econova - Dura International & Grupo Orsega</div>
        </div>
        
        <div class="footer">
          <p>Este mensaje fue enviado desde el sistema de gestión de KPIs de Econova.</p>
          <p>Para responder, inicia sesión en el sistema o contacta directamente al remitente.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
ECONOVA - Sistema de Gestión de KPIs

${typeIcon} ${title}
Prioridad: ${priority === 'urgent' ? 'Urgente' : priority === 'high' ? 'Alta' : priority === 'normal' ? 'Normal' : 'Baja'}

Para: ${recipientName}
De: Mario Reynoso (Gerente General)

Mensaje:
${message}

---
Este mensaje fue enviado desde el sistema de gestión de KPIs de Econova.
Para responder, inicia sesión en el sistema o contacta directamente al remitente.
  `.trim();

  return { html, text };
}
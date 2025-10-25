import { Resend } from 'resend';

async function testEmail() {
  const resend = new Resend('re_3sVCjjkK_K4oPVDP6qPZZCJMegHFTKypy');
  
  try {
    console.log('📧 Enviando email de prueba...');
    
    const result = await resend.emails.send({
      from: 'Lolita - Tesorería <lolita@grupoorsega.com.mx>',
      to: 'daniel@econova.com.mx',
      subject: 'Prueba de Email - Sistema Econova',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">✅ Email de Prueba Exitoso</h2>
          <p>Este es un email de prueba del sistema de Econova.</p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Departamento:</strong> Tesorería</p>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString('es-MX')}</p>
            <p><strong>Estado:</strong> ✅ Funcionando correctamente</p>
          </div>
          <p>El sistema de emails está configurado y funcionando.</p>
          <p>Saludos,<br>Equipo de Desarrollo - Econova</p>
        </div>
      `
    });

    console.log('✅ Email enviado exitosamente!');
    console.log('📧 Message ID:', result.data?.id);
    
  } catch (error) {
    console.error('❌ Error enviando email:', error);
  }
}

testEmail();

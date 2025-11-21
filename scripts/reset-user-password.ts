import { neon } from '@neondatabase/serverless';
import { hash } from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const sqlClient = neon(process.env.DATABASE_URL!);

async function resetPassword() {
  const email = process.argv[2] || 'doloresnavarro@grupoorsega.com';
  const newPassword = process.argv[3] || 'password123';
  
  try {
    console.log(`🔍 Buscando usuario: ${email}`);
    
    // Buscar usuario
    const userResult = await sqlClient`
      SELECT id, email, name
      FROM users
      WHERE LOWER(email) = LOWER(${email})
    `;
    
    if (userResult.length === 0) {
      console.log('❌ Usuario no encontrado');
      return;
    }
    
    const user = userResult[0];
    console.log(`✅ Usuario encontrado: ${user.name} (ID: ${user.id})`);
    
    // Hash de la nueva contraseña
    const hashedPassword = await hash(newPassword, 10);
    console.log('🔐 Contraseña hasheada');
    
    // Actualizar contraseña
    await sqlClient`
      UPDATE users
      SET password = ${hashedPassword}
      WHERE id = ${user.id}
    `;
    
    console.log(`✅ Contraseña actualizada exitosamente`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Nueva contraseña: ${newPassword}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

resetPassword();


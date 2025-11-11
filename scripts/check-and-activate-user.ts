import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const sqlClient = neon(process.env.DATABASE_URL!);

async function checkAndActivateUser() {
  const email = 'daniel@econova.com.mx';
  
  try {
    console.log(`🔍 Verificando usuario: ${email}`);
    
    // Buscar usuario
    const userResult = await sqlClient`
      SELECT id, email, name, role, "isActive", "companyId"
      FROM users
      WHERE LOWER(email) = LOWER(${email})
    `;
    
    if (userResult.length === 0) {
      console.log('❌ Usuario no encontrado en la base de datos');
      return;
    }
    
    const user = userResult[0];
    console.log('✅ Usuario encontrado:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nombre: ${user.name}`);
    console.log(`   Rol: ${user.role}`);
    console.log(`   Activo: ${user.isActive}`);
    console.log(`   Company ID: ${user.companyId}`);
    
    if (!user.isActive) {
      console.log('\n⚠️  Usuario está INACTIVO. Activando...');
      
      await sqlClient`
        UPDATE users
        SET "isActive" = true
        WHERE id = ${user.id}
      `;
      
      console.log('✅ Usuario activado exitosamente');
    } else {
      console.log('\n✅ Usuario ya está activo');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAndActivateUser();


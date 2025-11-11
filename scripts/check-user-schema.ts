import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config();

const sqlClient = neon(process.env.DATABASE_URL!);

async function checkUserSchema() {
  const email = 'daniel@econova.com.mx';
  
  try {
    console.log(`🔍 Verificando usuario: ${email}`);
    
    // Primero verificar qué columnas tiene la tabla users
    const columnsResult = await sqlClient`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `;
    
    console.log('\n📋 Columnas de la tabla users:');
    columnsResult.forEach((col: any) => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    // Buscar usuario
    const userResult = await sqlClient`
      SELECT *
      FROM users
      WHERE LOWER(email) = LOWER(${email})
    `;
    
    if (userResult.length === 0) {
      console.log('\n❌ Usuario no encontrado en la base de datos');
      return;
    }
    
    const user = userResult[0];
    console.log('\n✅ Usuario encontrado:');
    console.log(JSON.stringify(user, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkUserSchema();


/**
 * Script para agregar Mario Reynoso al sistema
 */

import { Pool } from '@neondatabase/serverless';
import bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function addMario() {
  try {
    // Encriptar password
    const hashedPassword = await bcrypt.hash('mario2025', 10);
    
    // Verificar si Mario ya existe
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['mario.reynoso@econova.com']
    );
    
    if (existingUser.rows.length > 0) {
      console.log('Mario Reynoso ya existe en el sistema');
      return;
    }
    
    // Insertar Mario
    await pool.query(
      'INSERT INTO users (name, email, password, role, company_id) VALUES ($1, $2, $3, $4, $5)',
      ['Mario Reynoso', 'mario.reynoso@econova.com', hashedPassword, 'manager', 1]
    );
    
    console.log('✓ Mario Reynoso agregado exitosamente');
    console.log('  Usuario: mario.reynoso');
    console.log('  Contraseña: mario2025');
    console.log('  Rol: manager (acceso ejecutivo)');
    
  } catch (error) {
    console.error('Error agregando Mario:', error);
  } finally {
    process.exit(0);
  }
}

addMario();
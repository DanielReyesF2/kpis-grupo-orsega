/**
 * Script para agregar Mario Reynoso usando la API del sistema
 */

import bcrypt from 'bcrypt';

async function addMarioViaAPI() {
  try {
    // Primero login como admin
    const loginResponse = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'password123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error('Error en login admin');
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;

    // Verificar si Mario ya existe
    const usersResponse = await fetch('http://localhost:5000/api/users', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!usersResponse.ok) {
      throw new Error('Error obteniendo usuarios');
    }

    const users = await usersResponse.json();
    const existingMario = users.find(u => u.email === 'mario.reynoso@econova.com');

    if (existingMario) {
      console.log('Mario Reynoso ya existe en el sistema');
      return;
    }

    // Crear Mario
    // NOTE: Do NOT pre-hash the password — the API endpoint handles hashing
    const createResponse = await fetch('http://localhost:5000/api/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Mario Reynoso',
        email: 'mario.reynoso@econova.com',
        password: 'mario2025',
        role: 'manager',
        companyId: 1
      })
    });

    if (!createResponse.ok) {
      throw new Error('Error creando usuario Mario');
    }

    console.log('✓ Mario Reynoso agregado exitosamente');
    console.log('  Usuario: mario.reynoso');
    console.log('  Contraseña: mario2025');
    console.log('  Rol: manager (acceso ejecutivo)');
    
  } catch (error) {
    console.error('Error agregando Mario:', error);
  }
}

addMarioViaAPI();
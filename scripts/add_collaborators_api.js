/**
 * Script para agregar colaboradores usando la API del sistema
 */

import bcrypt from 'bcrypt';

async function addCollaboratorsViaAPI() {
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

    // Usuarios a agregar (colaboradores con acceso limitado)
    const collaborators = [
      {
        name: 'Thalia Hernandez',
        email: 'thalia@econova.com',
        password: 'thalia2025',
        role: 'collaborator',
        companyId: 1 // Dura International
      },
      {
        name: 'Omar Rodriguez',
        email: 'omar@econova.com',
        password: 'omar2025',
        role: 'collaborator',
        companyId: 2 // Grupo Orsega
      }
    ];

    // Crear cada colaborador
    for (const collaborator of collaborators) {
      const hashedPassword = await bcrypt.hash(collaborator.password, 10);
      
      const createResponse = await fetch('http://localhost:5000/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: collaborator.name,
          email: collaborator.email,
          password: hashedPassword,
          role: collaborator.role,
          companyId: collaborator.companyId
        })
      });

      if (!createResponse.ok) {
        console.error(`Error creando usuario ${collaborator.name}`);
        continue;
      }

      console.log(`✓ ${collaborator.name} agregado exitosamente`);
      console.log(`  Email: ${collaborator.email}`);
      console.log(`  Contraseña: ${collaborator.password}`);
      console.log(`  Rol: ${collaborator.role} (acceso limitado)`);
      console.log(`  Empresa: ${collaborator.companyId === 1 ? 'Dura International' : 'Grupo Orsega'}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('Error agregando colaboradores:', error);
  }
}

addCollaboratorsViaAPI();
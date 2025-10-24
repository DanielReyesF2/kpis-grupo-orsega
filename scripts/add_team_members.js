/**
 * Script para agregar colaboradores del equipo al sistema
 * Este script agrega los usuarios proporcionados por el cliente
 */

import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import bcrypt from 'bcrypt';

// Get temporary password from environment variable for security
const TEMP_PASSWORD = process.env.TEAM_TEMP_PASSWORD;
if (!TEMP_PASSWORD) {
  console.error('❌ Error: TEAM_TEMP_PASSWORD environment variable is required');
  process.exit(1);
}

const teamMembers = [
  {
    name: "Omar Navarro",
    email: "omar.navarro@econova.com",
    role: "collaborator",
    companyId: 1, // Dura International
    password: TEMP_PASSWORD
  },
  {
    name: "Thalia Rodriguez",
    email: "thalia.rodriguez@econova.com", 
    role: "collaborator",
    companyId: 2, // Grupo Orsega
    password: TEMP_PASSWORD
  },
  {
    name: "Guadalupe Navarro",
    email: "guadalupe.navarro@econova.com",
    role: "collaborator", 
    companyId: 1, // Dura International
    password: TEMP_PASSWORD
  },
  {
    name: "Andrea Navarro",
    email: "andrea.navarro@econova.com",
    role: "collaborator",
    companyId: 2, // Grupo Orsega
    password: TEMP_PASSWORD
  },
  {
    name: "Miranda de Koster",
    email: "miranda.dekoster@econova.com",
    role: "collaborator",
    companyId: 1, // Dura International
    password: TEMP_PASSWORD
  },
  {
    name: "Jesus Martinez",
    email: "jesus.martinez@econova.com",
    role: "collaborator",
    companyId: 2, // Grupo Orsega
    password: TEMP_PASSWORD
  },
  {
    name: "Guillermo Galindo",
    email: "guillermo.galindo@econova.com",
    role: "collaborator",
    companyId: 1, // Dura International
    password: TEMP_PASSWORD
  },
  {
    name: "Julio Hernandez",
    email: "julio.hernandez@econova.com",
    role: "collaborator",
    companyId: 2, // Grupo Orsega
    password: TEMP_PASSWORD
  }
];

async function addTeamMembers() {
  try {
    console.log('🚀 Iniciando proceso de adición de colaboradores...');
    
    for (const member of teamMembers) {
      console.log(`➕ Agregando: ${member.name}`);
      
      // Verificar si el usuario ya existe
      const existingUser = await db.select()
        .from(users)
        .where(eq(users.email, member.email))
        .limit(1);
      
      if (existingUser.length > 0) {
        console.log(`⚠️  ${member.name} ya existe en el sistema`);
        continue;
      }
      
      // Encriptar contraseña
      const hashedPassword = await bcrypt.hash(member.password, 10);
      
      // Crear usuario
      const newUser = await db.insert(users).values({
        name: member.name,
        email: member.email,
        password: hashedPassword,
        role: member.role,
        companyId: member.companyId
      }).returning();
      
      console.log(`✅ ${member.name} agregado exitosamente - ID: ${newUser[0].id}`);
    }
    
    console.log('🎉 Todos los colaboradores han sido agregados exitosamente!');
    
    // Mostrar resumen
    const totalUsers = await db.select().from(users);
    console.log(`📊 Total de usuarios en el sistema: ${totalUsers.length}`);
    
    const collaborators = totalUsers.filter(user => user.role === 'collaborator');
    console.log(`👥 Total de colaboradores: ${collaborators.length}`);
    
  } catch (error) {
    console.error('❌ Error al agregar colaboradores:', error);
  } finally {
    process.exit(0);
  }
}

// Ejecutar el script
addTeamMembers();
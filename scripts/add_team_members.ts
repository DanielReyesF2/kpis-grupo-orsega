/**
 * Script para agregar colaboradores del equipo al sistema
 */

import { db } from '../server/db.js';
import { users } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const teamMembers = [
  {
    name: "Omar Navarro",
    email: "omar.navarro@econova.com",
    role: "collaborator" as const,
    companyId: 1, // Dura International
    password: process.env.TEAM_MEMBER_TEMP_PASSWORD || "TEMP_PASSWORD_NOT_SET"
  },
  {
    name: "Thalia Rodriguez",
    email: "thalia.rodriguez@econova.com", 
    role: "collaborator" as const,
    companyId: 2, // Grupo Orsega
    password: process.env.TEAM_MEMBER_TEMP_PASSWORD || "TEMP_PASSWORD_NOT_SET"
  },
  {
    name: "Guadalupe Navarro",
    email: "guadalupe.navarro@econova.com",
    role: "collaborator" as const, 
    companyId: 1, // Dura International
    password: process.env.TEAM_MEMBER_TEMP_PASSWORD || "TEMP_PASSWORD_NOT_SET"
  },
  {
    name: "Andrea Navarro",
    email: "andrea.navarro@econova.com",
    role: "collaborator" as const,
    companyId: 2, // Grupo Orsega
    password: process.env.TEAM_MEMBER_TEMP_PASSWORD || "TEMP_PASSWORD_NOT_SET"
  },
  {
    name: "Miranda de Koster",
    email: "miranda.dekoster@econova.com",
    role: "collaborator" as const,
    companyId: 1, // Dura International
    password: process.env.TEAM_MEMBER_TEMP_PASSWORD || "TEMP_PASSWORD_NOT_SET"
  },
  {
    name: "Jesus Martinez",
    email: "jesus.martinez@econova.com",
    role: "collaborator" as const,
    companyId: 2, // Grupo Orsega
    password: process.env.TEAM_MEMBER_TEMP_PASSWORD || "TEMP_PASSWORD_NOT_SET"
  },
  {
    name: "Guillermo Galindo",
    email: "guillermo.galindo@econova.com",
    role: "collaborator" as const,
    companyId: 1, // Dura International
    password: process.env.TEAM_MEMBER_TEMP_PASSWORD || "TEMP_PASSWORD_NOT_SET"
  },
  {
    name: "Julio Hernandez",
    email: "julio.hernandez@econova.com",
    role: "collaborator" as const,
    companyId: 2, // Grupo Orsega
    password: process.env.TEAM_MEMBER_TEMP_PASSWORD || "TEMP_PASSWORD_NOT_SET"
  }
];

async function addTeamMembers() {
  try {
    // Verificar que la variable de entorno esté configurada
    if (!process.env.TEAM_MEMBER_TEMP_PASSWORD) {
      console.error('ERROR: TEAM_MEMBER_TEMP_PASSWORD environment variable is required');
      process.exit(1);
    }
    
    console.log('Iniciando proceso de adición de colaboradores...');
    
    for (const member of teamMembers) {
      console.log(`Agregando: ${member.name}`);
      
      // Verificar si el usuario ya existe
      const existingUser = await db.select()
        .from(users)
        .where(eq(users.email, member.email))
        .limit(1);
      
      if (existingUser.length > 0) {
        console.log(`${member.name} ya existe en el sistema`);
        continue;
      }
      
      // Encriptar contraseña
      const hashedPassword = await bcrypt.hash(member.password, 10);
      
      // Crear usuario sin especificar ID (auto-increment)
      const [newUser] = await db.insert(users).values({
        name: member.name,
        email: member.email,
        password: hashedPassword,
        role: member.role,
        companyId: member.companyId
      }).returning();
      
      console.log(`${member.name} agregado exitosamente - ID: ${newUser.id}`);
    }
    
    console.log('Todos los colaboradores han sido agregados exitosamente!');
    
    // Mostrar resumen
    const totalUsers = await db.select().from(users);
    console.log(`Total de usuarios en el sistema: ${totalUsers.length}`);
    
    const collaborators = totalUsers.filter(user => user.role === 'collaborator');
    console.log(`Total de colaboradores: ${collaborators.length}`);
    
  } catch (error) {
    console.error('Error al agregar colaboradores:', error);
  }
}

// Ejecutar el script
addTeamMembers().then(() => {
  console.log('Script completado');
  process.exit(0);
});
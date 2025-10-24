/**
 * Script para corregir y completar los datos de usuarios
 */

// Load passwords from environment variables for security
const DEFAULT_USER_PASSWORD = process.env.DEFAULT_USER_PASSWORD || (() => {
  console.warn('⚠️  DEFAULT_USER_PASSWORD not set - using fallback. Set environment variable for production.');
  return 'changeMe123';
})();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (() => {
  console.warn('⚠️  ADMIN_PASSWORD not set - using fallback. Set environment variable for production.');
  return 'changeMe123';
})();

const correctUsers = [
  {
    name: "Omar Navarro",
    email: "omar.navarro@econova.com",
    role: "collaborator",
    companyId: 1,
    password: DEFAULT_USER_PASSWORD
  },
  {
    name: "Thalia Rodriguez",
    email: "thalia.rodriguez@econova.com", 
    role: "collaborator",
    companyId: 2,
    password: DEFAULT_USER_PASSWORD
  },
  {
    name: "Guadalupe Navarro",
    email: "guadalupe.navarro@econova.com",
    role: "collaborator",
    companyId: 1,
    password: DEFAULT_USER_PASSWORD
  },
  {
    name: "Andrea Navarro",
    email: "andrea.navarro@econova.com",
    role: "collaborator",
    companyId: 2,
    password: DEFAULT_USER_PASSWORD
  },
  {
    name: "Miranda de Koster",
    email: "miranda.dekoster@econova.com",
    role: "collaborator",
    companyId: 1,
    password: DEFAULT_USER_PASSWORD
  },
  {
    name: "Jesus Martinez",
    email: "jesus.martinez@econova.com",
    role: "collaborator",
    companyId: 2,
    password: DEFAULT_USER_PASSWORD
  },
  {
    name: "Guillermo Galindo",
    email: "guillermo.galindo@econova.com",
    role: "collaborator",
    companyId: 1,
    password: DEFAULT_USER_PASSWORD
  },
  {
    name: "Julio Hernandez",
    email: "julio.hernandez@econova.com",
    role: "collaborator",
    companyId: 2,
    password: DEFAULT_USER_PASSWORD
  },
  {
    name: "Mario Reynoso",
    email: "mario.reynoso@econova.com",
    role: "admin",
    companyId: null,
    password: ADMIN_PASSWORD
  }
];

async function fixUsersData() {
  console.log('Corrigiendo datos de usuarios...');
  
  // Obtener token de admin
  const loginResponse = await fetch('http://localhost:5000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: ADMIN_PASSWORD
    })
  });
  
  const loginData = await loginResponse.json();
  const token = loginData.token;
  
  console.log('Token obtenido, procesando usuarios...');
  
  // Primero obtener usuarios actuales
  const usersResponse = await fetch('http://localhost:5000/api/users', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const currentUsers = await usersResponse.json();
  
  console.log('Usuarios actuales:', currentUsers.length);
  
  let processed = 0;
  
  for (const userData of correctUsers) {
    try {
      // Verificar si ya existe por email
      const existingUser = currentUsers.find(u => u.email === userData.email);
      
      if (existingUser) {
        console.log(`⚠️  ${userData.name} ya existe - actualizando...`);
        
        // Actualizar usuario existente
        const updateResponse = await fetch(`http://localhost:5000/api/users/${existingUser.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: userData.name,
            email: userData.email,
            role: userData.role,
            companyId: userData.companyId
          })
        });
        
        if (updateResponse.ok) {
          console.log(`✅ ${userData.name} actualizado correctamente`);
        } else {
          console.log(`❌ Error actualizando ${userData.name}`);
        }
      } else {
        console.log(`➕ Agregando nuevo usuario: ${userData.name}`);
        
        // Crear nuevo usuario
        const createResponse = await fetch('http://localhost:5000/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(userData)
        });
        
        if (createResponse.ok) {
          const newUser = await createResponse.json();
          console.log(`✅ ${userData.name} creado - ID: ${newUser.id}`);
        } else {
          const error = await createResponse.text();
          console.log(`❌ Error creando ${userData.name}: ${error}`);
        }
      }
      
      processed++;
    } catch (error) {
      console.log(`❌ Error procesando ${userData.name}:`, error.message);
    }
  }
  
  // Verificar resultado final
  const finalUsersResponse = await fetch('http://localhost:5000/api/users', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const finalUsers = await finalUsersResponse.json();
  
  console.log(`\n📊 Resumen final:`);
  console.log(`- Usuarios procesados: ${processed}`);
  console.log(`- Total usuarios en sistema: ${finalUsers.length}`);
  console.log(`- Colaboradores: ${finalUsers.filter(u => u.role === 'collaborator').length}`);
  console.log(`- Administradores: ${finalUsers.filter(u => u.role === 'admin').length}`);
  
  console.log('\n👥 Lista completa de usuarios:');
  finalUsers.forEach(user => {
    console.log(`- ${user.name} (${user.email}) - ${user.role} - Empresa: ${user.companyId || 'N/A'}`);
  });
}

fixUsersData().catch(console.error);
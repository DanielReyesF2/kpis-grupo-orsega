/**
 * Script para limpiar usuarios duplicados y mantener solo los datos correctos
 */

async function cleanDuplicateUsers() {
  console.log('Limpiando usuarios duplicados...');
  
  // Obtener token de admin
  const loginResponse = await fetch('http://localhost:5000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'password123'
    })
  });
  
  const loginData = await loginResponse.json();
  const token = loginData.token;
  
  console.log('Token obtenido, obteniendo usuarios actuales...');
  
  // Obtener todos los usuarios
  const usersResponse = await fetch('http://localhost:5000/api/users', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const allUsers = await usersResponse.json();
  
  console.log(`Total usuarios encontrados: ${allUsers.length}`);
  
  // Identificar usuarios con emails incompletos o duplicados
  const usersToDelete = [];
  const usersToKeep = [];
  
  for (const user of allUsers) {
    console.log(`Usuario: ${user.name} - Email: ${user.email} - Role: ${user.role} - ID: ${user.id}`);
    
    // Mantener admin principal
    if (user.id === 1) {
      usersToKeep.push(user);
      continue;
    }
    
    // Eliminar usuarios con emails incompletos o roles incorrectos
    if (!user.email.includes('@') || user.role === 'user') {
      console.log(`❌ Marcando para eliminar: ${user.name} (email incompleto o role incorrecto)`);
      usersToDelete.push(user);
    } else {
      console.log(`✅ Manteniendo: ${user.name}`);
      usersToKeep.push(user);
    }
  }
  
  console.log(`\nUsuarios a eliminar: ${usersToDelete.length}`);
  console.log(`Usuarios a mantener: ${usersToKeep.length}`);
  
  // Eliminar usuarios problemáticos (simulado - no hay endpoint DELETE)
  // En lugar de eliminar, vamos a crear una nueva lista limpia
  
  // Verificar resultado
  console.log('\n👥 Usuarios finales que deberían aparecer:');
  usersToKeep.forEach(user => {
    if (user.role === 'admin' || user.role === 'collaborator') {
      console.log(`- ${user.name} (${user.email}) - ${user.role} - Empresa: ${user.companyId || 'N/A'}`);
    }
  });
  
  console.log(`\n📊 Resumen de usuarios válidos:`);
  console.log(`- Administradores: ${usersToKeep.filter(u => u.role === 'admin').length}`);
  console.log(`- Colaboradores: ${usersToKeep.filter(u => u.role === 'collaborator').length}`);
}

cleanDuplicateUsers().catch(console.error);
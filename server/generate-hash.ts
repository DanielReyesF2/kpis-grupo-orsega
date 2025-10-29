// Script para generar hash de contraseña con bcrypt
import bcrypt from 'bcrypt';

async function generatePasswordHash() {
  const password = 'password123';
  const saltRounds = 10;
  
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('Password:', password);
    console.log('Hash:', hash);
    
    // Verificar que el hash funciona
    const isValid = await bcrypt.compare(password, hash);
    console.log('Hash verification:', isValid ? '✅ Valid' : '❌ Invalid');
    
    return hash;
  } catch (error) {
    console.error('Error generating hash:', error);
    return null;
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  generatePasswordHash().then(hash => {
    if (hash) {
      console.log('\n--- COPY THIS HASH FOR SQL ---');
      console.log(hash);
    }
    process.exit(0);
  });
}

export { generatePasswordHash };

// SCRIPT PARA RESETEAR CONTRASEÑA DE USUARIO
import 'dotenv/config';
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function resetUserPassword(email: string, newPassword: string) {
  try {
    console.log(`🔑 Reseteando contraseña para: ${email}...`);

    // Buscar usuario por email
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    
    if (!user) {
      console.log(`❌ Usuario no encontrado: ${email}`);
      return { success: false, message: `Usuario no encontrado: ${email}` };
    }

    console.log(`✅ Usuario encontrado: ID=${user.id}, Name=${user.name}, Email=${user.email}`);

    // Crear hash de la nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(`🔐 Hash generado: ${hashedPassword.substring(0, 20)}...`);

    // Actualizar contraseña
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, user.id));

    console.log(`✅ Contraseña actualizada exitosamente!`);
    console.log(`\n📋 Resumen:`);
    console.log(`   Email: ${email}`);
    console.log(`   Nueva contraseña: ${newPassword}`);
    console.log(`   ID Usuario: ${user.id}`);
    
    return { 
      success: true, 
      message: "Contraseña actualizada exitosamente",
      user: { id: user.id, name: user.name, email: user.email }
    };

  } catch (error) {
    console.error("❌ Error reseteando contraseña:", error);
    return { 
      success: false, 
      message: "Failed to reset password", 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const email = process.argv[2] || 'daniel@econova.com.mx';
  const newPassword = process.argv[3] || 'password123';
  
  console.log(`\n🚀 Iniciando reset de contraseña...\n`);
  
  resetUserPassword(email, newPassword).then(result => {
    if (result.success) {
      console.log(`\n✅ ${result.message}`);
      console.log(`\n💡 Ahora puedes iniciar sesión con:`);
      console.log(`   Email: ${email}`);
      console.log(`   Contraseña: ${newPassword}\n`);
    } else {
      console.log(`\n❌ ${result.message}\n`);
    }
    process.exit(result.success ? 0 : 1);
  });
}





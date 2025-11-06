// SCRIPT PARA CREAR USUARIO ADMIN
import 'dotenv/config';
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

export async function createAdminUser() {
  try {
    console.log("👤 Creando usuario admin...");

    // Verificar si ya existe un admin
    const existingAdmin = await db.select().from(users).where(eq(users.email, "admin@econova.com.mx")).limit(1);
    
    if (existingAdmin.length > 0) {
      console.log("✅ Usuario admin ya existe");
      return { success: true, message: "Admin user already exists", user: existingAdmin[0] };
    }

    // Crear hash de la contraseña
    const hashedPassword = await bcrypt.hash("admin123", 10);

    // Crear usuario admin
    const adminUser = {
      name: "Admin",
      email: "admin@econova.com.mx",
      password: hashedPassword,
      role: "admin",
      companyId: 1, // Dura International
      areaId: 1, // Ventas
      isActive: true
    };

    const [createdUser] = await db.insert(users).values(adminUser).returning();

    console.log("✅ Usuario admin creado exitosamente!");
    return { 
      success: true, 
      message: "Admin user created successfully",
      user: { id: createdUser.id, name: createdUser.name, email: createdUser.email }
    };

  } catch (error) {
    console.error("❌ Error creando usuario admin:", error);
    return { 
      success: false, 
      message: "Failed to create admin user", 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  createAdminUser().then(result => {
    console.log(result);
    process.exit(result.success ? 0 : 1);
  });
}

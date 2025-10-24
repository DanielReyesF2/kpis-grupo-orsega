/**
 * Script para asignar áreas específicas a los usuarios colaboradores
 */

import { db } from "../server/db.ts";
import { users } from "../shared/schema.ts";
import { eq } from "drizzle-orm";

async function assignUserAreas() {
  try {
    // Mapeo de usuarios a sus áreas correspondientes
    const userAreaAssignments = [
      // Ventas (área_id: 1)
      { name: "Omar Navarro", areaId: 1 },
      { name: "Miranda de Koster", areaId: 1 },
      { name: "Guillermo Galindo", areaId: 1 },
      
      // Logística (área_id: 2)
      { name: "Thalia Rodriguez", areaId: 2 },
      
      // Compras (área_id: 3)
      { name: "Andrea Navarro", areaId: 3 },
      
      // Almacén (área_id: 4)
      { name: "Jesus Martinez", areaId: 4 },
      
      // Tesorería (área_id: 5)
      { name: "Guadalupe Navarro", areaId: 5 },
    ];

    console.log("Asignando áreas a usuarios...");
    
    for (const assignment of userAreaAssignments) {
      const result = await db
        .update(users)
        .set({ areaId: assignment.areaId })
        .where(eq(users.name, assignment.name))
        .returning();
      
      if (result.length > 0) {
        console.log(`✅ ${assignment.name} asignado al área ${assignment.areaId}`);
      } else {
        console.log(`❌ Usuario no encontrado: ${assignment.name}`);
      }
    }

    console.log("\n✅ Asignación de áreas completada");
  } catch (error) {
    console.error("Error asignando áreas:", error);
  }
}

assignUserAreas();
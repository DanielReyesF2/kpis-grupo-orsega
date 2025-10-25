// SCRIPT PARA ACTUALIZAR CLIENTES CON COMPANY ID
import { db } from "./db";
import { clients } from "../shared/schema";
import { eq, isNull } from "drizzle-orm";

export async function updateClientsCompany() {
  try {
    console.log("🔄 Actualizando clientes con companyId...");

    // Obtener clientes sin companyId
    const clientsWithoutCompany = await db.select().from(clients).where(isNull(clients.companyId));
    console.log(`📊 Clientes sin companyId: ${clientsWithoutCompany.length}`);

    if (clientsWithoutCompany.length === 0) {
      console.log("✅ Todos los clientes ya tienen companyId asignado");
      return { success: true, message: "All clients already have companyId" };
    }

    // Asignar companyId basado en el nombre o email
    let updatedCount = 0;
    
    for (const client of clientsWithoutCompany) {
      let companyId = 1; // Default a Dura International
      
      // Lógica para asignar empresa basada en el nombre o email
      const name = client.name.toLowerCase();
      const email = client.email?.toLowerCase() || '';
      
      // Si contiene palabras clave de Orsega, asignar a Orsega (companyId: 2)
      if (name.includes('orsega') || 
          name.includes('ors') || 
          email.includes('orsega') ||
          name.includes('grupo') ||
          name.includes('industrial') ||
          name.includes('quimica') ||
          name.includes('resinas') ||
          name.includes('adhesivos') ||
          name.includes('laboratorios') ||
          name.includes('plastico') ||
          name.includes('meta') ||
          name.includes('aoc') ||
          name.includes('mexicana')) {
        companyId = 2; // Grupo Orsega
      }
      
      // Actualizar el cliente
      await db.update(clients)
        .set({ companyId })
        .where(eq(clients.id, client.id));
      
      updatedCount++;
      if (updatedCount % 10 === 0) {
        console.log(`✅ ${updatedCount} clientes actualizados...`);
      }
    }

    console.log(`✅ ${updatedCount} clientes actualizados exitosamente!`);

    // Verificar distribución final
    const duraClients = await db.select().from(clients).where(eq(clients.companyId, 1));
    const orsegaClients = await db.select().from(clients).where(eq(clients.companyId, 2));
    
    console.log(`📊 Dura International: ${duraClients.length} clientes`);
    console.log(`📊 Grupo Orsega: ${orsegaClients.length} clientes`);

    return { 
      success: true, 
      message: "Clients updated successfully",
      total: updatedCount,
      dura: duraClients.length,
      orsega: orsegaClients.length
    };

  } catch (error) {
    console.error("❌ Error actualizando clientes:", error);
    return { 
      success: false, 
      message: "Failed to update clients", 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  updateClientsCompany().then(result => {
    console.log(result);
    process.exit(result.success ? 0 : 1);
  });
}

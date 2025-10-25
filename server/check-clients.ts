// SCRIPT PARA VERIFICAR CLIENTES
import { db } from "./db";
import { clients } from "../shared/schema";
import { eq, isNull } from "drizzle-orm";

export async function checkClients() {
  try {
    console.log("🔍 Verificando clientes...");

    // Obtener todos los clientes
    const allClients = await db.select().from(clients);
    console.log(`📊 Total de clientes: ${allClients.length}`);

    // Clientes sin companyId
    const clientsWithoutCompany = await db.select().from(clients).where(isNull(clients.companyId));
    console.log(`📊 Clientes sin companyId: ${clientsWithoutCompany.length}`);

    // Clientes de Dura (companyId: 1)
    const duraClients = await db.select().from(clients).where(eq(clients.companyId, 1));
    console.log(`📊 Dura International: ${duraClients.length} clientes`);

    // Clientes de Orsega (companyId: 2)
    const orsegaClients = await db.select().from(clients).where(eq(clients.companyId, 2));
    console.log(`📊 Grupo Orsega: ${orsegaClients.length} clientes`);

    // Mostrar algunos ejemplos
    if (clientsWithoutCompany.length > 0) {
      console.log("\n🔍 Ejemplos de clientes sin companyId:");
      clientsWithoutCompany.slice(0, 5).forEach(client => {
        console.log(`  - ${client.name} (ID: ${client.id})`);
      });
    }

    if (orsegaClients.length > 0) {
      console.log("\n🔍 Ejemplos de clientes de Grupo Orsega:");
      orsegaClients.slice(0, 5).forEach(client => {
        console.log(`  - ${client.name} (ID: ${client.id})`);
      });
    }

    return { 
      success: true, 
      total: allClients.length,
      withoutCompany: clientsWithoutCompany.length,
      dura: duraClients.length,
      orsega: orsegaClients.length
    };

  } catch (error) {
    console.error("❌ Error verificando clientes:", error);
    return { 
      success: false, 
      message: "Failed to check clients", 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  checkClients().then(result => {
    console.log(result);
    process.exit(result.success ? 0 : 1);
  });
}

// SCRIPT PARA CREAR CLIENTES DE PRUEBA
import { db } from "./db";
import { clients } from "../shared/schema";

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedClients().then(result => {
    console.log(result);
    process.exit(result.success ? 0 : 1);
  });
}

export async function seedClients() {
  try {
    console.log("👥 Creando clientes de prueba...");

    // Verificar clientes existentes
    const existingClients = await db.select().from(clients);
    console.log(`📊 Clientes existentes: ${existingClients.length}`);

    if (existingClients.length > 0) {
      console.log("✅ Ya hay clientes en la base de datos");
      return { success: true, message: "Clients already exist", count: existingClients.length };
    }

    // Clientes para Dura International (companyId: 1)
    const duraClients = [
      {
        name: "Distribuidora Química del Pacífico",
        email: "contacto@distribuidoraquimica.com",
        phone: "+52-667-123-4567",
        address: "Av. del Mar 123, Mazatlán, Sinaloa",
        companyId: 1,
        requires_payment_complement: true,
        isActive: true,
        clientCode: "DUR-CLI-001",
        city: "Mazatlán",
        state: "Sinaloa"
      },
      {
        name: "Química Industrial del Norte",
        email: "ventas@quimicanorte.com",
        phone: "+52-871-234-5678",
        address: "Blvd. Independencia 456, Torreón, Coahuila",
        companyId: 1,
        requires_payment_complement: false,
        isActive: true,
        clientCode: "DUR-CLI-002",
        city: "Torreón",
        state: "Coahuila"
      },
      {
        name: "Agroquímicos del Bajío",
        email: "compras@agroquimicosbajio.com",
        phone: "+52-477-345-6789",
        address: "Calle Industrial 789, León, Guanajuato",
        companyId: 1,
        requires_payment_complement: true,
        isActive: true,
        clientCode: "DUR-CLI-003",
        city: "León",
        state: "Guanajuato"
      }
    ];

    // Clientes para Grupo Orsega (companyId: 2)
    const orsegaClients = [
      {
        name: "Productos Químicos Industriales",
        email: "contacto@pqi.com.mx",
        phone: "+52-33-456-7890",
        address: "Av. López Mateos 321, Guadalajara, Jalisco",
        companyId: 2,
        requires_payment_complement: true,
        isActive: true,
        clientCode: "ORS-CLI-001",
        city: "Guadalajara",
        state: "Jalisco"
      },
      {
        name: "Laboratorios Químicos de Occidente",
        email: "compras@labquimicos.com",
        phone: "+52-311-567-8901",
        address: "Calle Tecnológica 654, Tepic, Nayarit",
        companyId: 2,
        requires_payment_complement: false,
        isActive: true,
        clientCode: "ORS-CLI-002",
        city: "Tepic",
        state: "Nayarit"
      },
      {
        name: "Adhesivos Especializados",
        email: "ventas@adhesivos.com.mx",
        phone: "+52-442-678-9012",
        address: "Zona Industrial 987, Querétaro, Querétaro",
        companyId: 2,
        requires_payment_complement: true,
        isActive: true,
        clientCode: "ORS-CLI-003",
        city: "Querétaro",
        state: "Querétaro"
      },
      {
        name: "Proveedor de Servicios Químicos",
        email: "servicios@proveedorquimico.com",
        phone: "+52-55-789-0123",
        address: "Av. Insurgentes 147, Ciudad de México",
        companyId: 2,
        requires_payment_complement: false,
        isActive: true,
        clientCode: "ORS-CLI-004",
        city: "Ciudad de México",
        state: "CDMX"
      }
    ];

    // Insertar todos los clientes
    const allClients = [...duraClients, ...orsegaClients];
    await db.insert(clients).values(allClients);

    console.log(`✅ ${allClients.length} clientes creados exitosamente!`);
    console.log(`📊 Dura International: ${duraClients.length} clientes`);
    console.log(`📊 Grupo Orsega: ${orsegaClients.length} clientes`);

    return { 
      success: true, 
      message: "Clients created successfully",
      total: allClients.length,
      dura: duraClients.length,
      orsega: orsegaClients.length
    };

  } catch (error) {
    console.error("❌ Error creando clientes:", error);
    return { 
      success: false, 
      message: "Failed to create clients", 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

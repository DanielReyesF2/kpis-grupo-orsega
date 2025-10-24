// SCRIPT DE SEEDING PARA PRODUCTION
// Este script pobla la base de datos de producción con datos esenciales
import { db } from "./db";
import { companies, areas, kpis, users } from "../shared/schema";

export async function seedProductionData() {
  try {
    console.log("🌱 Iniciando seeding de datos de producción...");

    // 1. Verificar estado actual
    const existingCompanies = await db.select().from(companies);
    const existingAreas = await db.select().from(areas);
    const existingKpis = await db.select().from(kpis);
    
    console.log(`📊 Estado actual: companies=${existingCompanies.length}, areas=${existingAreas.length}, kpis=${existingKpis.length}`);
    
    if (existingCompanies.length >= 2 && existingAreas.length >= 12 && existingKpis.length >= 5) {
      console.log("✅ Base de datos ya tiene datos completos");
      return { 
        success: true, 
        message: "Database already seeded",
        companies: existingCompanies.length,
        areas: existingAreas.length,
        kpis: existingKpis.length
      };
    }

    // 2. Insertar companies solo si no existen
    let insertedCompanies = existingCompanies;
    if (existingCompanies.length < 2) {
      console.log("📊 Insertando companies faltantes...");
      
      // Verificar cuáles faltan
      const duraExists = existingCompanies.some(c => c.id === 1);
      const orsegaExists = existingCompanies.some(c => c.id === 2);
      
      const toInsert = [];
      if (!duraExists) {
        toInsert.push({
          id: 1,
          name: "Dura International",
          description: "Empresa líder en la industria química",
          sector: "Química"
        });
      }
      if (!orsegaExists) {
        toInsert.push({
          id: 2,
          name: "Grupo Orsega", 
          description: "Empresa especializada en productos químicos",
          sector: "Química"
        });
      }
      
      if (toInsert.length > 0) {
        await db.insert(companies).values(toInsert);
      }
      
      // Recargar companies
      insertedCompanies = await db.select().from(companies);
    }

    // 3. Insertar areas solo si no existen
    if (existingAreas.length < 12) {
      console.log("🏢 Insertando areas faltantes...");
      
      const areasToInsert = [
        { id: 1, name: "Ventas", description: "Área de Ventas para Dura International", companyId: 1 },
        { id: 2, name: "Logística", description: "Área de Logística para Dura International", companyId: 1 },
        { id: 3, name: "Contabilidad y Finanzas", description: "Área de Contabilidad y Finanzas para Dura International", companyId: 1 },
        { id: 4, name: "Ventas", description: "Área de Ventas para Grupo Orsega", companyId: 2 },
        { id: 5, name: "Logística", description: "Área de Logística para Grupo Orsega", companyId: 2 },
        { id: 6, name: "Contabilidad y Finanzas", description: "Área de Contabilidad y Finanzas para Grupo Orsega", companyId: 2 },
        { id: 7, name: "Compras", description: "Área de Compras para Dura International", companyId: 1 },
        { id: 8, name: "Almacén", description: "Área de Almacén para Dura International", companyId: 1 },
        { id: 9, name: "Tesorería", description: "Área de Tesorería para Dura International", companyId: 1 },
        { id: 10, name: "Compras", description: "Área de Compras para Grupo Orsega", companyId: 2 },
        { id: 11, name: "Almacén", description: "Área de Almacén para Grupo Orsega", companyId: 2 },
        { id: 12, name: "Tesorería", description: "Área de Tesorería para Grupo Orsega", companyId: 2 }
      ];
      
      // Filtrar areas que no existen
      const existingAreaIds = existingAreas.map(a => a.id);
      const newAreas = areasToInsert.filter(area => !existingAreaIds.includes(area.id));
      
      if (newAreas.length > 0) {
        await db.insert(areas).values(newAreas);
      }
    }

    // 4. Insertar KPIs solo si no existen
    if (existingKpis.length < 5) {
      console.log("📈 Insertando KPIs faltantes de Grupo Orsega...");
      
      const kpisToInsert = [
        {
          id: 2,
          name: "Precisión en estados financieros",
          description: "Mide la exactitud de los estados financieros generados. Objetivo: cero errores en emisión de información financiera.",
          areaId: 6,
          companyId: 2,
          unit: "%",
          target: "100%",
          frequency: "monthly",
          calculationMethod: "Conteo de errores y salvedades",
          responsible: "Mario Reynoso",
          invertedMetric: false
        },
        {
          id: 4,
          name: "Velocidad de rotación de cuentas por cobrar",
          description: "Mide el tiempo promedio para cobrar cuentas pendientes",
          areaId: 6,
          companyId: 2,
          unit: "días",
          target: "60 días",
          frequency: "monthly", 
          calculationMethod: "Promedio de días para cobrar",
          responsible: "Mario Reynoso",
          invertedMetric: true
        },
        {
          id: 6,
          name: "Cumplimiento de obligaciones fiscales",
          description: "Monitoreo mediante checklist para la presentación de impuestos",
          areaId: 6,
          companyId: 2,
          unit: "%",
          target: "100%",
          frequency: "monthly",
          calculationMethod: "Checklist de obligaciones fiscales",
          responsible: "Mario Reynoso",
          invertedMetric: false
        },
        {
          id: 8,
          name: "Facturación sin errores",
          description: "Mide la precisión en la generación de facturas",
          areaId: 6,
          companyId: 2,
          unit: "%",
          target: "100%",
          frequency: "weekly",
          calculationMethod: "(Facturas sin errores / Total de facturas) x 100",
          responsible: "Mario Reynoso",
          invertedMetric: false
        },
        {
          id: 10,
          name: "Volumen de ventas alcanzado",
          description: "Volumen de ventas en unidades",
          areaId: 4,
          companyId: 2,
          unit: "unidades",
          target: "10.300.476 unidades",
          frequency: "monthly",
          calculationMethod: "Suma de unidades vendidas en el período",
          responsible: "Omar Navarro",
          invertedMetric: false
        }
      ];
      
      // Filtrar KPIs que no existen
      const existingKpiIds = existingKpis.map(k => k.id);
      const newKpis = kpisToInsert.filter(kpi => !existingKpiIds.includes(kpi.id));
      
      if (newKpis.length > 0) {
        await db.insert(kpis).values(newKpis);
      }
    }

    // 5. Obtener conteos finales
    const finalCompanies = await db.select().from(companies);
    const finalAreas = await db.select().from(areas);
    const finalKpis = await db.select().from(kpis);
    
    console.log("✅ Seeding completado exitosamente!");
    return { 
      success: true, 
      message: "Production database seeded successfully",
      companies: finalCompanies.length,
      areas: finalAreas.length,
      kpis: finalKpis.length
    };

  } catch (error) {
    console.error("❌ Error durante el seeding:", error);
    return { 
      success: false, 
      message: "Seeding failed", 
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
// Script para verificar la conexión a la base de datos y ver qué datos existen
import 'dotenv/config';
import { db } from "./db";
import { users, companies, kpis, kpiValues } from "../shared/schema";
import { sql } from "drizzle-orm";

async function testConnection() {
  try {
    console.log("\n🔍 === DIAGNÓSTICO DE BASE DE DATOS ===\n");
    
    // Verificar DATABASE_URL
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error("❌ DATABASE_URL no está configurada");
      return;
    }
    
    console.log(`✅ DATABASE_URL configurada: ${dbUrl.substring(0, 50)}...`);
    console.log(`   Host: ${dbUrl.includes('neon.tech') ? 'Neon (Cloud)' : 'Local'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}\n`);
    
    // Test 1: Conexión básica
    console.log("📊 Test 1: Verificando conexión...");
    try {
      const result = await db.execute(sql`SELECT 1 as test`);
      console.log(`✅ Conexión exitosa: ${JSON.stringify(result)}`);
    } catch (error: any) {
      console.error(`❌ Error de conexión: ${error.message}`);
      return;
    }
    
    // Test 2: Contar usuarios
    console.log("\n📊 Test 2: Contando usuarios...");
    try {
      const userCount = await db.select().from(users);
      console.log(`✅ Usuarios encontrados: ${userCount.length}`);
      if (userCount.length > 0) {
        console.log(`   Primeros 3 usuarios:`);
        userCount.slice(0, 3).forEach(u => {
          console.log(`   - ${u.name} (${u.email}) - Rol: ${u.role}`);
        });
      }
    } catch (error: any) {
      console.error(`❌ Error contando usuarios: ${error.message}`);
    }
    
    // Test 3: Contar compañías
    console.log("\n📊 Test 3: Contando compañías...");
    try {
      const companiesList = await db.select().from(companies);
      console.log(`✅ Compañías encontradas: ${companiesList.length}`);
      companiesList.forEach(c => {
        console.log(`   - ${c.name} (ID: ${c.id})`);
      });
    } catch (error: any) {
      console.error(`❌ Error contando compañías: ${error.message}`);
    }
    
    // Test 4: Contar KPIs
    console.log("\n📊 Test 4: Contando KPIs...");
    try {
      const kpisList = await db.select().from(kpis);
      console.log(`✅ KPIs encontrados: ${kpisList.length}`);
      if (kpisList.length > 0) {
        console.log(`   Primeros 5 KPIs:`);
        kpisList.slice(0, 5).forEach(k => {
          console.log(`   - ${k.name} (ID: ${k.id}, Company: ${k.companyId})`);
        });
      }
    } catch (error: any) {
      console.error(`❌ Error contando KPIs: ${error.message}`);
    }
    
    // Test 5: Contar valores de KPI
    console.log("\n📊 Test 5: Contando valores de KPI...");
    try {
      const kpiValuesList = await db.select().from(kpiValues);
      console.log(`✅ Valores de KPI encontrados: ${kpiValuesList.length}`);
      if (kpiValuesList.length > 0) {
        console.log(`   Últimos 5 valores:`);
        kpiValuesList.slice(-5).forEach(kv => {
          console.log(`   - KPI ${kv.kpiId}: ${kv.value} (Periodo: ${kv.period})`);
        });
      }
    } catch (error: any) {
      console.error(`❌ Error contando valores de KPI: ${error.message}`);
    }
    
    // Test 6: Verificar tablas legacy (kpis_dura, kpis_orsega)
    console.log("\n📊 Test 6: Verificando tablas legacy...");
    try {
      const duraKpis = await db.execute(sql`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'kpis_dura'
      `);
      const orsegaKpis = await db.execute(sql`
        SELECT COUNT(*) as count FROM information_schema.tables 
        WHERE table_name = 'kpis_orsega'
      `);
      
      console.log(`✅ Tabla kpis_dura existe: ${duraKpis[0]?.count > 0}`);
      console.log(`✅ Tabla kpis_orsega existe: ${orsegaKpis[0]?.count > 0}`);
      
      // Intentar contar registros si las tablas existen
      try {
        const duraCount = await db.execute(sql`SELECT COUNT(*) as count FROM kpis_dura`);
        const orsegaCount = await db.execute(sql`SELECT COUNT(*) as count FROM kpis_orsega`);
        console.log(`   KPIs en kpis_dura: ${duraCount[0]?.count || 0}`);
        console.log(`   KPIs en kpis_orsega: ${orsegaCount[0]?.count || 0}`);
      } catch (e) {
        // Tablas pueden no existir
      }
    } catch (error: any) {
      console.error(`❌ Error verificando tablas legacy: ${error.message}`);
    }
    
    console.log("\n✅ === DIAGNÓSTICO COMPLETADO ===\n");
    
  } catch (error: any) {
    console.error("\n❌ ERROR GENERAL:", error);
    console.error("Stack:", error.stack);
  } finally {
    process.exit(0);
  }
}

testConnection();






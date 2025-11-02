#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';

async function checkTables() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL no encontrada');
    process.exit(1);
  }

  console.log('📊 Verificando tablas de KPIs en la base de datos...\n');
  const sql = neon(dbUrl);

  try {
    const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%kpi%' ORDER BY tablename`;
    
    console.log('Tablas KPI encontradas:');
    if (tables.length === 0) {
      console.log('   ❌ No se encontraron tablas con KPI en el nombre');
    } else {
      tables.forEach(t => console.log(`   - ${t.tablename}`));
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkTables();


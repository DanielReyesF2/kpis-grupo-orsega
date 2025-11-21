#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';

async function findTables() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL no encontrada');
    process.exit(1);
  }

  console.log('🔍 Buscando tablas de KPIs en todos los schemas...\n');
  const sql = neon(dbUrl);

  try {
    // Buscar en todos los schemas
    const allSchemas = await sql`SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'pg_toast', 'information_schema') ORDER BY schema_name`;
    
    console.log('Schemas encontrados:');
    allSchemas.forEach(s => console.log(`   - ${s.schema_name}`));
    
    console.log('\n\nBuscando tablas kpi* en cada schema:');
    for (const schema of allSchemas) {
      const tables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ${schema.schema_name}
        AND table_name LIKE 'kpi%'
        ORDER BY table_name
      `;
      
      if (tables.length > 0) {
        console.log(`\n✅ Schema: ${schema.schema_name}`);
        tables.forEach(t => console.log(`   - ${t.table_name}`));
      }
    }

    // Intentar query específico
    console.log('\n\nIntentando consultar tablas directamente:');
    try {
      const result = await sql`SELECT COUNT(*)::int as count FROM kpis_dura`;
      console.log(`✅ kpis_dura existe y tiene ${result[0].count} registros`);
    } catch (e: any) {
      console.log(`❌ kpis_dura no existe o no accesible: ${e.code}`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

findTables();


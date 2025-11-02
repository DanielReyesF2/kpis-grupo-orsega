#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';

async function testConnection() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL no encontrada');
    process.exit(1);
  }

  console.log(`🔗 Conectando a: ${dbUrl.substring(0, 50)}...\n`);
  const sql = neon(dbUrl);

  try {
    // Intentar consultar kpis_dura directamente
    console.log('1️⃣ Intentando consultar kpis_dura directamente...');
    try {
      const result = await sql`SELECT COUNT(*)::int as count FROM kpis_dura`;
      console.log(`   ✅ ÉXITO - kpis_dura existe y tiene ${result[0].count} registros`);
    } catch (e: any) {
      console.log(`   ❌ ERROR: ${e.message}`);
      console.log(`   Código: ${e.code}`);
    }

    // Intentar con información del schema
    console.log('\n2️⃣ Consultando information_schema...');
    try {
      const tables = await sql`
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_name IN ('kpis_dura', 'kpis_orsega', 'kpi_values_dura', 'kpi_values_orsega')
        ORDER BY table_schema, table_name
      `;
      if (tables.length > 0) {
        console.log('   Tablas encontradas:');
        tables.forEach(t => console.log(`   ${t.table_schema}.${t.table_name}`));
      } else {
        console.log('   ❌ No se encontraron las tablas');
      }
    } catch (e: any) {
      console.log(`   ❌ ERROR: ${e.message}`);
    }

    // Verificar current_schema
    console.log('\n3️⃣ Verificando schema actual...');
    try {
      const [schema] = await sql`SELECT current_schema()`;
      console.log(`   Schema actual: ${schema.current_schema}`);
      
      // Verificar search_path
      const [searchPath] = await sql`SHOW search_path`;
      console.log(`   Search path: ${searchPath.search_path}`);
    } catch (e: any) {
      console.log(`   ❌ ERROR: ${e.message}`);
    }

    // Intentar con pg_tables
    console.log('\n4️⃣ Usando pg_tables...');
    try {
      const tables = await sql`
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename IN ('kpis_dura', 'kpis_orsega', 'kpi_values_dura', 'kpi_values_orsega')
        ORDER BY schemaname, tablename
      `;
      if (tables.length > 0) {
        console.log('   Tablas encontradas:');
        tables.forEach(t => console.log(`   ${t.schemaname}.${t.tablename}`));
      } else {
        console.log('   ❌ No se encontraron las tablas');
      }
    } catch (e: any) {
      console.log(`   ❌ ERROR: ${e.message}`);
    }

  } catch (error: any) {
    console.error('❌ Error general:', error.message);
  }
}

testConnection();


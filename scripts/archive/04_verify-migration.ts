#!/usr/bin/env tsx
// Script para verificar que la migración fue exitosa
import { neon } from '@neondatabase/serverless';

async function verifyMigration() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL no encontrada');
    process.exit(1);
  }

  console.log('🔍 Verificando migración de KPIs...\n');
  const sql = neon(dbUrl);

  try {
    // Verificar mapeos
    console.log('1️⃣ Verificando mapeos:');
    const mappings = await sql`
      SELECT old_table, company_id, COUNT(*)::int as mapped_count
      FROM kpi_migration_map
      GROUP BY old_table, company_id
      ORDER BY company_id, old_table
    `;
    
    if (mappings.length === 0) {
      console.log('   ❌ No se encontraron mapeos. ¿Ejecutaste 02_migrate-kpis.sql?');
      process.exit(1);
    }
    
    mappings.forEach(m => console.log(`   ${m.old_table} (company ${m.company_id}): ${m.mapped_count} KPIs mapeados`));

    // Comparar conteos
    console.log('\n2️⃣ Comparando conteos de KPIs:');
    const [kpis_dura_count] = await sql`SELECT COUNT(*)::int as count FROM kpis_dura`;
    const [kpis_orsega_count] = await sql`SELECT COUNT(*)::int as count FROM kpis_orsega`;
    const [kpis_new_dura] = await sql`SELECT COUNT(*)::int as count FROM kpis WHERE company_id = 1`;
    const [kpis_new_orsega] = await sql`SELECT COUNT(*)::int as count FROM kpis WHERE company_id = 2`;
    
    console.log(`   kpis_dura: ${kpis_dura_count.count} → kpis (company=1): ${kpis_new_dura.count}`);
    console.log(`   kpis_orsega: ${kpis_orsega_count.count} → kpis (company=2): ${kpis_new_orsega.count}`);
    
    const dura_ok = kpis_dura_count.count === kpis_new_dura.count;
    const orsega_ok = kpis_orsega_count.count === kpis_new_orsega.count;
    
    console.log(`   Dura: ${dura_ok ? '✅' : '❌ LOS CONTEOS NO COINCIDEN'}`);
    console.log(`   Orsega: ${orsega_ok ? '✅' : '❌ LOS CONTEOS NO COINCIDEN'}`);

    // Comparar conteos de valores
    console.log('\n3️⃣ Comparando conteos de valores:');
    const [kpi_values_dura_count] = await sql`SELECT COUNT(*)::int as count FROM kpi_values_dura`;
    const [kpi_values_orsega_count] = await sql`SELECT COUNT(*)::int as count FROM kpi_values_orsega`;
    const [kpi_values_new_dura] = await sql`SELECT COUNT(*)::int as count FROM kpi_values kv JOIN kpis k ON k.id = kv.kpi_id WHERE k.company_id = 1 AND kv.user_id IS NULL`;
    const [kpi_values_new_orsega] = await sql`SELECT COUNT(*)::int as count FROM kpi_values kv JOIN kpis k ON k.id = kv.kpi_id WHERE k.company_id = 2 AND kv.user_id IS NULL`;
    
    console.log(`   kpi_values_dura: ${kpi_values_dura_count.count} → kpi_values (company=1): ${kpi_values_new_dura.count}`);
    console.log(`   kpi_values_orsega: ${kpi_values_orsega_count.count} → kpi_values (company=2): ${kpi_values_new_orsega.count}`);
    
    const dura_values_ok = kpi_values_dura_count.count === kpi_values_new_dura.count;
    const orsega_values_ok = kpi_values_orsega_count.count === kpi_values_new_orsega.count;
    
    console.log(`   Dura: ${dura_values_ok ? '✅' : '❌ LOS CONTEOS NO COINCIDEN'}`);
    console.log(`   Orsega: ${orsega_values_ok ? '✅' : '❌ LOS CONTEOS NO COINCIDEN'}`);

    // Verificar integridad de mapeos
    console.log('\n4️⃣ Verificando integridad de mapeos:');
    const unmapped = await sql`
      SELECT 
        'kpis_dura' as table_name,
        kd.id as old_id,
        kd.kpi_name
      FROM kpis_dura kd
      WHERE NOT EXISTS (
        SELECT 1 FROM kpi_migration_map m 
        WHERE m.old_id = kd.id AND m.old_table = 'kpis_dura'
      )
      UNION ALL
      SELECT 
        'kpis_orsega' as table_name,
        ko.id as old_id,
        ko.kpi_name
      FROM kpis_orsega ko
      WHERE NOT EXISTS (
        SELECT 1 FROM kpi_migration_map m 
        WHERE m.old_id = ko.id AND m.old_table = 'kpis_orsega'
      )
    `;
    
    if (unmapped.length > 0) {
      console.log(`   ⚠️ ${unmapped.length} KPIs no fueron mapeados:`);
      unmapped.forEach(u => console.log(`      ${u.table_name} ID ${u.old_id}: ${u.kpi_name}`));
    } else {
      console.log('   ✅ Todos los KPIs fueron mapeados correctamente');
    }

    // Verificar valores huérfanos
    console.log('\n5️⃣ Verificando valores sin KPI:');
    const orphaned_values = await sql`
      SELECT COUNT(*)::int as count FROM kpi_values_dura v
      WHERE NOT EXISTS (
        SELECT 1 FROM kpi_migration_map m 
        WHERE m.old_id = v.kpi_id AND m.old_table = 'kpis_dura'
      )
      UNION ALL
      SELECT COUNT(*)::int FROM kpi_values_orsega v
      WHERE NOT EXISTS (
        SELECT 1 FROM kpi_migration_map m 
        WHERE m.old_id = v.kpi_id AND m.old_table = 'kpis_orsega'
      )
    `;
    
    const total_orphaned = orphaned_values.reduce((sum, row) => sum + row.count, 0);
    if (total_orphaned > 0) {
      console.log(`   ⚠️ ${total_orphaned} valores no pudieron ser migrados (KPI no existe)`);
    } else {
      console.log('   ✅ Todos los valores pudieron ser migrados');
    }

    // Muestra de datos migrados
    console.log('\n6️⃣ Muestra de datos migrados (Dura):');
    const sample_dura = await sql`
      SELECT k.name, k.company_id, kv.period, kv.value, kv.date
      FROM kpi_values kv
      JOIN kpis k ON k.id = kv.kpi_id
      WHERE k.company_id = 1 AND kv.user_id IS NULL
      ORDER BY kv.date DESC
      LIMIT 5
    `;
    sample_dura.forEach(r => console.log(`   ${r.name}: ${r.period} = ${r.value}`));

    console.log('\n   Muestra de datos migrados (Orsega):');
    const sample_orsega = await sql`
      SELECT k.name, k.company_id, kv.period, kv.value, kv.date
      FROM kpi_values kv
      JOIN kpis k ON k.id = kv.kpi_id
      WHERE k.company_id = 2 AND kv.user_id IS NULL
      ORDER BY kv.date DESC
      LIMIT 5
    `;
    sample_orsega.forEach(r => console.log(`   ${r.name}: ${r.period} = ${r.value}`));

    // Resumen final
    console.log('\n' + '='.repeat(60));
    const all_ok = dura_ok && orsega_ok && dura_values_ok && orsega_values_ok && unmapped.length === 0 && total_orphaned === 0;
    
    if (all_ok) {
      console.log('✅ MIGRACIÓN EXITOSA - Todos los datos fueron migrados correctamente');
    } else {
      console.log('❌ MIGRACIÓN INCOMPLETA - Revisa los errores arriba');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
    process.exit(1);
  }
}

verifyMigration();


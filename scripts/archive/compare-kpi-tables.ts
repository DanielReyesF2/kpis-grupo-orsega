#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';

async function compareTables() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL no encontrada');
    process.exit(1);
  }

  console.log('🔍 Comparando datos entre tablas viejas y nuevas...\n');
  const sql = neon(dbUrl);

  try {
    // Comparar KPIs
    console.log('1️⃣ KPIs en kpis_dura:');
    const kpis_dura_count = await sql`SELECT COUNT(*)::int as count FROM kpis_dura`;
    const kpis_dura_list = await sql`SELECT id, kpi_name, area FROM kpis_dura ORDER BY id`;
    console.log(`   Total: ${kpis_dura_count[0].count}`);
    kpis_dura_list.forEach(k => console.log(`   ID ${k.id}: ${k.kpi_name} (${k.area})`));

    console.log('\n   KPIs en kpis (company=1):');
    const kpis_new_count = await sql`SELECT COUNT(*)::int as count FROM kpis WHERE company_id = 1`;
    const kpis_new_list = await sql`SELECT k.id, k.name, a.name as area FROM kpis k LEFT JOIN areas a ON a.id = k.area_id WHERE k.company_id = 1 ORDER BY k.id`;
    console.log(`   Total: ${kpis_new_count[0].count}`);
    kpis_new_list.forEach(k => console.log(`   ID ${k.id}: ${k.name} (${k.area})`));

    console.log('\n\n2️⃣ KPIs en kpis_orsega:');
    const kpis_orsega_count = await sql`SELECT COUNT(*)::int as count FROM kpis_orsega`;
    const kpis_orsega_list = await sql`SELECT id, kpi_name, area FROM kpis_orsega ORDER BY id`;
    console.log(`   Total: ${kpis_orsega_count[0].count}`);
    kpis_orsega_list.forEach(k => console.log(`   ID ${k.id}: ${k.kpi_name} (${k.area})`));

    console.log('\n   KPIs en kpis (company=2):');
    const kpis_new_orsega_count = await sql`SELECT COUNT(*)::int as count FROM kpis WHERE company_id = 2`;
    const kpis_new_orsega_list = await sql`SELECT k.id, k.name, a.name as area FROM kpis k LEFT JOIN areas a ON a.id = k.area_id WHERE k.company_id = 2 ORDER BY k.id`;
    console.log(`   Total: ${kpis_new_orsega_count[0].count}`);
    kpis_new_orsega_list.forEach(k => console.log(`   ID ${k.id}: ${k.name} (${k.area})`));

    // Comparar valores
    console.log('\n\n3️⃣ Valores en kpi_values_dura:');
    const values_dura_count = await sql`SELECT COUNT(*)::int as count FROM kpi_values_dura`;
    console.log(`   Total: ${values_dura_count[0].count}`);
    const values_dura_sample = await sql`SELECT kpi_id, month, year, value FROM kpi_values_dura ORDER BY year DESC, kpi_id LIMIT 5`;
    values_dura_sample.forEach(v => console.log(`   KPI ${v.kpi_id}: ${v.month} ${v.year} = ${v.value}`));

    console.log('\n   Valores en kpi_values (Dura, sin user_id):');
    const values_new_dura = await sql`SELECT kv.kpi_id, kv.period, kv.value FROM kpi_values kv JOIN kpis k ON k.id = kv.kpi_id WHERE k.company_id = 1 AND kv.user_id IS NULL ORDER BY kv.date DESC LIMIT 5`;
    values_new_dura.forEach(v => console.log(`   KPI ${v.kpi_id}: ${v.period} = ${v.value}`));

    console.log('\n\n4️⃣ Valores en kpi_values_orsega:');
    const values_orsega_count = await sql`SELECT COUNT(*)::int as count FROM kpi_values_orsega`;
    console.log(`   Total: ${values_orsega_count[0].count}`);
    const values_orsega_sample = await sql`SELECT kpi_id, month, year, value FROM kpi_values_orsega ORDER BY year DESC, kpi_id LIMIT 5`;
    values_orsega_sample.forEach(v => console.log(`   KPI ${v.kpi_id}: ${v.month} ${v.year} = ${v.value}`));

    console.log('\n   Valores en kpi_values (Orsega, sin user_id):');
    const values_new_orsega = await sql`SELECT kv.kpi_id, kv.period, kv.value FROM kpi_values kv JOIN kpis k ON k.id = kv.kpi_id WHERE k.company_id = 2 AND kv.user_id IS NULL ORDER BY kv.date DESC LIMIT 5`;
    values_new_orsega.forEach(v => console.log(`   KPI ${v.kpi_id}: ${v.period} = ${v.value}`));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

compareTables();


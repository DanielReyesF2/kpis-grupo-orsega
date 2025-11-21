#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';

async function checkCurrentKPIs() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL no encontrada');
    process.exit(1);
  }

  console.log('📊 Verificando KPIs actuales en la base de datos...\n');
  const sql = neon(dbUrl);

  try {
    // Ver KPIs por empresa
    const kpis = await sql`
      SELECT 
        k.id,
        k.name,
        k.company_id,
        a.name as area_name,
        k.target,
        k.unit
      FROM kpis k
      LEFT JOIN areas a ON a.id = k.area_id
      ORDER BY k.company_id, k.name
    `;
    
    console.log(`Total de KPIs: ${kpis.length}`);
    console.log('\nKPIs por empresa:');
    
    kpis.forEach(k => {
      console.log(`   [${k.company_id === 1 ? 'Dura' : 'Orsega'}] ID ${k.id}: ${k.name} (${k.area_name})`);
    });

    // Ver conteos de valores
    const values = await sql`
      SELECT 
        k.company_id,
        COUNT(kv.id) as value_count
      FROM kpis k
      LEFT JOIN kpi_values kv ON kv.kpi_id = k.id AND kv.user_id IS NULL
      GROUP BY k.company_id
      ORDER BY k.company_id
    `;
    
    console.log('\nValores históricos:');
    values.forEach(v => {
      console.log(`   [${v.company_id === 1 ? 'Dura' : 'Orsega'}]: ${v.value_count} valores`);
    });

    // Buscar KPI específico de Volumen de Ventas
    console.log('\n🔍 KPIs de Volumen de Ventas:');
    const salesKPIs = await sql`
      SELECT 
        k.id,
        k.name,
        k.company_id,
        k.target,
        k.unit
      FROM kpis k
      WHERE LOWER(k.name) LIKE '%volumen%' OR LOWER(k.name) LIKE '%ventas%'
      ORDER BY k.company_id
    `;
    
    if (salesKPIs.length === 0) {
      console.log('   ❌ No se encontraron KPIs de Volumen de Ventas');
    } else {
      salesKPIs.forEach(k => {
        console.log(`   [${k.company_id === 1 ? 'Dura' : 'Orsega'}] ID ${k.id}: ${k.name}`);
        console.log(`      Target: ${k.target} ${k.unit}`);
      });
    }

    // Ver algunos valores de muestra
    console.log('\n📊 Muestra de valores:');
    const sample = await sql`
      SELECT 
        k.id,
        k.name,
        k.company_id,
        kv.period,
        kv.value
      FROM kpi_values kv
      JOIN kpis k ON k.id = kv.kpi_id
      WHERE kv.user_id IS NULL
      ORDER BY kv.date DESC
      LIMIT 10
    `;
    
    sample.forEach(s => {
      console.log(`   [${s.company_id === 1 ? 'Dura' : 'Orsega'}] ${s.name}: ${s.period} = ${s.value}`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

checkCurrentKPIs();


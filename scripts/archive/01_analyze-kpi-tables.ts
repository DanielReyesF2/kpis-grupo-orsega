#!/usr/bin/env tsx
// Script para analizar el estado actual de las tablas de KPIs
import { neon } from '@neondatabase/serverless';

async function analyzeTables() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL no encontrada');
    process.exit(1);
  }

  console.log('📊 Analizando estado actual de las tablas de KPIs...\n');
  const sql = neon(dbUrl);

  try {
    // Contar registros en cada tabla
    console.log('1️⃣ Contando registros:');
    const [kpis_dura_count] = await sql`SELECT COUNT(*)::int as count FROM kpis_dura`;
    const [kpis_orsega_count] = await sql`SELECT COUNT(*)::int as count FROM kpis_orsega`;
    const [kpi_values_dura_count] = await sql`SELECT COUNT(*)::int as count FROM kpi_values_dura`;
    const [kpi_values_orsega_count] = await sql`SELECT COUNT(*)::int as count FROM kpi_values_orsega`;
    const [kpis_count] = await sql`SELECT COUNT(*)::int as count FROM kpis`;
    const [kpi_values_count] = await sql`SELECT COUNT(*)::int as count FROM kpi_values`;

    console.log(`   kpis_dura: ${kpis_dura_count.count} registros`);
    console.log(`   kpis_orsega: ${kpis_orsega_count.count} registros`);
    console.log(`   kpi_values_dura: ${kpi_values_dura_count.count} registros`);
    console.log(`   kpi_values_orsega: ${kpi_values_orsega_count.count} registros`);
    console.log(`   kpis (nueva): ${kpis_count.count} registros`);
    console.log(`   kpi_values (nueva): ${kpi_values_count.count} registros`);

    // Listar áreas únicas en tablas viejas vs nuevas
    console.log('\n2️⃣ Áreas en tablas viejas:');
    const dura_areas = await sql`SELECT DISTINCT area FROM kpis_dura ORDER BY area`;
    const orsega_areas = await sql`SELECT DISTINCT area FROM kpis_orsega ORDER BY area`;
    
    console.log('   Dura:', dura_areas.map(a => a.area).join(', '));
    console.log('   Orsega:', orsega_areas.map(a => a.area).join(', '));

    console.log('\n   Áreas en tabla areas:');
    const areas_new = await sql`SELECT id, name, company_id FROM areas ORDER BY company_id, name`;
    areas_new.forEach(a => console.log(`   ${a.company_id === 1 ? 'Dura' : 'Orsega'}: ${a.name} (id: ${a.id})`));

    // Verificar si hay áreas que no existen en la tabla nueva
    console.log('\n3️⃣ Verificando mapeo de áreas:');
    const areas_to_map = await sql`
      SELECT DISTINCT 'Dura' as company, kd.area, a.id IS NOT NULL as exists_in_areas
      FROM kpis_dura kd
      LEFT JOIN areas a ON LOWER(a.name) = LOWER(kd.area) AND a.company_id = 1
      UNION
      SELECT DISTINCT 'Orsega' as company, ko.area, a.id IS NOT NULL as exists_in_areas
      FROM kpis_orsega ko
      LEFT JOIN areas a ON LOWER(a.name) = LOWER(ko.area) AND a.company_id = 2
      ORDER BY company, area
    `;
    
    areas_to_map.forEach(a => {
      const status = a.exists_in_areas ? '✅' : '❌ FALTA';
      console.log(`   ${status} ${a.company}: ${a.area}`);
    });

    // Verificar IDs duplicados
    console.log('\n4️⃣ Verificando IDs duplicados:');
    const duplicate_ids = await sql`
      SELECT kd.id, kd.kpi_name, 'kpis_dura' as table_name
      FROM kpis_dura kd
      WHERE kd.id IN (SELECT id FROM kpis_orsega)
    `;
    
    if (duplicate_ids.length > 0) {
      console.log('   ⚠️ IDS DUPLICADOS ENCONTRADOS:');
      duplicate_ids.forEach(d => console.log(`   ID ${d.id}: ${d.kpi_name} (existe en ${d.table_name} y kpis_orsega)`));
    } else {
      console.log('   ✅ No hay IDs duplicados entre kpis_dura y kpis_orsega');
    }

    // Verificar fechas de valores históricos
    console.log('\n5️⃣ Rango de fechas en valores históricos:');
    const [dura_date_range] = await sql`SELECT MIN(year)::int as min_year, MAX(year)::int as max_year FROM kpi_values_dura`;
    const [orsega_date_range] = await sql`SELECT MIN(year)::int as min_year, MAX(year)::int as max_year FROM kpi_values_orsega`;
    
    console.log(`   Dura: ${dura_date_range.min_year} - ${dura_date_range.max_year}`);
    console.log(`   Orsega: ${orsega_date_range.min_year} - ${orsega_date_range.max_year}`);

    // Verificar si hay KPIs duplicados por nombre
    console.log('\n6️⃣ Verificando KPIs duplicados por nombre dentro de la misma empresa:');
    const dura_duplicates = await sql`
      SELECT kpi_name, COUNT(*)::int as count
      FROM kpis_dura
      GROUP BY kpi_name
      HAVING COUNT(*) > 1
    `;
    const orsega_duplicates = await sql`
      SELECT kpi_name, COUNT(*)::int as count
      FROM kpis_orsega
      GROUP BY kpi_name
      HAVING COUNT(*) > 1
    `;
    
    if (dura_duplicates.length > 0 || orsega_duplicates.length > 0) {
      console.log('   ⚠️ DUPLICADOS POR NOMBRE ENCONTRADOS:');
      dura_duplicates.forEach(d => console.log(`   Dura: "${d.kpi_name}" aparece ${d.count} veces`));
      orsega_duplicates.forEach(d => console.log(`   Orsega: "${d.kpi_name}" aparece ${d.count} veces`));
    } else {
      console.log('   ✅ No hay duplicados por nombre dentro de cada empresa');
    }

    console.log('\n✅ Análisis completado');
  } catch (error) {
    console.error('❌ Error durante el análisis:', error);
    process.exit(1);
  }
}

analyzeTables();


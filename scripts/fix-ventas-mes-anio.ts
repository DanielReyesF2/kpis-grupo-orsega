/**
 * One-time migration script to fix ventas records with NULL mes/anio
 * Run with: npx tsx scripts/fix-ventas-mes-anio.ts
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function fixVentasMesAnio() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log('🔍 Checking for ventas records with NULL mes or anio...');

  // First, check how many records need fixing
  const countBefore = await sql`
    SELECT COUNT(*) as count
    FROM ventas
    WHERE fecha IS NOT NULL
      AND (mes IS NULL OR anio IS NULL)
  `;

  console.log(`📊 Found ${countBefore[0].count} records with NULL mes or anio`);

  if (parseInt(countBefore[0].count) === 0) {
    console.log('✅ No records need fixing!');
    return;
  }

  // Show sample of records before fix
  const sampleBefore = await sql`
    SELECT id, fecha, mes, anio, cliente
    FROM ventas
    WHERE fecha IS NOT NULL
      AND (mes IS NULL OR anio IS NULL)
    LIMIT 5
  `;

  console.log('\n📋 Sample records before fix:');
  sampleBefore.forEach((r: any) => {
    console.log(`   ID: ${r.id}, Fecha: ${r.fecha}, Mes: ${r.mes}, Año: ${r.anio}, Cliente: ${r.cliente?.substring(0, 30)}`);
  });

  // Fix the records
  console.log('\n🔧 Updating records...');

  const updateResult = await sql`
    UPDATE ventas
    SET
      mes = EXTRACT(MONTH FROM fecha)::integer,
      anio = EXTRACT(YEAR FROM fecha)::integer
    WHERE fecha IS NOT NULL
      AND (mes IS NULL OR anio IS NULL)
    RETURNING id
  `;

  console.log(`✅ Updated ${updateResult.length} records`);

  // Verify fix
  const countAfter = await sql`
    SELECT COUNT(*) as count
    FROM ventas
    WHERE fecha IS NOT NULL
      AND (mes IS NULL OR anio IS NULL)
  `;

  console.log(`\n📊 Records with NULL mes or anio after fix: ${countAfter[0].count}`);

  // Show distribution of months in the data
  const monthDist = await sql`
    SELECT
      anio as year,
      mes as month,
      COUNT(*) as count
    FROM ventas
    WHERE anio >= 2024
    GROUP BY anio, mes
    ORDER BY anio DESC, mes DESC
    LIMIT 12
  `;

  console.log('\n📅 Recent data distribution by month:');
  monthDist.forEach((r: any) => {
    console.log(`   ${r.year}-${String(r.month).padStart(2, '0')}: ${r.count} records`);
  });

  console.log('\n✅ Migration complete!');
}

fixVentasMesAnio().catch(console.error);

/**
 * Script to check ventas data distribution
 * Run with: npx tsx scripts/check-ventas-data.ts
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

async function checkVentasData() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log('📊 Checking ventas data distribution...\n');

  // Check data by month and year
  const monthDist = await sql`
    SELECT
      company_id,
      anio as year,
      mes as month,
      COUNT(*) as count,
      MIN(fecha) as min_fecha,
      MAX(fecha) as max_fecha
    FROM ventas
    WHERE anio >= 2025
    GROUP BY company_id, anio, mes
    ORDER BY company_id, anio DESC, mes DESC
  `;

  console.log('📅 Data distribution by company/year/month:');
  console.log('Company | Year | Month | Count | Min Fecha | Max Fecha');
  console.log('--------|------|-------|-------|-----------|----------');
  monthDist.forEach((r: any) => {
    const minF = r.min_fecha ? new Date(r.min_fecha).toISOString().split('T')[0] : 'N/A';
    const maxF = r.max_fecha ? new Date(r.max_fecha).toISOString().split('T')[0] : 'N/A';
    console.log(`   ${r.company_id}    | ${r.year} |   ${String(r.month).padStart(2, '0')}  |  ${String(r.count).padStart(4, ' ')} | ${minF} | ${maxF}`);
  });

  // Check for February 2026 specifically
  console.log('\n\n📋 February 2026 sample records (if any):');
  const feb2026 = await sql`
    SELECT id, company_id, fecha, mes, anio, cliente, producto, cantidad, importe
    FROM ventas
    WHERE anio = 2026 AND mes = 2
    LIMIT 10
  `;

  if (feb2026.length === 0) {
    console.log('   ❌ No February 2026 records found!');
  } else {
    feb2026.forEach((r: any) => {
      const fecha = r.fecha ? new Date(r.fecha).toISOString().split('T')[0] : 'N/A';
      console.log(`   ID: ${r.id}, Fecha: ${fecha}, Mes: ${r.mes}, Año: ${r.anio}, Cliente: ${r.cliente?.substring(0, 25)}`);
    });
  }

  // Check most recent records
  console.log('\n\n📋 Most recent 10 records in ventas:');
  const recent = await sql`
    SELECT id, company_id, fecha, mes, anio, cliente, producto, cantidad
    FROM ventas
    ORDER BY fecha DESC, id DESC
    LIMIT 10
  `;

  recent.forEach((r: any) => {
    const fecha = r.fecha ? new Date(r.fecha).toISOString().split('T')[0] : 'N/A';
    console.log(`   ID: ${r.id}, Co: ${r.company_id}, Fecha: ${fecha}, Mes: ${r.mes}, Año: ${r.anio}, Cliente: ${r.cliente?.substring(0, 25)}`);
  });

  // Check total counts
  const totals = await sql`
    SELECT company_id, COUNT(*) as total
    FROM ventas
    GROUP BY company_id
    ORDER BY company_id
  `;

  console.log('\n\n📊 Total records by company:');
  totals.forEach((r: any) => {
    console.log(`   Company ${r.company_id}: ${r.total} records`);
  });
}

checkVentasData().catch(console.error);

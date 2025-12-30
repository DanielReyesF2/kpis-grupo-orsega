/**
 * ============================================================================
 * AUDITORÍA PROFUNDA DE DATOS DE VENTAS
 * ============================================================================
 *
 * Este script realiza una auditoría exhaustiva de los datos de ventas en la
 * base de datos Neon para verificar que están listos para reemplazar los
 * datos hardcodeados.
 *
 * Ejecutar con: npx tsx scripts/audit-sales-data.ts
 * ============================================================================
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";

// Configure WebSocket for Neon (like the app does)
neonConfig.webSocketConstructor = WebSocket;

// Use environment variable directly
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Helper function to execute queries
async function query(text: string, params: any[] = []): Promise<any[]> {
  const result = await pool.query(text, params);
  return result.rows;
}

// ============================================================================
// DATOS HARDCODEADOS PARA COMPARACIÓN (extraídos de routes.ts)
// ============================================================================

const HARDCODED_DURA_DATA = [
  { mes: "Enero", year: 2024, value: 46407.17 },
  { mes: "Febrero", year: 2024, value: 54955.17 },
  { mes: "Marzo", year: 2024, value: 58170.41 },
  { mes: "Abril", year: 2024, value: 51814.50 },
  { mes: "Mayo", year: 2024, value: 56757.88 },
  { mes: "Junio", year: 2024, value: 45015.50 },
  { mes: "Julio", year: 2024, value: 67090.00 },
  { mes: "Agosto", year: 2024, value: 36533.20 },
  { mes: "Septiembre", year: 2024, value: 57676.50 },
  { mes: "Octubre", year: 2024, value: 70538.00 },
  { mes: "Noviembre", year: 2024, value: 40676.04 },
  { mes: "Diciembre", year: 2024, value: 54120.30 },
  { mes: "Enero", year: 2025, value: 59453.54 },
  { mes: "Febrero", year: 2025, value: 46450.80 },
  { mes: "Marzo", year: 2025, value: 43602.24 },
  { mes: "Abril", year: 2025, value: 55972.80 },
  { mes: "Mayo", year: 2025, value: 36358.64 },
  { mes: "Junio", year: 2025, value: 51156.50 },
  { mes: "Julio", year: 2025, value: 52999.54 },
  { mes: "Agosto", year: 2025, value: 44381.30 },
  { mes: "Septiembre", year: 2025, value: 56763.54 },
  { mes: "Octubre", year: 2025, value: 42939.20 },
  { mes: "Noviembre", year: 2025, value: 44222.00 },
  { mes: "Diciembre", year: 2025, value: 34645.00 },
];

const HARDCODED_ORSEGA_DATA = [
  { mes: "Enero", year: 2024, value: 871883.98 },
  { mes: "Febrero", year: 2024, value: 471429.00 },
  { mes: "Marzo", year: 2024, value: 983893.00 },
  { mes: "Abril", year: 2024, value: 659319.00 },
  { mes: "Mayo", year: 2024, value: 983283.00 },
  { mes: "Junio", year: 2024, value: 702502.00 },
  { mes: "Julio", year: 2024, value: 674186.00 },
  { mes: "Agosto", year: 2024, value: 528870.00 },
  { mes: "Septiembre", year: 2024, value: 871278.00 },
  { mes: "Octubre", year: 2024, value: 727375.00 },
  { mes: "Noviembre", year: 2024, value: 1312541.00 },
  { mes: "Diciembre", year: 2024, value: 750918.00 },
  { mes: "Enero", year: 2025, value: 1056748.00 },
  { mes: "Febrero", year: 2025, value: 986581.00 },
  { mes: "Marzo", year: 2025, value: 1319150.00 },
  { mes: "Abril", year: 2025, value: 555894.00 },
  { mes: "Mayo", year: 2025, value: 1062785.00 },
  { mes: "Junio", year: 2025, value: 1084950.00 },
  { mes: "Julio", year: 2025, value: 1169659.00 },
  { mes: "Agosto", year: 2025, value: 558525.00 },
  { mes: "Septiembre", year: 2025, value: 404786.00 },
  { mes: "Octubre", year: 2025, value: 583234.00 },
  { mes: "Noviembre", year: 2025, value: 425631.00 },
  { mes: "Diciembre", year: 2025, value: 480458.00 },
];

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// ============================================================================
// UTILIDADES
// ============================================================================

function formatNumber(num: number): string {
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

function printSeparator(char = "=", length = 80): void {
  console.log(char.repeat(length));
}

function printHeader(title: string): void {
  console.log("\n");
  printSeparator();
  console.log(`  ${title}`);
  printSeparator();
}

function printSubHeader(title: string): void {
  console.log(`\n--- ${title} ---`);
}

// ============================================================================
// AUDITORÍAS
// ============================================================================

async function auditTableExistence(): Promise<{ exists: string[], missing: string[] }> {
  printHeader("1. VERIFICACIÓN DE ESTRUCTURA DE TABLAS");

  const requiredTables = [
    'companies', 'users', 'clients', 'products',
    'sales_data', 'sales_uploads', 'sales_alerts',
    'sales_acciones', 'sales_responsables',
  ];

  const results = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  const existingTables = results.map((r: any) => r.table_name);
  const exists: string[] = [];
  const missing: string[] = [];

  console.log("\nTablas requeridas para ventas:");
  for (const table of requiredTables) {
    if (existingTables.includes(table)) {
      exists.push(table);
      console.log(`  ✅ ${table}`);
    } else {
      missing.push(table);
      console.log(`  ❌ ${table} - NO EXISTE`);
    }
  }

  console.log(`\n📊 Resultado: ${exists.length}/${requiredTables.length} tablas encontradas`);
  return { exists, missing };
}

async function auditCompanies(): Promise<any[]> {
  printHeader("2. VERIFICACIÓN DE EMPRESAS");

  const companies = await query(`SELECT id, name, description, sector FROM companies ORDER BY id`);

  console.log("\nEmpresas registradas:");
  for (const company of companies) {
    console.log(`  [${company.id}] ${company.name} - ${company.sector || 'Sin sector'}`);
  }

  const hasDura = companies.some((c: any) => c.id === 1);
  const hasOrsega = companies.some((c: any) => c.id === 2);

  console.log(`\n📊 Empresas requeridas:`);
  console.log(`  ${hasDura ? '✅' : '❌'} DURA (companyId=1)`);
  console.log(`  ${hasOrsega ? '✅' : '❌'} ORSEGA (companyId=2)`);

  return companies;
}

async function auditSalesDataOverview(): Promise<any> {
  printHeader("3. RESUMEN GENERAL DE DATOS DE VENTAS");

  const totalCount = await query(`SELECT COUNT(*) as count FROM sales_data`);
  console.log(`\n📈 Total de registros en sales_data: ${totalCount[0].count}`);

  const byCompany = await query(`
    SELECT company_id, COUNT(*) as count,
      MIN(sale_date) as first_sale, MAX(sale_date) as last_sale,
      COUNT(DISTINCT client_name) as unique_clients,
      COUNT(DISTINCT product_name) as unique_products
    FROM sales_data GROUP BY company_id ORDER BY company_id
  `);

  console.log("\n📊 Por empresa:");
  for (const row of byCompany) {
    const name = row.company_id === 1 ? 'DURA' : row.company_id === 2 ? 'ORSEGA' : `Empresa ${row.company_id}`;
    console.log(`\n  [${row.company_id}] ${name}:`);
    console.log(`      Registros: ${row.count}`);
    console.log(`      Primera venta: ${row.first_sale || 'N/A'}`);
    console.log(`      Última venta: ${row.last_sale || 'N/A'}`);
    console.log(`      Clientes únicos: ${row.unique_clients}`);
    console.log(`      Productos únicos: ${row.unique_products}`);
  }

  const bySubmodulo = await query(`
    SELECT submodulo, company_id, COUNT(*) as count
    FROM sales_data GROUP BY submodulo, company_id ORDER BY company_id, submodulo
  `);

  if (bySubmodulo.length > 0) {
    console.log("\n📊 Por submódulo (DI/GO):");
    for (const row of bySubmodulo) {
      console.log(`  ${row.submodulo || 'NULL'} (Company ${row.company_id}): ${row.count} registros`);
    }
  }

  return { totalCount: totalCount[0].count, byCompany, bySubmodulo };
}

async function auditMonthlyData(companyId: number, companyName: string): Promise<any[]> {
  printSubHeader(`Datos mensuales - ${companyName} (companyId=${companyId})`);

  const monthlyData = await query(`
    SELECT sale_year, sale_month, SUM(quantity) as total_quantity,
      COUNT(*) as record_count, COUNT(DISTINCT client_name) as unique_clients, MAX(unit) as unit
    FROM sales_data
    WHERE company_id = $1 AND sale_year IN (2024, 2025)
    GROUP BY sale_year, sale_month ORDER BY sale_year, sale_month
  `, [companyId]);

  console.log(`\n  Datos encontrados: ${monthlyData.length} meses`);

  if (monthlyData.length === 0) {
    console.log("  ⚠️  NO HAY DATOS DE VENTAS PARA 2024-2025");
    return [];
  }

  console.log("\n  Año  | Mes         | Cantidad Total    | Registros | Clientes | Unidad");
  console.log("  " + "-".repeat(75));

  for (const row of monthlyData) {
    const monthName = MONTH_NAMES[row.sale_month - 1] || `Mes ${row.sale_month}`;
    console.log(`  ${row.sale_year} | ${monthName.padEnd(11)} | ${formatNumber(parseFloat(row.total_quantity)).padStart(17)} | ${String(row.record_count).padStart(9)} | ${String(row.unique_clients).padStart(8)} | ${row.unit || 'N/A'}`);
  }

  return monthlyData;
}

async function compareWithHardcoded(
  companyId: number,
  companyName: string,
  hardcodedData: typeof HARDCODED_DURA_DATA,
  realData: any[]
): Promise<{ matches: number, mismatches: number, missing: number, details: any[] }> {
  printSubHeader(`Comparación con datos hardcodeados - ${companyName}`);

  const details: any[] = [];
  let matches = 0, mismatches = 0, missing = 0;

  console.log("\n  Mes           | Año  | Hardcoded       | Base de Datos   | Diferencia      | Estado");
  console.log("  " + "-".repeat(95));

  for (const hd of hardcodedData) {
    const monthIndex = MONTH_NAMES.indexOf(hd.mes) + 1;
    const realMonth = realData.find((r: any) => r.sale_year === hd.year && r.sale_month === monthIndex);
    const realValue = realMonth ? parseFloat(realMonth.total_quantity) : null;
    const diff = realValue !== null ? realValue - hd.value : null;
    const percentDiff = realValue !== null && hd.value !== 0 ? ((realValue - hd.value) / hd.value * 100) : null;

    let status: string;
    if (realValue === null) {
      status = "❌ FALTANTE";
      missing++;
    } else if (Math.abs(diff!) < 1) {
      status = "✅ EXACTO";
      matches++;
    } else if (percentDiff !== null && Math.abs(percentDiff) < 1) {
      status = "🟡 ~IGUAL";
      matches++;
    } else {
      status = "⚠️  DIFERENTE";
      mismatches++;
    }

    const realStr = realValue !== null ? formatNumber(realValue) : "N/A";
    const diffStr = diff !== null ? (diff >= 0 ? "+" : "") + formatNumber(diff) : "N/A";

    console.log(`  ${hd.mes.padEnd(13)} | ${hd.year} | ${formatNumber(hd.value).padStart(15)} | ${realStr.padStart(15)} | ${diffStr.padStart(15)} | ${status}`);
    details.push({ month: hd.mes, year: hd.year, hardcoded: hd.value, real: realValue, diff, percentDiff, status });
  }

  console.log("\n  📊 Resumen de comparación:");
  console.log(`     ✅ Coinciden: ${matches}`);
  console.log(`     ⚠️  Diferentes: ${mismatches}`);
  console.log(`     ❌ Faltantes: ${missing}`);

  return { matches, mismatches, missing, details };
}

async function auditSalesUploads(): Promise<any[]> {
  printHeader("4. HISTORIAL DE CARGAS DE ARCHIVOS (sales_uploads)");

  const uploads = await query(`
    SELECT id, company_id, file_name, upload_date, period_start, period_end, records_count, status, notes
    FROM sales_uploads ORDER BY upload_date DESC LIMIT 20
  `);

  console.log(`\nÚltimas ${uploads.length} cargas:`);

  if (uploads.length === 0) {
    console.log("  ⚠️  No hay registros de cargas de archivos");
  } else {
    for (const u of uploads) {
      const name = u.company_id === 1 ? 'DURA' : u.company_id === 2 ? 'ORSEGA' : `Co.${u.company_id}`;
      console.log(`\n  [${u.id}] ${name} - ${u.file_name}`);
      console.log(`      Fecha: ${u.upload_date}`);
      console.log(`      Período: ${u.period_start} → ${u.period_end}`);
      console.log(`      Registros: ${u.records_count} | Estado: ${u.status}`);
    }
  }

  return uploads;
}

async function auditDataQuality(): Promise<any> {
  printHeader("5. CALIDAD DE DATOS EN sales_data");

  const nullChecks = await query(`
    SELECT COUNT(*) as total,
      COUNT(*) FILTER (WHERE client_name IS NULL OR client_name = '') as null_client_name,
      COUNT(*) FILTER (WHERE product_name IS NULL OR product_name = '') as null_product_name,
      COUNT(*) FILTER (WHERE quantity IS NULL) as null_quantity,
      COUNT(*) FILTER (WHERE quantity = 0) as zero_quantity,
      COUNT(*) FILTER (WHERE quantity < 0) as negative_quantity,
      COUNT(*) FILTER (WHERE sale_date IS NULL) as null_sale_date,
      COUNT(*) FILTER (WHERE sale_month IS NULL OR sale_month NOT BETWEEN 1 AND 12) as invalid_month,
      COUNT(*) FILTER (WHERE sale_year IS NULL OR sale_year < 2020) as invalid_year,
      COUNT(*) FILTER (WHERE unit IS NULL OR unit = '') as null_unit
    FROM sales_data
  `);

  const q = nullChecks[0];
  console.log("\n📊 Análisis de calidad:");
  console.log(`  Total de registros: ${q.total}`);
  console.log(`\n  Problemas potenciales:`);
  console.log(`    ${q.null_client_name > 0 ? '❌' : '✅'} client_name NULL/vacío: ${q.null_client_name}`);
  console.log(`    ${q.null_product_name > 0 ? '❌' : '✅'} product_name NULL/vacío: ${q.null_product_name}`);
  console.log(`    ${q.null_quantity > 0 ? '❌' : '✅'} quantity NULL: ${q.null_quantity}`);
  console.log(`    ${q.zero_quantity > 0 ? '🟡' : '✅'} quantity = 0: ${q.zero_quantity}`);
  console.log(`    ${q.negative_quantity > 0 ? '⚠️' : '✅'} quantity < 0: ${q.negative_quantity}`);
  console.log(`    ${q.null_sale_date > 0 ? '❌' : '✅'} sale_date NULL: ${q.null_sale_date}`);
  console.log(`    ${q.invalid_month > 0 ? '❌' : '✅'} sale_month inválido: ${q.invalid_month}`);
  console.log(`    ${q.invalid_year > 0 ? '❌' : '✅'} sale_year inválido: ${q.invalid_year}`);
  console.log(`    ${q.null_unit > 0 ? '🟡' : '✅'} unit NULL/vacío: ${q.null_unit}`);

  const duplicates = await query(`
    SELECT company_id, client_name, product_name, sale_date, quantity, COUNT(*) as count
    FROM sales_data
    GROUP BY company_id, client_name, product_name, sale_date, quantity
    HAVING COUNT(*) > 1 LIMIT 10
  `);

  console.log(`\n  📋 Posibles duplicados: ${duplicates.length > 0 ? duplicates.length + ' encontrados' : 'Ninguno'}`);

  return nullChecks[0];
}

async function auditReferentialIntegrity(): Promise<any> {
  printHeader("6. INTEGRIDAD REFERENCIAL");

  const orphanClients = await query(`
    SELECT COUNT(*) as count FROM sales_data sd
    WHERE sd.client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = sd.client_id)
  `);

  const orphanProducts = await query(`
    SELECT COUNT(*) as count FROM sales_data sd
    WHERE sd.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = sd.product_id)
  `);

  const orphanUploads = await query(`
    SELECT COUNT(*) as count FROM sales_data sd
    WHERE sd.upload_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sales_uploads su WHERE su.id = sd.upload_id)
  `);

  console.log("\n📊 Referencias huérfanas:");
  console.log(`  ${orphanClients[0].count > 0 ? '⚠️' : '✅'} client_id sin cliente: ${orphanClients[0].count}`);
  console.log(`  ${orphanProducts[0].count > 0 ? '⚠️' : '✅'} product_id sin producto: ${orphanProducts[0].count}`);
  console.log(`  ${orphanUploads[0].count > 0 ? '⚠️' : '✅'} upload_id sin upload: ${orphanUploads[0].count}`);

  return {
    orphanClients: orphanClients[0].count,
    orphanProducts: orphanProducts[0].count,
    orphanUploads: orphanUploads[0].count
  };
}

async function auditClients(): Promise<any> {
  printHeader("7. CATÁLOGO DE CLIENTES");

  const stats = await query(`
    SELECT company_id, COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_active = true) as active,
      COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '') as with_email
    FROM clients GROUP BY company_id ORDER BY company_id
  `);

  console.log("\n📊 Clientes por empresa:");
  for (const s of stats) {
    const name = s.company_id === 1 ? 'DURA' : s.company_id === 2 ? 'ORSEGA' : `Empresa ${s.company_id}`;
    console.log(`\n  [${s.company_id}] ${name}: Total: ${s.total}, Activos: ${s.active}, Con email: ${s.with_email}`);
  }

  const unmatched = await query(`
    SELECT DISTINCT sd.client_name, sd.company_id
    FROM sales_data sd WHERE sd.client_id IS NULL LIMIT 20
  `);

  if (unmatched.length > 0) {
    console.log(`\n  ⚠️  Clientes en ventas sin vincular: ${unmatched.length}`);
  }

  return { stats, unmatchedClients: unmatched.length };
}

async function auditProducts(): Promise<any> {
  printHeader("8. CATÁLOGO DE PRODUCTOS");

  const stats = await query(`
    SELECT company_id, COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active
    FROM products GROUP BY company_id ORDER BY company_id
  `);

  console.log("\n📊 Productos por empresa:");
  for (const s of stats) {
    const name = s.company_id === 1 ? 'DURA' : s.company_id === 2 ? 'ORSEGA' : `Empresa ${s.company_id}`;
    console.log(`  [${s.company_id}] ${name}: ${s.total} total (${s.active} activos)`);
  }

  return { stats };
}

async function auditTopClients(): Promise<void> {
  printHeader("9. TOP CLIENTES POR VOLUMEN (2024-2025)");

  for (const companyId of [1, 2]) {
    const companyName = companyId === 1 ? 'DURA' : 'ORSEGA';
    printSubHeader(`Top 10 Clientes - ${companyName}`);

    const topClients = await query(`
      SELECT client_name,
        SUM(CASE WHEN sale_year = 2024 THEN quantity ELSE 0 END) as vol_2024,
        SUM(CASE WHEN sale_year = 2025 THEN quantity ELSE 0 END) as vol_2025,
        SUM(quantity) as total
      FROM sales_data WHERE company_id = $1 AND sale_year IN (2024, 2025)
      GROUP BY client_name ORDER BY total DESC LIMIT 10
    `, [companyId]);

    if (topClients.length === 0) {
      console.log("  ⚠️  No hay datos de clientes");
      continue;
    }

    console.log(`\n  Cliente                              | 2024            | 2025            | Total`);
    console.log("  " + "-".repeat(90));

    for (const c of topClients) {
      const name = (c.client_name || 'Sin nombre').substring(0, 36).padEnd(36);
      console.log(`  ${name} | ${formatNumber(parseFloat(c.vol_2024)).padStart(15)} | ${formatNumber(parseFloat(c.vol_2025)).padStart(15)} | ${formatNumber(parseFloat(c.total)).padStart(15)}`);
    }
  }
}

async function generateFinalReport(results: any): Promise<void> {
  printHeader("10. REPORTE FINAL Y RECOMENDACIONES");

  const { tableAudit, duraComparison, orsegaComparison, dataQuality, refIntegrity } = results;

  let score = 0, maxScore = 100;

  // Tablas (20 pts)
  score += (tableAudit.exists.length / (tableAudit.exists.length + tableAudit.missing.length)) * 20;

  // Datos (60 pts)
  if (duraComparison) {
    const duraScore = (duraComparison.matches / 24) * 30;
    score += duraScore;
  }
  if (orsegaComparison) {
    const orsegaScore = (orsegaComparison.matches / 24) * 30;
    score += orsegaScore;
  }

  // Calidad (10 pts)
  if (dataQuality) {
    const issues = (dataQuality.null_client_name > 0 ? 1 : 0) + (dataQuality.null_quantity > 0 ? 1 : 0);
    score += Math.max(0, (2 - issues) / 2) * 10;
  }

  // Integridad (10 pts)
  if (refIntegrity) {
    const issues = (refIntegrity.orphanClients > 0 ? 1 : 0) + (refIntegrity.orphanProducts > 0 ? 1 : 0);
    score += Math.max(0, (2 - issues) / 2) * 10;
  }

  const percentage = score;

  console.log("\n╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║                         PUNTUACIÓN DE PREPARACIÓN                             ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════════╣");

  let statusEmoji: string, statusText: string;
  if (percentage >= 90) { statusEmoji = "🟢"; statusText = "LISTO PARA PRODUCCIÓN"; }
  else if (percentage >= 70) { statusEmoji = "🟡"; statusText = "CASI LISTO - Revisar detalles"; }
  else if (percentage >= 50) { statusEmoji = "🟠"; statusText = "NECESITA TRABAJO"; }
  else { statusEmoji = "🔴"; statusText = "NO LISTO - Faltan datos críticos"; }

  console.log(`║  ${statusEmoji} Score: ${percentage.toFixed(1)}% - ${statusText.padEnd(50)}║`);
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝");

  console.log("\n📋 RECOMENDACIONES:");

  const recs: string[] = [];
  if (tableAudit.missing.length > 0) recs.push(`❌ CRÍTICO: Faltan tablas: ${tableAudit.missing.join(', ')}`);
  if (duraComparison?.missing > 0) recs.push(`❌ CRÍTICO: DURA tiene ${duraComparison.missing} meses sin datos`);
  if (orsegaComparison?.missing > 0) recs.push(`❌ CRÍTICO: ORSEGA tiene ${orsegaComparison.missing} meses sin datos`);
  if (duraComparison?.mismatches > 0) recs.push(`⚠️  VERIFICAR: DURA tiene ${duraComparison.mismatches} meses con valores diferentes`);
  if (orsegaComparison?.mismatches > 0) recs.push(`⚠️  VERIFICAR: ORSEGA tiene ${orsegaComparison.mismatches} meses con valores diferentes`);

  if (recs.length === 0) recs.push("✅ Los datos parecen estar listos para reemplazar los hardcodeados");

  for (const r of recs) console.log(`  ${r}`);

  console.log("\n📌 PRÓXIMOS PASOS:");
  if (percentage >= 90) {
    console.log("  1. Cambiar HARDCODED_SALES_DATA_ENABLED = false en routes.ts");
    console.log("  2. Probar los endpoints sin datos hardcodeados");
    console.log("  3. Eliminar el componente SalesYearlyComparisonTable.tsx");
  } else if (percentage >= 50) {
    console.log("  1. Cargar los datos faltantes vía /api/sales/upload");
    console.log("  2. Ejecutar esta auditoría nuevamente");
  } else {
    console.log("  1. Verificar tablas y cargar datos históricos 2024-2025");
    console.log("  2. Ejecutar esta auditoría nuevamente");
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║           AUDITORÍA PROFUNDA DE DATOS DE VENTAS - NEON DATABASE              ║");
  console.log("║                    KPIs Grupo Orsega / Dura International                    ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝");
  console.log(`\n📅 Fecha de auditoría: ${new Date().toLocaleString('es-MX')}`);

  try {
    const results: any = {};

    results.tableAudit = await auditTableExistence();
    results.companies = await auditCompanies();
    results.overview = await auditSalesDataOverview();

    printHeader("COMPARACIÓN DETALLADA CON DATOS HARDCODEADOS");

    const duraData = await auditMonthlyData(1, "DURA");
    results.duraComparison = duraData.length > 0
      ? await compareWithHardcoded(1, "DURA", HARDCODED_DURA_DATA, duraData)
      : { matches: 0, mismatches: 0, missing: 24, details: [] };

    const orsegaData = await auditMonthlyData(2, "ORSEGA");
    results.orsegaComparison = orsegaData.length > 0
      ? await compareWithHardcoded(2, "ORSEGA", HARDCODED_ORSEGA_DATA, orsegaData)
      : { matches: 0, mismatches: 0, missing: 24, details: [] };

    results.uploads = await auditSalesUploads();
    results.dataQuality = await auditDataQuality();
    results.refIntegrity = await auditReferentialIntegrity();
    results.clients = await auditClients();
    results.products = await auditProducts();
    await auditTopClients();
    await generateFinalReport(results);

    console.log("\n✅ Auditoría completada exitosamente\n");
    await pool.end();

  } catch (error) {
    console.error("\n❌ Error durante la auditoría:", error);
    await pool.end();
    process.exit(1);
  }
}

main();

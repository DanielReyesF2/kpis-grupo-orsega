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

import { neon } from "@neondatabase/serverless";

// Use environment variable directly (don't override with dotenv)
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// ============================================================================
// DATOS HARDCODEADOS PARA COMPARACIÓN (extraídos de routes.ts)
// ============================================================================

const HARDCODED_DURA_DATA = [
  // 2024
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
  // 2025
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
  // 2024
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
  // 2025
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
    'companies',
    'users',
    'clients',
    'products',
    'sales_data',
    'sales_uploads',
    'sales_alerts',
    'sales_acciones',
    'sales_responsables',
  ];

  const results = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  const existingTables = results.map((r: any) => r.table_name);
  const exists: string[] = [];
  const missing: string[] = [];

  console.log("\nTablas requeridas para ventas:");
  for (const table of requiredTables) {
    const tableExists = existingTables.includes(table);
    if (tableExists) {
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

  const companies = await sql`
    SELECT id, name, description, sector
    FROM companies
    ORDER BY id
  `;

  console.log("\nEmpresas registradas:");
  for (const company of companies) {
    console.log(`  [${company.id}] ${company.name} - ${company.sector || 'Sin sector'}`);
  }

  // Verificar que existan DURA (1) y ORSEGA (2)
  const hasDura = companies.some((c: any) => c.id === 1);
  const hasOrsega = companies.some((c: any) => c.id === 2);

  console.log(`\n📊 Empresas requeridas:`);
  console.log(`  ${hasDura ? '✅' : '❌'} DURA (companyId=1)`);
  console.log(`  ${hasOrsega ? '✅' : '❌'} ORSEGA (companyId=2)`);

  return companies;
}

async function auditSalesDataOverview(): Promise<any> {
  printHeader("3. RESUMEN GENERAL DE DATOS DE VENTAS");

  // Conteo total
  const totalCount = await sql`SELECT COUNT(*) as count FROM sales_data`;
  console.log(`\n📈 Total de registros en sales_data: ${totalCount[0].count}`);

  // Conteo por empresa
  const byCompany = await sql`
    SELECT
      company_id,
      COUNT(*) as count,
      MIN(sale_date) as first_sale,
      MAX(sale_date) as last_sale,
      COUNT(DISTINCT client_name) as unique_clients,
      COUNT(DISTINCT product_name) as unique_products
    FROM sales_data
    GROUP BY company_id
    ORDER BY company_id
  `;

  console.log("\n📊 Por empresa:");
  for (const row of byCompany) {
    const companyName = row.company_id === 1 ? 'DURA' : row.company_id === 2 ? 'ORSEGA' : `Empresa ${row.company_id}`;
    console.log(`\n  [${row.company_id}] ${companyName}:`);
    console.log(`      Registros: ${row.count}`);
    console.log(`      Primera venta: ${row.first_sale || 'N/A'}`);
    console.log(`      Última venta: ${row.last_sale || 'N/A'}`);
    console.log(`      Clientes únicos: ${row.unique_clients}`);
    console.log(`      Productos únicos: ${row.unique_products}`);
  }

  // Conteo por submodulo
  const bySubmodulo = await sql`
    SELECT
      submodulo,
      company_id,
      COUNT(*) as count
    FROM sales_data
    GROUP BY submodulo, company_id
    ORDER BY company_id, submodulo
  `;

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

  const monthlyData = await sql`
    SELECT
      sale_year,
      sale_month,
      SUM(quantity) as total_quantity,
      COUNT(*) as record_count,
      COUNT(DISTINCT client_name) as unique_clients,
      MAX(unit) as unit
    FROM sales_data
    WHERE company_id = ${companyId}
      AND sale_year IN (2024, 2025)
    GROUP BY sale_year, sale_month
    ORDER BY sale_year, sale_month
  `;

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
  let matches = 0;
  let mismatches = 0;
  let missing = 0;

  console.log("\n  Mes           | Año  | Hardcoded       | Base de Datos   | Diferencia      | Estado");
  console.log("  " + "-".repeat(95));

  for (const hd of hardcodedData) {
    const realMonth = realData.find(
      (r: any) => r.sale_year === hd.year && r.sale_month === MONTH_NAMES.indexOf(hd.mes) + 1
    );

    const realValue = realMonth ? parseFloat(realMonth.total_quantity) : null;
    const diff = realValue !== null ? realValue - hd.value : null;
    const percentDiff = realValue !== null && hd.value !== 0
      ? ((realValue - hd.value) / hd.value * 100)
      : null;

    let status: string;
    if (realValue === null) {
      status = "❌ FALTANTE";
      missing++;
    } else if (Math.abs(diff!) < 1) {
      status = "✅ EXACTO";
      matches++;
    } else if (Math.abs(percentDiff!) < 1) {
      status = "🟡 ~IGUAL";
      matches++;
    } else {
      status = "⚠️  DIFERENTE";
      mismatches++;
    }

    const realStr = realValue !== null ? formatNumber(realValue) : "N/A";
    const diffStr = diff !== null ? (diff >= 0 ? "+" : "") + formatNumber(diff) : "N/A";

    console.log(`  ${hd.mes.padEnd(13)} | ${hd.year} | ${formatNumber(hd.value).padStart(15)} | ${realStr.padStart(15)} | ${diffStr.padStart(15)} | ${status}`);

    details.push({
      month: hd.mes,
      year: hd.year,
      hardcoded: hd.value,
      real: realValue,
      diff,
      percentDiff,
      status
    });
  }

  console.log("\n  📊 Resumen de comparación:");
  console.log(`     ✅ Coinciden: ${matches}`);
  console.log(`     ⚠️  Diferentes: ${mismatches}`);
  console.log(`     ❌ Faltantes: ${missing}`);

  return { matches, mismatches, missing, details };
}

async function auditSalesUploads(): Promise<any[]> {
  printHeader("4. HISTORIAL DE CARGAS DE ARCHIVOS (sales_uploads)");

  const uploads = await sql`
    SELECT
      id,
      company_id,
      file_name,
      upload_date,
      period_start,
      period_end,
      records_count,
      status,
      notes
    FROM sales_uploads
    ORDER BY upload_date DESC
    LIMIT 20
  `;

  console.log(`\nÚltimas ${uploads.length} cargas:`);

  if (uploads.length === 0) {
    console.log("  ⚠️  No hay registros de cargas de archivos");
  } else {
    for (const upload of uploads) {
      const companyName = upload.company_id === 1 ? 'DURA' : upload.company_id === 2 ? 'ORSEGA' : `Co.${upload.company_id}`;
      console.log(`\n  [${upload.id}] ${companyName} - ${upload.file_name}`);
      console.log(`      Fecha: ${upload.upload_date}`);
      console.log(`      Período: ${upload.period_start} → ${upload.period_end}`);
      console.log(`      Registros: ${upload.records_count} | Estado: ${upload.status}`);
      if (upload.notes) console.log(`      Notas: ${upload.notes}`);
    }
  }

  return uploads;
}

async function auditDataQuality(): Promise<any> {
  printHeader("5. CALIDAD DE DATOS EN sales_data");

  // Valores NULL o vacíos
  const nullChecks = await sql`
    SELECT
      COUNT(*) as total,
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
  `;

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

  // Duplicados potenciales
  const duplicates = await sql`
    SELECT
      company_id, client_name, product_name, sale_date, quantity,
      COUNT(*) as count
    FROM sales_data
    GROUP BY company_id, client_name, product_name, sale_date, quantity
    HAVING COUNT(*) > 1
    LIMIT 10
  `;

  console.log(`\n  📋 Posibles duplicados: ${duplicates.length > 0 ? duplicates.length + ' encontrados' : 'Ninguno'}`);
  if (duplicates.length > 0) {
    for (const dup of duplicates.slice(0, 5)) {
      console.log(`    - ${dup.client_name} | ${dup.product_name} | ${dup.sale_date} (×${dup.count})`);
    }
  }

  return nullChecks[0];
}

async function auditReferentialIntegrity(): Promise<any> {
  printHeader("6. INTEGRIDAD REFERENCIAL");

  // Verificar client_id huérfanos
  const orphanClients = await sql`
    SELECT COUNT(*) as count
    FROM sales_data sd
    WHERE sd.client_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = sd.client_id)
  `;

  // Verificar product_id huérfanos
  const orphanProducts = await sql`
    SELECT COUNT(*) as count
    FROM sales_data sd
    WHERE sd.product_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = sd.product_id)
  `;

  // Verificar upload_id huérfanos
  const orphanUploads = await sql`
    SELECT COUNT(*) as count
    FROM sales_data sd
    WHERE sd.upload_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM sales_uploads su WHERE su.id = sd.upload_id)
  `;

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

  const clientStats = await sql`
    SELECT
      company_id,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_active = true) as active,
      COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '') as with_email
    FROM clients
    GROUP BY company_id
    ORDER BY company_id
  `;

  console.log("\n📊 Clientes por empresa:");
  for (const stat of clientStats) {
    const companyName = stat.company_id === 1 ? 'DURA' : stat.company_id === 2 ? 'ORSEGA' : `Empresa ${stat.company_id}`;
    console.log(`\n  [${stat.company_id}] ${companyName}:`);
    console.log(`      Total: ${stat.total}`);
    console.log(`      Activos: ${stat.active}`);
    console.log(`      Con email: ${stat.with_email}`);
  }

  // Clientes en sales_data sin registro en clients
  const unmatchedClients = await sql`
    SELECT DISTINCT sd.client_name, sd.company_id
    FROM sales_data sd
    WHERE sd.client_id IS NULL
    LIMIT 20
  `;

  if (unmatchedClients.length > 0) {
    console.log(`\n  ⚠️  Clientes en ventas sin vincular (${unmatchedClients.length} mostrados):`);
    for (const client of unmatchedClients.slice(0, 10)) {
      const companyName = client.company_id === 1 ? 'DURA' : 'ORSEGA';
      console.log(`    - ${client.client_name} (${companyName})`);
    }
  }

  return { clientStats, unmatchedClients: unmatchedClients.length };
}

async function auditProducts(): Promise<any> {
  printHeader("8. CATÁLOGO DE PRODUCTOS");

  const productStats = await sql`
    SELECT
      company_id,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_active = true) as active
    FROM products
    GROUP BY company_id
    ORDER BY company_id
  `;

  console.log("\n📊 Productos por empresa:");
  for (const stat of productStats) {
    const companyName = stat.company_id === 1 ? 'DURA' : stat.company_id === 2 ? 'ORSEGA' : `Empresa ${stat.company_id}`;
    console.log(`  [${stat.company_id}] ${companyName}: ${stat.total} total (${stat.active} activos)`);
  }

  // Productos en sales_data sin registro en products
  const unmatchedProducts = await sql`
    SELECT DISTINCT sd.product_name, sd.company_id, COUNT(*) as sales_count
    FROM sales_data sd
    WHERE sd.product_id IS NULL
    GROUP BY sd.product_name, sd.company_id
    ORDER BY sales_count DESC
    LIMIT 15
  `;

  if (unmatchedProducts.length > 0) {
    console.log(`\n  ⚠️  Productos en ventas sin vincular (top 15):`);
    for (const product of unmatchedProducts) {
      const companyName = product.company_id === 1 ? 'DURA' : 'ORSEGA';
      console.log(`    - ${product.product_name} (${companyName}) - ${product.sales_count} ventas`);
    }
  }

  return { productStats, unmatchedProducts: unmatchedProducts.length };
}

async function auditTopClients(): Promise<void> {
  printHeader("9. TOP CLIENTES POR VOLUMEN (2024-2025)");

  for (const companyId of [1, 2]) {
    const companyName = companyId === 1 ? 'DURA' : 'ORSEGA';
    const unit = companyId === 1 ? 'KG' : 'unidades';

    printSubHeader(`Top 10 Clientes - ${companyName}`);

    const topClients = await sql`
      SELECT
        client_name,
        SUM(CASE WHEN sale_year = 2024 THEN quantity ELSE 0 END) as vol_2024,
        SUM(CASE WHEN sale_year = 2025 THEN quantity ELSE 0 END) as vol_2025,
        SUM(quantity) as total
      FROM sales_data
      WHERE company_id = ${companyId}
        AND sale_year IN (2024, 2025)
      GROUP BY client_name
      ORDER BY total DESC
      LIMIT 10
    `;

    if (topClients.length === 0) {
      console.log("  ⚠️  No hay datos de clientes");
      continue;
    }

    console.log(`\n  Cliente                              | 2024            | 2025            | Total`);
    console.log("  " + "-".repeat(90));

    for (const client of topClients) {
      const name = (client.client_name || 'Sin nombre').substring(0, 36).padEnd(36);
      console.log(`  ${name} | ${formatNumber(parseFloat(client.vol_2024)).padStart(15)} | ${formatNumber(parseFloat(client.vol_2025)).padStart(15)} | ${formatNumber(parseFloat(client.total)).padStart(15)}`);
    }
  }
}

async function generateFinalReport(results: any): Promise<void> {
  printHeader("10. REPORTE FINAL Y RECOMENDACIONES");

  const { tableAudit, duraComparison, orsegaComparison, dataQuality, refIntegrity } = results;

  // Calcular score de preparación
  let score = 0;
  let maxScore = 0;

  // Tablas (20 puntos)
  maxScore += 20;
  score += (tableAudit.exists.length / (tableAudit.exists.length + tableAudit.missing.length)) * 20;

  // Datos DURA (30 puntos)
  maxScore += 30;
  if (duraComparison) {
    const duraDataScore = ((duraComparison.matches + duraComparison.mismatches) / 24) * 30;
    score += duraDataScore * (duraComparison.matches / (duraComparison.matches + duraComparison.mismatches + duraComparison.missing || 1));
  }

  // Datos ORSEGA (30 puntos)
  maxScore += 30;
  if (orsegaComparison) {
    const orsegaDataScore = ((orsegaComparison.matches + orsegaComparison.mismatches) / 24) * 30;
    score += orsegaDataScore * (orsegaComparison.matches / (orsegaComparison.matches + orsegaComparison.mismatches + orsegaComparison.missing || 1));
  }

  // Calidad de datos (10 puntos)
  maxScore += 10;
  if (dataQuality) {
    const qualityIssues =
      (dataQuality.null_client_name > 0 ? 1 : 0) +
      (dataQuality.null_product_name > 0 ? 1 : 0) +
      (dataQuality.null_quantity > 0 ? 1 : 0) +
      (dataQuality.negative_quantity > 0 ? 1 : 0);
    score += Math.max(0, (4 - qualityIssues) / 4) * 10;
  }

  // Integridad referencial (10 puntos)
  maxScore += 10;
  if (refIntegrity) {
    const integrityIssues =
      (refIntegrity.orphanClients > 0 ? 1 : 0) +
      (refIntegrity.orphanProducts > 0 ? 1 : 0) +
      (refIntegrity.orphanUploads > 0 ? 1 : 0);
    score += Math.max(0, (3 - integrityIssues) / 3) * 10;
  }

  const percentage = (score / maxScore) * 100;

  console.log("\n╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║                         PUNTUACIÓN DE PREPARACIÓN                             ║");
  console.log("╠══════════════════════════════════════════════════════════════════════════════╣");

  let statusEmoji: string;
  let statusText: string;
  if (percentage >= 90) {
    statusEmoji = "🟢";
    statusText = "LISTO PARA PRODUCCIÓN";
  } else if (percentage >= 70) {
    statusEmoji = "🟡";
    statusText = "CASI LISTO - Revisar detalles";
  } else if (percentage >= 50) {
    statusEmoji = "🟠";
    statusText = "NECESITA TRABAJO";
  } else {
    statusEmoji = "🔴";
    statusText = "NO LISTO - Faltan datos críticos";
  }

  console.log(`║  ${statusEmoji} Score: ${percentage.toFixed(1)}% - ${statusText.padEnd(50)}║`);
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝");

  // Recomendaciones
  console.log("\n📋 RECOMENDACIONES:");

  const recommendations: string[] = [];

  if (tableAudit.missing.length > 0) {
    recommendations.push(`❌ CRÍTICO: Faltan tablas: ${tableAudit.missing.join(', ')}`);
  }

  if (duraComparison?.missing > 0) {
    recommendations.push(`❌ CRÍTICO: DURA tiene ${duraComparison.missing} meses sin datos`);
  }

  if (orsegaComparison?.missing > 0) {
    recommendations.push(`❌ CRÍTICO: ORSEGA tiene ${orsegaComparison.missing} meses sin datos`);
  }

  if (duraComparison?.mismatches > 0) {
    recommendations.push(`⚠️  VERIFICAR: DURA tiene ${duraComparison.mismatches} meses con valores diferentes a los hardcodeados`);
  }

  if (orsegaComparison?.mismatches > 0) {
    recommendations.push(`⚠️  VERIFICAR: ORSEGA tiene ${orsegaComparison.mismatches} meses con valores diferentes a los hardcodeados`);
  }

  if (dataQuality?.null_client_name > 0 || dataQuality?.null_product_name > 0) {
    recommendations.push(`⚠️  CALIDAD: Hay registros con client_name o product_name vacíos`);
  }

  if (dataQuality?.negative_quantity > 0) {
    recommendations.push(`⚠️  CALIDAD: Hay ${dataQuality.negative_quantity} registros con cantidad negativa`);
  }

  if (refIntegrity?.orphanClients > 0 || refIntegrity?.orphanProducts > 0) {
    recommendations.push(`🟡 OPCIONAL: Vincular clientes/productos huérfanos a sus registros en catálogo`);
  }

  if (recommendations.length === 0) {
    recommendations.push("✅ Los datos parecen estar listos para reemplazar los hardcodeados");
  }

  for (const rec of recommendations) {
    console.log(`  ${rec}`);
  }

  // Próximos pasos
  console.log("\n📌 PRÓXIMOS PASOS:");
  if (percentage >= 90) {
    console.log("  1. Revisar los valores que difieren (si los hay)");
    console.log("  2. Cambiar HARDCODED_SALES_DATA_ENABLED = false en routes.ts");
    console.log("  3. Probar los endpoints sin datos hardcodeados");
    console.log("  4. Eliminar el componente SalesYearlyComparisonTable.tsx");
  } else if (percentage >= 50) {
    console.log("  1. Cargar los datos faltantes vía /api/sales/upload");
    console.log("  2. Corregir problemas de calidad identificados");
    console.log("  3. Ejecutar esta auditoría nuevamente");
  } else {
    console.log("  1. Verificar que las tablas estén creadas (ejecutar migraciones)");
    console.log("  2. Cargar datos históricos de ventas 2024-2025");
    console.log("  3. Ejecutar esta auditoría nuevamente");
  }
}

// ============================================================================
// EJECUCIÓN PRINCIPAL
// ============================================================================

async function main() {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════════════════════════╗");
  console.log("║           AUDITORÍA PROFUNDA DE DATOS DE VENTAS - NEON DATABASE              ║");
  console.log("║                    KPIs Grupo Orsega / Dura International                    ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════════╝");
  console.log(`\n📅 Fecha de auditoría: ${new Date().toLocaleString('es-MX')}`);
  console.log(`🔗 Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Neon'}`);

  try {
    const results: any = {};

    // 1. Verificar tablas
    results.tableAudit = await auditTableExistence();

    // 2. Verificar empresas
    results.companies = await auditCompanies();

    // 3. Resumen de datos
    results.overview = await auditSalesDataOverview();

    // 4. Datos mensuales y comparación
    printHeader("COMPARACIÓN DETALLADA CON DATOS HARDCODEADOS");

    const duraMonthlyData = await auditMonthlyData(1, "DURA");
    if (duraMonthlyData.length > 0) {
      results.duraComparison = await compareWithHardcoded(1, "DURA", HARDCODED_DURA_DATA, duraMonthlyData);
    } else {
      results.duraComparison = { matches: 0, mismatches: 0, missing: 24, details: [] };
    }

    const orsegaMonthlyData = await auditMonthlyData(2, "ORSEGA");
    if (orsegaMonthlyData.length > 0) {
      results.orsegaComparison = await compareWithHardcoded(2, "ORSEGA", HARDCODED_ORSEGA_DATA, orsegaMonthlyData);
    } else {
      results.orsegaComparison = { matches: 0, mismatches: 0, missing: 24, details: [] };
    }

    // 5. Historial de uploads
    results.uploads = await auditSalesUploads();

    // 6. Calidad de datos
    results.dataQuality = await auditDataQuality();

    // 7. Integridad referencial
    results.refIntegrity = await auditReferentialIntegrity();

    // 8. Clientes
    results.clients = await auditClients();

    // 9. Productos
    results.products = await auditProducts();

    // 10. Top clientes
    await auditTopClients();

    // 11. Reporte final
    await generateFinalReport(results);

    console.log("\n✅ Auditoría completada exitosamente\n");

  } catch (error) {
    console.error("\n❌ Error durante la auditoría:", error);
    process.exit(1);
  }
}

main();

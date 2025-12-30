/**
 * Script para procesar datos de ORSEGA y generar INSERTs
 *
 * Uso:
 * 1. Guarda los datos del Excel en un archivo CSV: scripts/migrations/orsega-data.csv
 * 2. Ejecuta: npx tsx scripts/migrations/insert-orsega-data.ts
 * 3. El script generará el SQL en: scripts/migrations/orsega-inserts.sql
 *
 * Formato esperado del CSV (tab-separated o comma-separated):
 * Factura, Fecha, Cliente, Producto, FAMILIA DEL PRODUCTO, UNIDAD, Cantidad, USD, MN, USD 2.00, MN2, TIPO DE CAMBIO, IMPORTE M.N.
 */

import * as fs from "fs";
import * as path from "path";

const INPUT_FILE = path.join(__dirname, "orsega-data.csv");
const OUTPUT_FILE = path.join(__dirname, "orsega-inserts.sql");

interface OrsegaRow {
  factura: string;
  fecha: string;
  cliente: string;
  producto: string;
  familiaProducto: string;
  unidad: string;
  cantidad: number;
  usd: number;
  mn: number;
  tipoCambio: number;
  importeMN: number;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") return null;

  // Formato: DD/MM/YYYY o DD-MM-YYYY
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return null;
}

function parseNumber(value: string): number {
  if (!value || value.trim() === "" || value === "-") return 0;
  // Remover comas de miles y convertir
  const cleaned = value.replace(/,/g, "").replace(/\$/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function escapeSQL(str: string): string {
  if (!str) return "";
  return str.replace(/'/g, "''").trim();
}

function processCSV(content: string): OrsegaRow[] {
  const lines = content.split("\n");
  const rows: OrsegaRow[] = [];

  // Detectar separador (tab o comma)
  const firstDataLine = lines.find(
    (l) =>
      l.trim() &&
      !l.toLowerCase().includes("factura") &&
      !l.toLowerCase().includes("fecha")
  );
  const separator = firstDataLine?.includes("\t") ? "\t" : ",";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Saltar headers
    if (
      line.toLowerCase().includes("factura") &&
      line.toLowerCase().includes("fecha")
    ) {
      continue;
    }

    const cols = line.split(separator);
    if (cols.length < 7) continue;

    const fecha = parseDate(cols[1]);
    if (!fecha) continue;

    const row: OrsegaRow = {
      factura: cols[0]?.trim() || "",
      fecha: fecha,
      cliente: cols[2]?.trim() || "",
      producto: cols[3]?.trim() || "",
      familiaProducto: cols[4]?.trim() || "",
      unidad: cols[5]?.trim() || "UNIDAD",
      cantidad: parseNumber(cols[6]),
      usd: parseNumber(cols[7]),
      mn: parseNumber(cols[8]),
      tipoCambio: parseNumber(cols[11] || cols[10]),
      importeMN: parseNumber(cols[12] || cols[11]),
    };

    if (row.cliente && row.cantidad > 0) {
      rows.push(row);
    }
  }

  return rows;
}

function generateSQL(rows: OrsegaRow[]): string {
  let sql = `-- ============================================
-- DATOS DE ORSEGA - Generado automáticamente
-- Total de registros: ${rows.length}
-- company_id = 2 (ORSEGA)
-- ============================================

BEGIN;

`;

  // Agrupar en batches de 100 para evitar queries muy largos
  const batchSize = 100;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    sql += `INSERT INTO ventas (company_id, fecha, factura, cliente, producto, familia_producto, unidad, cantidad, usd, mn, tipo_cambio, importe_mn) VALUES\n`;

    const values = batch.map((row) => {
      return `(2, '${row.fecha}', '${escapeSQL(row.factura)}', '${escapeSQL(row.cliente)}', '${escapeSQL(row.producto)}', '${escapeSQL(row.familiaProducto)}', '${escapeSQL(row.unidad)}', ${row.cantidad}, ${row.usd}, ${row.mn}, ${row.tipoCambio}, ${row.importeMN})`;
    });

    sql += values.join(",\n") + ";\n\n";
  }

  sql += `COMMIT;

-- Verificación
SELECT
    'ORSEGA' as empresa,
    COUNT(*) as total_registros,
    MIN(fecha) as fecha_inicio,
    MAX(fecha) as fecha_fin,
    COUNT(DISTINCT cliente) as clientes_unicos,
    COUNT(DISTINCT producto) as productos_unicos
FROM ventas
WHERE company_id = 2;
`;

  return sql;
}

// Main
function main() {
  console.log("📦 Procesando datos de ORSEGA...\n");

  if (!fs.existsSync(INPUT_FILE)) {
    console.log(`❌ No se encontró el archivo: ${INPUT_FILE}`);
    console.log("\n📋 Instrucciones:");
    console.log("1. Copia los datos del Excel");
    console.log(
      "2. Guárdalos en: scripts/migrations/orsega-data.csv (separado por tabs o comas)"
    );
    console.log("3. Ejecuta este script de nuevo\n");

    // Crear archivo de ejemplo
    const example = `Factura\tFecha\tCliente\tProducto\tFAMILIA DEL PRODUCTO\tUNIDAD\tCantidad\tUSD\tMN\tUSD 2.00\tMN2\tTIPO DE CAMBIO\tIMPORTE M.N.
B-00001\t01/01/2022\tCLIENTE EJEMPLO\tPRODUCTO 1\tFAMILIA A\tUNIDAD\t100\t50.00\t1000.00\t0\t0\t20.00\t1000.00`;
    fs.writeFileSync(INPUT_FILE + ".example", example);
    console.log(`📄 Se creó un archivo de ejemplo: ${INPUT_FILE}.example\n`);
    return;
  }

  const content = fs.readFileSync(INPUT_FILE, "utf-8");
  const rows = processCSV(content);

  if (rows.length === 0) {
    console.log("❌ No se encontraron datos válidos en el archivo");
    return;
  }

  console.log(`✓ Procesados ${rows.length} registros`);

  // Estadísticas
  const clientes = new Set(rows.map((r) => r.cliente));
  const productos = new Set(rows.map((r) => r.producto));
  const fechas = rows.map((r) => r.fecha).sort();

  console.log(`  - Clientes únicos: ${clientes.size}`);
  console.log(`  - Productos únicos: ${productos.size}`);
  console.log(`  - Rango de fechas: ${fechas[0]} a ${fechas[fechas.length - 1]}`);

  // Generar SQL
  const sql = generateSQL(rows);
  fs.writeFileSync(OUTPUT_FILE, sql);

  console.log(`\n✅ SQL generado en: ${OUTPUT_FILE}`);
  console.log(`\n📋 Próximos pasos:`);
  console.log(`1. Ejecuta en Neon: create-unified-ventas.sql`);
  console.log(`2. Ejecuta en Neon: migrate-ventas-dura-to-ventas.sql`);
  console.log(`3. Ejecuta en Neon: orsega-inserts.sql`);
}

main();

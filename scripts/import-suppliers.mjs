/**
 * Script de importación de proveedores desde los Excel de Jesús.
 *
 * Estrategia: Match por nombre normalizado + company_id → UPDATE existentes, INSERT nuevos
 * Preserva scheduled_payments vinculados via supplier_id.
 *
 * Uso: node scripts/import-suppliers.mjs
 */
import pg from 'pg';
import fs from 'fs';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const suppliers = JSON.parse(fs.readFileSync('/tmp/all_suppliers.json', 'utf-8'));

function normalize(name) {
  if (!name) return '';
  return name.toUpperCase().trim().replace(/\s+/g, ' ').replace(/,\s*$/, '');
}

async function run() {
  const matchedIds = [];
  const insertedIds = [];
  let matchCount = 0;
  let insertCount = 0;
  let skipCount = 0;

  console.log(`\nImportando ${suppliers.length} proveedores...\n`);

  for (const s of suppliers) {
    if (!s.name && !s.short_name) { skipCount++; continue; }

    const normalizedName = normalize(s.short_name || s.name);
    const normalizedRazon = normalize(s.name);
    const companyId = s.company_id;

    // Try to match by normalized short_name OR razon_social + company_id
    const existing = await pool.query(
      `SELECT id, name, short_name FROM suppliers
       WHERE company_id = $1 AND (
         REGEXP_REPLACE(UPPER(TRIM(COALESCE(short_name, name))), '\\s+', ' ', 'g') = $2
         OR REGEXP_REPLACE(UPPER(TRIM(name)), '\\s+', ' ', 'g') = $3
       )
       LIMIT 1`,
      [companyId, normalizedName, normalizedRazon]
    );

    const location = [s.city, s.state].filter(Boolean).join(', ') || null;

    if (existing.rows.length > 0) {
      const id = existing.rows[0].id;
      await pool.query(`
        UPDATE suppliers SET
          name = $1, short_name = $2, code = $3, rfc = $4, razon_social = $5,
          street_address = $6, colonia = $7, city = $8, state = $9, postal_code = $10,
          num_exterior = $11, num_interior = $12, entre_calle = $13,
          phone = $14, contact_name = $15, condicion_dias = $16, moneda = $17,
          tipo_proveedor = $18, es_nacional = $19, requires_rep = $20,
          location = $21, is_active = true, updated_at = NOW()
        WHERE id = $22
      `, [
        s.name, s.short_name, s.code, s.rfc, s.razon_social,
        s.street_address, s.colonia, s.city, s.state, s.postal_code,
        s.num_exterior, s.num_interior, s.entre_calle,
        s.phone, s.contact_name, s.condicion_dias, s.moneda,
        s.tipo_proveedor, s.es_nacional, s.requires_rep,
        location, id
      ]);
      matchedIds.push(id);
      matchCount++;
      console.log(`  ✓ MATCH [${companyId === 1 ? 'DURA' : 'ORSEGA'}] ${s.short_name || s.name} (id=${id})`);
    } else {
      const result = await pool.query(`
        INSERT INTO suppliers (
          name, short_name, code, rfc, razon_social,
          street_address, colonia, city, state, postal_code,
          num_exterior, num_interior, entre_calle,
          phone, contact_name, condicion_dias, moneda,
          tipo_proveedor, es_nacional, requires_rep,
          location, company_id, is_active, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20,
          $21, $22, true, NOW(), NOW()
        ) RETURNING id
      `, [
        s.name, s.short_name, s.code, s.rfc, s.razon_social,
        s.street_address, s.colonia, s.city, s.state, s.postal_code,
        s.num_exterior, s.num_interior, s.entre_calle,
        s.phone, s.contact_name, s.condicion_dias, s.moneda,
        s.tipo_proveedor, s.es_nacional, s.requires_rep,
        location, companyId
      ]);
      insertedIds.push(result.rows[0].id);
      insertCount++;
      console.log(`  + INSERT [${companyId === 1 ? 'DURA' : 'ORSEGA'}] ${s.short_name || s.name} (id=${result.rows[0].id})`);
    }
  }

  // Soft-delete suppliers not in Excel (but preserve those with scheduled_payments)
  const allActiveIds = [...matchedIds, ...insertedIds];

  // First check which ones have payments linked
  const linkedToPayments = await pool.query(`
    SELECT DISTINCT supplier_id FROM scheduled_payments
    WHERE supplier_id IS NOT NULL
  `);
  const paymentLinkedIds = new Set(linkedToPayments.rows.map(r => r.supplier_id));

  const deactivated = await pool.query(`
    UPDATE suppliers SET is_active = false, updated_at = NOW()
    WHERE id != ALL($1::int[]) AND is_active = true
    RETURNING id, name, short_name, company_id
  `, [allActiveIds]);

  console.log(`\n--- RESUMEN ---`);
  console.log(`Matched (updated): ${matchCount}`);
  console.log(`Inserted (new):    ${insertCount}`);
  console.log(`Skipped (no name): ${skipCount}`);
  console.log(`Deactivated:       ${deactivated.rows.length}`);

  if (deactivated.rows.length > 0) {
    console.log(`\nProveedores desactivados:`);
    for (const row of deactivated.rows) {
      const hasPayments = paymentLinkedIds.has(row.id);
      console.log(`  - [${row.company_id === 1 ? 'DURA' : 'ORSEGA'}] ${row.short_name || row.name} (id=${row.id})${hasPayments ? ' ⚠️  TIENE PAGOS VINCULADOS' : ''}`);
    }
  }

  // Verify final counts
  const countDura = await pool.query(`SELECT count(*) FROM suppliers WHERE is_active = true AND company_id = 1`);
  const countOrsega = await pool.query(`SELECT count(*) FROM suppliers WHERE is_active = true AND company_id = 2`);
  const repSI = await pool.query(`SELECT count(*) FROM suppliers WHERE is_active = true AND requires_rep = true`);
  const repNO = await pool.query(`SELECT count(*) FROM suppliers WHERE is_active = true AND requires_rep = false`);

  console.log(`\n--- VERIFICACIÓN ---`);
  console.log(`Proveedores activos Dura:   ${countDura.rows[0].count} (esperado: 60)`);
  console.log(`Proveedores activos Orsega: ${countOrsega.rows[0].count} (esperado: 91)`);
  console.log(`Requiere REP = SI:          ${repSI.rows[0].count} (esperado: 89)`);
  console.log(`Requiere REP = NO:          ${repNO.rows[0].count} (esperado: 62)`);
  console.log(`Total activos:              ${parseInt(countDura.rows[0].count) + parseInt(countOrsega.rows[0].count)} (esperado: 151)`);

  await pool.end();
  console.log('\nDone.');
}

run().catch(err => { console.error(err); process.exit(1); });

/**
 * Script de importación de clientes desde los Excel de Jesús.
 *
 * Estrategia: Match por nombre → UPDATE existentes, INSERT nuevos, soft-delete sobrantes
 * Preserva envíos históricos vinculados via customer_id.
 *
 * Uso: node scripts/import-clients-final.mjs
 */
import pg from 'pg';
import fs from 'fs';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const clients = JSON.parse(fs.readFileSync('/tmp/all_clients_final.json', 'utf-8'));

function normalize(name) {
  if (!name) return '';
  return name.toUpperCase().trim().replace(/\s+/g, ' ').replace(/,\s*$/, '');
}

function buildAddress(c) {
  const parts = [c.calle, c.num_ext ? `#${c.num_ext}` : null, c.num_int ? `Int. ${c.num_int}` : null].filter(Boolean);
  return parts.join(' ') || null;
}

async function run() {
  const matchedIds = [];
  const insertedIds = [];
  let matchCount = 0;
  let insertCount = 0;
  let skipCount = 0;

  console.log(`\nImportando ${clients.length} clientes...\n`);

  for (const c of clients) {
    if (!c.name) { skipCount++; continue; }

    const normalizedName = normalize(c.name);
    const companyId = c.company_id;

    // Try to match by normalized name + company_id
    const existing = await pool.query(
      `SELECT id, name FROM clients WHERE REGEXP_REPLACE(UPPER(TRIM(name)), '\\s+', ' ', 'g') = $1 AND company_id = $2 LIMIT 1`,
      [normalizedName, companyId]
    );

    const values = {
      name: c.name,
      email: c.email || 'sin-email@pendiente.com',
      phone: null, // Phone comes from the collection order Excels, not the client list
      company: c.name, // company field = client name for display
      address: buildAddress(c),
      companyId: companyId,
      city: c.ciudad,
      state: c.estado,
      postalCode: c.cp,
      colonia: c.colonia,
      isActive: true,
      rfc: c.rfc,
      razonSocial: c.razon_social || c.name,
      numExterior: c.num_ext ? String(c.num_ext) : null,
      numInterior: c.num_int ? String(c.num_int) : null,
      entreCalle: c.entre_calles,
      formaPago: c.forma_pago ? String(c.forma_pago) : null,
      metodoPago: c.metodo_pago,
      moneda: c.moneda,
      regimenFiscal: c.regimen_fiscal ? String(c.regimen_fiscal) : null,
      condicionDias: c.condicion_dias ? String(c.condicion_dias) : null,
      emailContacto: c.email_contacto,
    };

    if (existing.rows.length > 0) {
      // UPDATE existing client
      const id = existing.rows[0].id;
      await pool.query(`
        UPDATE clients SET
          name = $1, email = $2, street_address = $3, company_id = $4,
          city = $5, state = $6, postal_code = $7, colonia = $8,
          is_active = true, rfc = $9, razon_social = $10,
          num_exterior = $11, num_interior = $12, entre_calle = $13,
          forma_pago = $14, metodo_pago = $15, moneda = $16,
          regimen_fiscal = $17, condicion_dias = $18, email_contacto = $19,
          updated_at = NOW()
        WHERE id = $20
      `, [
        values.name, values.email, values.address, values.companyId,
        values.city, values.state, values.postalCode, values.colonia,
        values.rfc, values.razonSocial,
        values.numExterior, values.numInterior, values.entreCalle,
        values.formaPago, values.metodoPago, values.moneda,
        values.regimenFiscal, values.condicionDias, values.emailContacto,
        id
      ]);
      matchedIds.push(id);
      matchCount++;
      console.log(`  ✓ MATCH [${companyId === 1 ? 'DURA' : 'ORSEGA'}] ${values.name} (id=${id})`);
    } else {
      // INSERT new client
      const result = await pool.query(`
        INSERT INTO clients (
          name, email, street_address, company_id, city, state, postal_code, colonia,
          is_active, rfc, razon_social, num_exterior, num_interior, entre_calle,
          forma_pago, metodo_pago, moneda, regimen_fiscal, condicion_dias, email_contacto,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          true, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19,
          NOW(), NOW()
        ) RETURNING id
      `, [
        values.name, values.email, values.address, values.companyId,
        values.city, values.state, values.postalCode, values.colonia,
        values.rfc, values.razonSocial,
        values.numExterior, values.numInterior, values.entreCalle,
        values.formaPago, values.metodoPago, values.moneda,
        values.regimenFiscal, values.condicionDias, values.emailContacto,
      ]);
      insertedIds.push(result.rows[0].id);
      insertCount++;
      console.log(`  + INSERT [${companyId === 1 ? 'DURA' : 'ORSEGA'}] ${values.name} (id=${result.rows[0].id})`);
    }
  }

  // Soft-delete clients not in Excel
  const allActiveIds = [...matchedIds, ...insertedIds];
  const deactivated = await pool.query(`
    UPDATE clients SET is_active = false, updated_at = NOW()
    WHERE id != ALL($1::int[]) AND is_active = true
    RETURNING id, name, company_id
  `, [allActiveIds]);

  console.log(`\n--- RESUMEN ---`);
  console.log(`Matched (updated): ${matchCount}`);
  console.log(`Inserted (new):    ${insertCount}`);
  console.log(`Skipped (no name): ${skipCount}`);
  console.log(`Deactivated:       ${deactivated.rows.length}`);

  if (deactivated.rows.length > 0) {
    console.log(`\nClientes desactivados:`);
    for (const row of deactivated.rows) {
      console.log(`  - [${row.company_id === 1 ? 'DURA' : 'ORSEGA'}] ${row.name} (id=${row.id})`);
    }
  }

  // Verify final counts
  const countDura = await pool.query(`SELECT count(*) FROM clients WHERE is_active = true AND company_id = 1`);
  const countOrsega = await pool.query(`SELECT count(*) FROM clients WHERE is_active = true AND company_id = 2`);
  const linkedShipments = await pool.query(`
    SELECT count(*) FROM shipments s
    INNER JOIN clients c ON s.customer_id = c.id
    WHERE c.is_active = false
  `);

  console.log(`\n--- VERIFICACIÓN ---`);
  console.log(`Clientes activos Dura:   ${countDura.rows[0].count} (esperado: 60)`);
  console.log(`Clientes activos Orsega: ${countOrsega.rows[0].count} (esperado: 50)`);
  console.log(`Envíos vinculados a clientes desactivados: ${linkedShipments.rows[0].count} (estos NO se pierden)`);

  await pool.end();
  console.log('\nDone.');
}

run().catch(err => { console.error(err); process.exit(1); });

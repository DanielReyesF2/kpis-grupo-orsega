/**
 * Script para crear/actualizar los 12 usuarios del equipo Grupo Orsega.
 * Todos admin, acceso a ambas empresas (companyId = null).
 * Contraseña genérica: Orsega2026!
 *
 * Uso: node scripts/setup-users.mjs
 */
import pg from 'pg';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const PASSWORD = 'Orsega2026!';

const team = [
  { name: 'Emilio del Valle',     email: 'emilio.delvalle@orsega.mx',     phone: '33 1616 9908' },
  { name: 'Alberto Viladomat',    email: 'alberto.viladomat@orsega.mx',   phone: '33 1728 4182' },
  { name: 'Dolores Navarro',      email: 'dolores.navarro@orsega.mx',     phone: '33 1609 3798' },
  { name: 'Fernanda del Valle',   email: 'fernanda.delvalle@orsega.mx',   phone: '33 3954 4090' },
  { name: 'Andrea Navarro',       email: 'andrea.navarro@orsega.mx',      phone: '33 2106 5706' },
  { name: 'Alejandra Palomera',   email: 'alejandra.palomera@orsega.mx',  phone: '33 1111 0488' },
  { name: 'Omar Navarro',         email: 'omar.navarro@orsega.mx',        phone: '33 1369 0684' },
  { name: 'Daniel Marquez',       email: 'daniel.marquez@orsega.mx',      phone: '33 1587 6361' },
  { name: 'Jesus Espinoza',       email: 'jesus.espinoza@orsega.mx',      phone: '33 1809 2852' },
  { name: 'Guillermo Galindo',    email: 'guillermo.galindo@orsega.mx',   phone: '33 2149 8522' },
  { name: 'Julio Martell',        email: 'julio.martell@orsega.mx',       phone: '33 1806 6013' },
  { name: 'Mario Reynoso',        email: 'mario.reynoso@orsega.mx',       phone: '33 2262 7838' },
];

async function run() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  console.log(`\nCreando/actualizando ${team.length} usuarios...`);
  console.log(`Contraseña: ${PASSWORD}`);
  console.log(`Hash: ${hash.substring(0, 20)}...\n`);

  for (const member of team) {
    // Check if user already exists by name (case insensitive)
    const existing = await pool.query(
      `SELECT id, name, email FROM users WHERE LOWER(name) = LOWER($1)`,
      [member.name]
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      await pool.query(
        `UPDATE users SET password = $1, role = 'admin', email = $2 WHERE id = $3`,
        [hash, member.email, user.id]
      );
      console.log(`  ✓ UPDATED [id=${user.id}] ${member.name} → ${member.email}`);
    } else {
      const result = await pool.query(
        `INSERT INTO users (name, email, password, role, company_id)
         VALUES ($1, $2, $3, 'admin', NULL)
         RETURNING id`,
        [member.name, member.email, hash]
      );
      console.log(`  + CREATED [id=${result.rows[0].id}] ${member.name} → ${member.email}`);
    }
  }

  // List all users
  const allUsers = await pool.query(
    `SELECT id, name, email, role, company_id FROM users ORDER BY id`
  );

  console.log(`\n--- TODOS LOS USUARIOS ---`);
  console.log(`${'ID'.padEnd(5)} ${'Nombre'.padEnd(25)} ${'Email/Usuario'.padEnd(30)} ${'Rol'.padEnd(10)} Company`);
  console.log('-'.repeat(85));
  for (const u of allUsers.rows) {
    console.log(`${String(u.id).padEnd(5)} ${u.name.padEnd(25)} ${u.email.padEnd(30)} ${u.role.padEnd(10)} ${u.company_id ?? 'ALL'}`);
  }

  console.log(`\nTotal: ${allUsers.rows.length} usuarios`);
  await pool.end();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });

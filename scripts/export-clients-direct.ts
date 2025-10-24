#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';
import { writeFileSync } from 'fs';

async function exportClients() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL no encontrada');
    process.exit(1);
  }

  console.log('📤 Exportando clientes de development...\n');

  const sql = neon(dbUrl);

  try {
    const clientsData = await sql`SELECT * FROM clients ORDER BY id`;

    console.log(`📊 Total de clientes: ${clientsData.length}\n`);

    // Generar SQL de INSERT  
    let sqlInsert = `-- CLIENTS MIGRATION SQL\n`;
    sqlInsert += `-- Fecha: ${new Date().toISOString()}\n\n`;

    if (clientsData.length > 0) {
      sqlInsert += `-- ========== CLIENTS ==========\n`;
      sqlInsert += `INSERT INTO clients (id, name, email, phone, contact_person, company, address, payment_terms, requires_receipt, reminder_frequency, is_active, notes, company_id, client_code, secondary_email, city, state, postal_code, country, email_notifications, customer_type) VALUES\n`;
      
      sqlInsert += clientsData.map((c: any) => {
        return `  (${c.id}, ${escape(c.name)}, ${escape(c.email)}, ${escape(c.phone)}, ${escape(c.contact_person)}, ${escape(c.company)}, ${escape(c.address)}, ${c.payment_terms || 'NULL'}, ${c.requires_receipt}, ${c.reminder_frequency || 'NULL'}, ${c.is_active}, ${escape(c.notes)}, ${c.company_id || 'NULL'}, ${escape(c.client_code)}, ${escape(c.secondary_email)}, ${escape(c.city)}, ${escape(c.state)}, ${escape(c.postal_code)}, ${escape(c.country)}, ${c.email_notifications}, ${escape(c.customer_type)})`;
      }).join(',\n');
      
      sqlInsert += `\nON CONFLICT (id) DO UPDATE SET\n`;
      sqlInsert += `  name = EXCLUDED.name,\n`;
      sqlInsert += `  email = EXCLUDED.email,\n`;
      sqlInsert += `  phone = EXCLUDED.phone,\n`;
      sqlInsert += `  contact_person = EXCLUDED.contact_person,\n`;
      sqlInsert += `  company = EXCLUDED.company,\n`;
      sqlInsert += `  address = EXCLUDED.address,\n`;
      sqlInsert += `  payment_terms = EXCLUDED.payment_terms,\n`;
      sqlInsert += `  requires_receipt = EXCLUDED.requires_receipt,\n`;
      sqlInsert += `  reminder_frequency = EXCLUDED.reminder_frequency,\n`;
      sqlInsert += `  is_active = EXCLUDED.is_active,\n`;
      sqlInsert += `  notes = EXCLUDED.notes,\n`;
      sqlInsert += `  company_id = EXCLUDED.company_id,\n`;
      sqlInsert += `  client_code = EXCLUDED.client_code,\n`;
      sqlInsert += `  secondary_email = EXCLUDED.secondary_email,\n`;
      sqlInsert += `  city = EXCLUDED.city,\n`;
      sqlInsert += `  state = EXCLUDED.state,\n`;
      sqlInsert += `  postal_code = EXCLUDED.postal_code,\n`;
      sqlInsert += `  country = EXCLUDED.country,\n`;
      sqlInsert += `  email_notifications = EXCLUDED.email_notifications,\n`;
      sqlInsert += `  customer_type = EXCLUDED.customer_type;\n\n`;
    }

    // Guardar archivo
    const filename = 'scripts/clients-migration.sql';
    writeFileSync(filename, sqlInsert);
    
    console.log(`✅ Archivo SQL generado: ${filename}`);
    console.log(`📋 Total de clientes exportados: ${clientsData.length}\n`);
    
    // Muestra
    console.log('📝 Muestra de clientes:');
    clientsData.slice(0, 3).forEach((c: any) => {
      console.log(`   - ${c.name} (${c.email}) - ${c.company_id === 1 ? 'Dura' : 'Orsega'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

function escape(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'number') return value.toString();
  return `'${String(value).replace(/'/g, "''")}'`;
}

exportClients();

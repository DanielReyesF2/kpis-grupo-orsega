#!/usr/bin/env tsx
import { db } from '../server/db';
import { clients } from '../shared/schema';
import { writeFileSync } from 'fs';

async function exportClients() {
  console.log('📤 Exportando clientes de development...\n');

  try {
    const clientsData = await db.select().from(clients);

    console.log(`📊 Total de clientes: ${clientsData.length}\n`);

    // Generar SQL de INSERT
    let sql = `-- CLIENTS MIGRATION SQL\n`;
    sql += `-- Fecha: ${new Date().toISOString()}\n\n`;

    if (clientsData.length > 0) {
      sql += `-- ========== CLIENTS ==========\n`;
      sql += `INSERT INTO clients (id, name, email, phone, contact_person, company, address, payment_terms, requires_receipt, reminder_frequency, is_active, notes, company_id, client_code, secondary_email, city, state, postal_code, country, email_notifications, customer_type) VALUES\n`;
      
      sql += clientsData.map((c: any) => {
        return `  (${c.id}, ${escape(c.name)}, ${escape(c.email)}, ${escape(c.phone)}, ${escape(c.contactPerson)}, ${escape(c.company)}, ${escape(c.address)}, ${c.paymentTerms || 'NULL'}, ${c.requiresReceipt}, ${c.reminderFrequency || 'NULL'}, ${c.isActive}, ${escape(c.notes)}, ${c.companyId || 'NULL'}, ${escape(c.clientCode)}, ${escape(c.secondaryEmail)}, ${escape(c.city)}, ${escape(c.state)}, ${escape(c.postalCode)}, ${escape(c.country)}, ${c.emailNotifications}, ${escape(c.customerType)})`;
      }).join(',\n');
      
      sql += `\nON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  name = EXCLUDED.name,\n`;
      sql += `  email = EXCLUDED.email,\n`;
      sql += `  phone = EXCLUDED.phone,\n`;
      sql += `  contact_person = EXCLUDED.contact_person,\n`;
      sql += `  company = EXCLUDED.company,\n`;
      sql += `  address = EXCLUDED.address,\n`;
      sql += `  payment_terms = EXCLUDED.payment_terms,\n`;
      sql += `  requires_receipt = EXCLUDED.requires_receipt,\n`;
      sql += `  reminder_frequency = EXCLUDED.reminder_frequency,\n`;
      sql += `  is_active = EXCLUDED.is_active,\n`;
      sql += `  notes = EXCLUDED.notes,\n`;
      sql += `  company_id = EXCLUDED.company_id,\n`;
      sql += `  client_code = EXCLUDED.client_code,\n`;
      sql += `  secondary_email = EXCLUDED.secondary_email,\n`;
      sql += `  city = EXCLUDED.city,\n`;
      sql += `  state = EXCLUDED.state,\n`;
      sql += `  postal_code = EXCLUDED.postal_code,\n`;
      sql += `  country = EXCLUDED.country,\n`;
      sql += `  email_notifications = EXCLUDED.email_notifications,\n`;
      sql += `  customer_type = EXCLUDED.customer_type;\n\n`;
    }

    // Guardar archivo
    const filename = 'scripts/clients-migration.sql';
    writeFileSync(filename, sql);
    
    console.log(`✅ Archivo SQL generado: ${filename}`);
    console.log(`📋 Total de clientes exportados: ${clientsData.length}\n`);
    
    // Muestra de los primeros 3 clientes
    console.log('📝 Muestra de clientes:');
    clientsData.slice(0, 3).forEach(c => {
      console.log(`   - ${c.name} (${c.email})`);
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

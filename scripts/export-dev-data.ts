#!/usr/bin/env tsx
// Script para exportar TODOS los datos de development
import { db } from '../server/db';
import { companies, areas, kpis, users } from '../shared/schema';
import { writeFileSync } from 'fs';

async function exportDevData() {
  console.log('📤 Exportando datos de development...\n');

  try {
    // Obtener todos los datos
    const companiesData = await db.select().from(companies);
    const areasData = await db.select().from(areas);
    const kpisData = await db.select().from(kpis);
    const usersData = await db.select().from(users);

    console.log(`📊 Datos encontrados:`);
    console.log(`   Companies: ${companiesData.length}`);
    console.log(`   Areas: ${areasData.length}`);
    console.log(`   KPIs: ${kpisData.length}`);
    console.log(`   Users: ${usersData.length}\n`);

    // Generar SQL de INSERT para production
    let sql = `-- MIGRATION SQL - Generado automáticamente\n`;
    sql += `-- Fecha: ${new Date().toISOString()}\n\n`;

    // Companies
    if (companiesData.length > 0) {
      sql += `-- ========== COMPANIES ==========\n`;
      sql += `INSERT INTO companies (id, name, description, sector) VALUES\n`;
      sql += companiesData.map(c => 
        `  (${c.id}, ${escape(c.name)}, ${escape(c.description)}, ${escape(c.sector)})`
      ).join(',\n');
      sql += `\nON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  name = EXCLUDED.name,\n`;
      sql += `  description = EXCLUDED.description,\n`;
      sql += `  sector = EXCLUDED.sector;\n\n`;
    }

    // Areas
    if (areasData.length > 0) {
      sql += `-- ========== AREAS ==========\n`;
      sql += `INSERT INTO areas (id, name, description, "companyId") VALUES\n`;
      sql += areasData.map(a => 
        `  (${a.id}, ${escape(a.name)}, ${escape(a.description)}, ${a.companyId})`
      ).join(',\n');
      sql += `\nON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  name = EXCLUDED.name,\n`;
      sql += `  description = EXCLUDED.description,\n`;
      sql += `  "companyId" = EXCLUDED."companyId";\n\n`;
    }

    // Users (sin passwords sensibles)
    if (usersData.length > 0) {
      sql += `-- ========== USERS ==========\n`;
      sql += `INSERT INTO users (id, email, password, name, role, "companyId", "areaId") VALUES\n`;
      sql += usersData.map(u => 
        `  (${u.id}, ${escape(u.email)}, ${escape(u.password)}, ${escape(u.name)}, ${escape(u.role)}, ${u.companyId || 'NULL'}, ${u.areaId || 'NULL'})`
      ).join(',\n');
      sql += `\nON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  email = EXCLUDED.email,\n`;
      sql += `  name = EXCLUDED.name,\n`;
      sql += `  role = EXCLUDED.role,\n`;
      sql += `  "companyId" = EXCLUDED."companyId",\n`;
      sql += `  "areaId" = EXCLUDED."areaId";\n\n`;
    }

    // KPIs
    if (kpisData.length > 0) {
      sql += `-- ========== KPIs ==========\n`;
      sql += `INSERT INTO kpis (id, name, description, "areaId", "companyId", unit, target, frequency, "calculationMethod", responsible, "invertedMetric") VALUES\n`;
      sql += kpisData.map(k => 
        `  (${k.id}, ${escape(k.name)}, ${escape(k.description)}, ${k.areaId}, ${k.companyId}, ${escape(k.unit)}, ${escape(k.target)}, ${escape(k.frequency)}, ${escape(k.calculationMethod)}, ${escape(k.responsible)}, ${k.invertedMetric})`
      ).join(',\n');
      sql += `\nON CONFLICT (id) DO UPDATE SET\n`;
      sql += `  name = EXCLUDED.name,\n`;
      sql += `  description = EXCLUDED.description,\n`;
      sql += `  "areaId" = EXCLUDED."areaId",\n`;
      sql += `  "companyId" = EXCLUDED."companyId",\n`;
      sql += `  unit = EXCLUDED.unit,\n`;
      sql += `  target = EXCLUDED.target,\n`;
      sql += `  frequency = EXCLUDED.frequency,\n`;
      sql += `  "calculationMethod" = EXCLUDED."calculationMethod",\n`;
      sql += `  responsible = EXCLUDED.responsible,\n`;
      sql += `  "invertedMetric" = EXCLUDED."invertedMetric";\n\n`;
    }

    // Guardar archivo
    const filename = 'scripts/production-migration.sql';
    writeFileSync(filename, sql);
    
    console.log(`✅ Archivo SQL generado: ${filename}`);
    console.log(`\n📋 Próximos pasos:`);
    console.log(`   1. Abre la pestaña "Database" en Replit`);
    console.log(`   2. Cambia a "Production Database"`);
    console.log(`   3. Ejecuta: npm run db:push`);
    console.log(`   4. En la consola SQL de production, copia y pega el contenido de ${filename}`);
    console.log(`   5. Ejecuta el SQL`);
    console.log(`   6. Republica la aplicación\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

function escape(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'number') return value.toString();
  // Escapar comillas simples
  return `'${String(value).replace(/'/g, "''")}'`;
}

exportDevData();

#!/usr/bin/env tsx
// Script para migrar todos los datos de Development a Production
import { neon } from '@neondatabase/serverless';

// Este script debe ejecutarse CON LA DATABASE_URL DE PRODUCCIÓN
async function migrateToProduction() {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL no encontrada');
    process.exit(1);
  }

  console.log('🚀 Iniciando migración a producción...');
  console.log(`📊 Conectando a: ${dbUrl.substring(0, 30)}...`);
  
  const sql = neon(dbUrl);

  try {
    // 1. Verificar estado actual
    const companies = await sql`SELECT COUNT(*) as count FROM companies`;
    const areas = await sql`SELECT COUNT(*) as count FROM areas`;
    const kpis = await sql`SELECT COUNT(*) as count FROM kpis`;
    const users = await sql`SELECT COUNT(*) as count FROM users`;
    
    console.log('\n📊 Estado actual de la base de datos:');
    console.log(`   Companies: ${companies[0].count}`);
    console.log(`   Areas: ${areas[0].count}`);
    console.log(`   KPIs: ${kpis[0].count}`);
    console.log(`   Users: ${users[0].count}`);

    // 2. Insertar/actualizar companies
    console.log('\n📊 Insertando companies...');
    await sql`
      INSERT INTO companies (id, name, description, sector) VALUES
        (1, 'Dura International', 'Empresa líder en la industria química', 'Química'),
        (2, 'Grupo Orsega', 'Empresa especializada en productos químicos', 'Química')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        sector = EXCLUDED.sector
    `;

    // 3. Insertar/actualizar areas (todas las 12)
    console.log('🏢 Insertando areas...');
    await sql`
      INSERT INTO areas (id, name, description, "companyId") VALUES
        (1, 'Ventas', 'Área de Ventas para Dura International', 1),
        (2, 'Logística', 'Área de Logística para Dura International', 1),
        (3, 'Contabilidad y Finanzas', 'Área de Contabilidad y Finanzas para Dura International', 1),
        (4, 'Ventas', 'Área de Ventas para Grupo Orsega', 2),
        (5, 'Logística', 'Área de Logística para Grupo Orsega', 2),
        (6, 'Contabilidad y Finanzas', 'Área de Contabilidad y Finanzas para Grupo Orsega', 2),
        (7, 'Compras', 'Área de Compras para Dura International', 1),
        (8, 'Almacén', 'Área de Almacén para Dura International', 1),
        (9, 'Tesorería', 'Área de Tesorería para Dura International', 1),
        (10, 'Compras', 'Área de Compras para Grupo Orsega', 2),
        (11, 'Almacén', 'Área de Almacén para Grupo Orsega', 2),
        (12, 'Tesorería', 'Área de Tesorería para Grupo Orsega', 2)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        "companyId" = EXCLUDED."companyId"
    `;

    // 4. Insertar usuarios esenciales (admin y colaboradores)
    console.log('👥 Insertando usuarios...');
    await sql`
      INSERT INTO users (id, email, password, name, role, "companyId", "areaId") VALUES
        (23, 'daniel@econova.com.mx', '$2b$10$YourHashedPasswordHere', 'Daniel Martinez', 'admin', NULL, NULL),
        (2, 'omar@econova.com.mx', '$2b$10$YourHashedPasswordHere', 'Omar Navarro', 'collaborator', 2, 4),
        (3, 'mario@econova.com.mx', '$2b$10$YourHashedPasswordHere', 'Mario Reynoso', 'collaborator', 2, 6)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        "companyId" = EXCLUDED."companyId",
        "areaId" = EXCLUDED."areaId"
    `;

    // 5. Insertar TODOS los KPIs (necesitarás copiar todos de desarrollo)
    console.log('📈 Insertando KPIs...');
    
    // IMPORTANTE: Aquí van TODOS tus KPIs. Por ahora pongo los básicos
    // Necesitarás copiarlos todos de tu base de desarrollo
    await sql`
      INSERT INTO kpis (id, name, description, "areaId", "companyId", unit, target, frequency, "calculationMethod", responsible, "invertedMetric") VALUES
        -- KPIs de Grupo Orsega (Contabilidad)
        (2, 'Precisión en estados financieros', 'Mide la exactitud de los estados financieros generados', 6, 2, '%', '100%', 'monthly', 'Conteo de errores y salvedades', 'Mario Reynoso', false),
        (4, 'Velocidad de rotación de cuentas por cobrar', 'Mide el tiempo promedio para cobrar cuentas pendientes', 6, 2, 'días', '60 días', 'monthly', 'Promedio de días para cobrar', 'Mario Reynoso', true),
        (6, 'Cumplimiento de obligaciones fiscales', 'Monitoreo mediante checklist para la presentación de impuestos', 6, 2, '%', '100%', 'monthly', 'Checklist de obligaciones fiscales', 'Mario Reynoso', false),
        (8, 'Facturación sin errores', 'Mide la precisión en la generación de facturas', 6, 2, '%', '100%', 'weekly', '(Facturas sin errores / Total de facturas) x 100', 'Mario Reynoso', false),
        
        -- KPIs de Grupo Orsega (Ventas)
        (10, 'Volumen de ventas alcanzado', 'Volumen de ventas en unidades', 4, 2, 'unidades', '10.300.476 unidades', 'monthly', 'Suma de unidades vendidas en el período', 'Omar Navarro', false),
        
        -- KPIs de Dura International (Ventas)
        (1, 'Volumen de ventas alcanzado', 'Volumen de ventas en KG', 1, 1, 'KG', '800.097 KG', 'monthly', 'Suma de kilogramos vendidos en el período', 'Responsable Dura', false)
        
        -- NOTA: Aquí debes agregar TODOS los demás KPIs de tu sistema
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        "areaId" = EXCLUDED."areaId",
        "companyId" = EXCLUDED."companyId",
        unit = EXCLUDED.unit,
        target = EXCLUDED.target,
        frequency = EXCLUDED.frequency,
        "calculationMethod" = EXCLUDED."calculationMethod",
        responsible = EXCLUDED.responsible,
        "invertedMetric" = EXCLUDED."invertedMetric"
    `;

    // 6. Verificar resultado final
    const finalCompanies = await sql`SELECT COUNT(*) as count FROM companies`;
    const finalAreas = await sql`SELECT COUNT(*) as count FROM areas`;
    const finalKpis = await sql`SELECT COUNT(*) as count FROM kpis`;
    const finalUsers = await sql`SELECT COUNT(*) as count FROM users`;
    
    console.log('\n✅ Migración completada exitosamente!');
    console.log('📊 Estado final:');
    console.log(`   Companies: ${finalCompanies[0].count}`);
    console.log(`   Areas: ${finalAreas[0].count}`);
    console.log(`   KPIs: ${finalKpis[0].count}`);
    console.log(`   Users: ${finalUsers[0].count}`);

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

migrateToProduction();

#!/usr/bin/env node

import { config } from 'dotenv';
config();
import { neon } from '@neondatabase/serverless';

// Conexiones a ambas bases de datos
const devSql = neon('postgresql://neondb_owner:npg_yMZhRJg9tOE3@ep-holy-truth-aeyenoh1.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require');
const prodSql = neon(process.env.DATABASE_URL);

console.log('🚀 Iniciando migración simple de datos...');

async function migrateData() {
  try {
    console.log('\n=== PASO 1: Verificando conexiones ===');
    
    // Verificar conexión a desarrollo
    const devTest = await devSql`SELECT 1 as test`;
    console.log('✅ Conexión a desarrollo: OK');
    
    // Verificar conexión a producción
    const prodTest = await prodSql`SELECT 1 as test`;
    console.log('✅ Conexión a producción: OK');
    
    console.log('\n=== PASO 2: Migrando áreas ===');
    const devAreas = await devSql`SELECT * FROM areas ORDER BY id`;
    let areasMigrated = 0;
    
    for (const area of devAreas) {
      try {
        const existing = await prodSql`SELECT id FROM areas WHERE id = ${area.id}`;
        if (existing.length === 0) {
          await prodSql`INSERT INTO areas (id, name, description) VALUES (${area.id}, ${area.name}, ${area.description})`;
          areasMigrated++;
        }
      } catch (error) {
        console.log(`⚠️ Error migrando área ${area.name}:`, error.message);
      }
    }
    console.log(`✅ Áreas migradas: ${areasMigrated}`);
    
    console.log('\n=== PASO 3: Migrando empresas ===');
    const devCompanies = await devSql`SELECT * FROM companies ORDER BY id`;
    let companiesMigrated = 0;
    
    for (const company of devCompanies) {
      try {
        const existing = await prodSql`SELECT id FROM companies WHERE id = ${company.id}`;
        if (existing.length === 0) {
          await prodSql`INSERT INTO companies (id, name, description, is_active, created_at, updated_at) VALUES (${company.id}, ${company.name}, ${company.description}, ${company.is_active}, ${company.created_at}, ${company.updated_at})`;
          companiesMigrated++;
        }
      } catch (error) {
        console.log(`⚠️ Error migrando empresa ${company.name}:`, error.message);
      }
    }
    console.log(`✅ Empresas migradas: ${companiesMigrated}`);
    
    console.log('\n=== PASO 4: Migrando usuarios ===');
    const devUsers = await devSql`SELECT * FROM users ORDER BY id`;
    let usersMigrated = 0;
    
    for (const user of devUsers) {
      try {
        const existing = await prodSql`SELECT id FROM users WHERE id = ${user.id}`;
        if (existing.length === 0) {
          await prodSql`INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES (${user.id}, ${user.name}, ${user.email}, ${user.password_hash}, ${user.role}, ${user.is_active}, ${user.created_at}, ${user.updated_at})`;
          usersMigrated++;
        }
      } catch (error) {
        console.log(`⚠️ Error migrando usuario ${user.name}:`, error.message);
      }
    }
    console.log(`✅ Usuarios migrados: ${usersMigrated}`);
    
    console.log('\n=== PASO 5: Migrando KPIs ===');
    const devKpis = await devSql`SELECT * FROM kpis ORDER BY id`;
    let kpisMigrated = 0;
    
    for (const kpi of devKpis) {
      try {
        const existing = await prodSql`SELECT id FROM kpis WHERE id = ${kpi.id}`;
        if (existing.length === 0) {
          await prodSql`INSERT INTO kpis (
            id, name, description, area_id, company_id, unit, target, frequency,
            calculation_method, responsible, inverted_metric,
            kpi_definition, business_perspectives, measurement_approach, trend_analysis,
            diagnostic_questions, visualization_suggestions, risk_alerts,
            practical_recommendations, integration_points, tools_technologies, impact_of_change
          ) VALUES (
            ${kpi.id}, ${kpi.name}, ${kpi.description}, ${kpi.area_id}, ${kpi.company_id},
            ${kpi.unit}, ${kpi.target}, ${kpi.frequency}, ${kpi.calculation_method},
            ${kpi.responsible}, ${kpi.inverted_metric},
            ${kpi.kpi_definition}, ${kpi.business_perspectives}, ${kpi.measurement_approach},
            ${kpi.trend_analysis}, ${kpi.diagnostic_questions}, ${kpi.visualization_suggestions},
            ${kpi.risk_alerts}, ${kpi.practical_recommendations}, ${kpi.integration_points},
            ${kpi.tools_technologies}, ${kpi.impact_of_change}
          )`;
          kpisMigrated++;
        }
      } catch (error) {
        console.log(`⚠️ Error migrando KPI ${kpi.name}:`, error.message);
      }
    }
    console.log(`✅ KPIs migrados: ${kpisMigrated}`);
    
    console.log('\n=== PASO 6: Migrando valores de KPI ===');
    const devKpiValues = await devSql`SELECT * FROM kpi_values ORDER BY id`;
    let kpiValuesMigrated = 0;
    
    for (const kpiValue of devKpiValues) {
      try {
        const existing = await prodSql`SELECT id FROM kpi_values WHERE id = ${kpiValue.id}`;
        if (existing.length === 0) {
          await prodSql`INSERT INTO kpi_values (
            id, kpi_id, user_id, value, date, period, compliance_percentage, status, comments, updated_by
          ) VALUES (
            ${kpiValue.id}, ${kpiValue.kpi_id}, ${kpiValue.user_id}, ${kpiValue.value},
            ${kpiValue.date}, ${kpiValue.period}, ${kpiValue.compliance_percentage},
            ${kpiValue.status}, ${kpiValue.comments}, ${kpiValue.updated_by}
          )`;
          kpiValuesMigrated++;
        }
      } catch (error) {
        console.log(`⚠️ Error migrando valor de KPI:`, error.message);
      }
    }
    console.log(`✅ Valores de KPI migrados: ${kpiValuesMigrated}`);
    
    console.log('\n=== PASO 7: Migrando proveedores ===');
    const devProviders = await devSql`SELECT * FROM provider WHERE is_active = TRUE ORDER BY created_at`;
    let providersMigrated = 0;
    
    for (const provider of devProviders) {
      try {
        const existing = await prodSql`SELECT id FROM provider WHERE id = ${provider.id}`;
        if (existing.length === 0) {
          await prodSql`INSERT INTO provider (
            id, name, email, phone, contact_name, notes, rating, is_active,
            short_name, company_id, location, requires_rep, rep_frequency, reminder_email,
            created_at, updated_at
          ) VALUES (
            ${provider.id}, ${provider.name}, ${provider.email}, ${provider.phone},
            ${provider.contact_name}, ${provider.notes}, ${provider.rating}, ${provider.is_active},
            ${provider.short_name}, ${provider.company_id}, ${provider.location},
            ${provider.requires_rep}, ${provider.rep_frequency}, ${provider.reminder_email},
            ${provider.created_at}, ${provider.updated_at}
          )`;
          providersMigrated++;
        }
      } catch (error) {
        console.log(`⚠️ Error migrando proveedor ${provider.name}:`, error.message);
      }
    }
    console.log(`✅ Proveedores migrados: ${providersMigrated}`);
    
    console.log('\n=== PASO 8: Migrando productos ===');
    const devProducts = await devSql`SELECT * FROM products WHERE is_active = TRUE ORDER BY id`;
    let productsMigrated = 0;
    
    for (const product of devProducts) {
      try {
        const existing = await prodSql`SELECT id FROM products WHERE id = ${product.id}`;
        if (existing.length === 0) {
          await prodSql`INSERT INTO products (id, name, company_id, is_active, created_at, updated_at) VALUES (${product.id}, ${product.name}, ${product.company_id}, ${product.is_active}, ${product.created_at}, ${product.updated_at})`;
          productsMigrated++;
        }
      } catch (error) {
        console.log(`⚠️ Error migrando producto ${product.name}:`, error.message);
      }
    }
    console.log(`✅ Productos migrados: ${productsMigrated}`);
    
    console.log('\n=== PASO 9: Migrando tipos de cambio ===');
    const devExchangeRates = await devSql`SELECT * FROM exchange_rates ORDER BY created_at DESC LIMIT 10`;
    let exchangeRatesMigrated = 0;
    
    for (const rate of devExchangeRates) {
      try {
        const existing = await prodSql`SELECT id FROM exchange_rates WHERE id = ${rate.id}`;
        if (existing.length === 0) {
          await prodSql`INSERT INTO exchange_rates (id, date, buy_rate, sell_rate, source, notes, created_by) VALUES (${rate.id}, ${rate.date}, ${rate.buy_rate}, ${rate.sell_rate}, ${rate.source}, ${rate.notes}, ${rate.created_by})`;
          exchangeRatesMigrated++;
        }
      } catch (error) {
        console.log(`⚠️ Error migrando tipo de cambio:`, error.message);
      }
    }
    console.log(`✅ Tipos de cambio migrados: ${exchangeRatesMigrated}`);
    
    console.log('\n🎉 ¡Migración completada exitosamente!');
    console.log('📊 Resumen completo:');
    console.log(`   - Áreas migradas: ${areasMigrated}`);
    console.log(`   - Empresas migradas: ${companiesMigrated}`);
    console.log(`   - Usuarios migrados: ${usersMigrated}`);
    console.log(`   - KPIs migrados: ${kpisMigrated}`);
    console.log(`   - Valores de KPI migrados: ${kpiValuesMigrated}`);
    console.log(`   - Proveedores migrados: ${providersMigrated}`);
    console.log(`   - Productos migrados: ${productsMigrated}`);
    console.log(`   - Tipos de cambio migrados: ${exchangeRatesMigrated}`);
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

migrateData();





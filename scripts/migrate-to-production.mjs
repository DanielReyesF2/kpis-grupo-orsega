#!/usr/bin/env node

import { config } from 'dotenv';
config();
import { neon } from '@neondatabase/serverless';

// Conexiones a ambas bases de datos
const devSql = neon('postgresql://neondb_owner:npg_yMZhRJg9tOE3@ep-holy-truth-aeyenoh1.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require');
const prodSql = neon(process.env.DATABASE_URL);

console.log('🚀 Iniciando migración de desarrollo a producción...');
console.log('📊 Desarrollo:', 'ep-holy-truth-aeyenoh1');
console.log('🏭 Producción:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'N/A');

async function migrateData() {
  try {
    console.log('\n=== PASO 1: Verificando conexiones ===');
    
    // Verificar conexión a desarrollo
    const devTest = await devSql`SELECT 1 as test`;
    console.log('✅ Conexión a desarrollo: OK');
    
    // Verificar conexión a producción
    const prodTest = await prodSql`SELECT 1 as test`;
    console.log('✅ Conexión a producción: OK');
    
    console.log('\n=== PASO 2: Verificando datos en desarrollo ===');
    
    const devStats = await Promise.all([
      devSql`SELECT COUNT(*) as total FROM provider WHERE is_active = TRUE`,
      devSql`SELECT COUNT(*) as total FROM users`,
      devSql`SELECT COUNT(*) as total FROM companies`,
      devSql`SELECT COUNT(*) as total FROM kpis`,
      devSql`SELECT COUNT(*) as total FROM products WHERE is_active = TRUE`,
      devSql`SELECT COUNT(*) as total FROM areas`,
      devSql`SELECT COUNT(*) as total FROM kpi_values`,
      devSql`SELECT COUNT(*) as total FROM exchange_rates`
    ]);
    
    console.log('📦 Proveedores:', devStats[0][0].total);
    console.log('👥 Usuarios:', devStats[1][0].total);
    console.log('🏢 Empresas:', devStats[2][0].total);
    console.log('📈 KPIs:', devStats[3][0].total);
    console.log('📦 Productos:', devStats[4][0].total);
    console.log('🏗️ Áreas:', devStats[5][0].total);
    console.log('📊 Valores KPI:', devStats[6][0].total);
    console.log('💱 Tipos de cambio:', devStats[7][0].total);
    
    console.log('\n=== PASO 3: Verificando datos en producción ===');
    
    try {
      const prodStats = await Promise.all([
        prodSql`SELECT COUNT(*) as total FROM provider WHERE is_active = TRUE`,
        prodSql`SELECT COUNT(*) as total FROM products WHERE is_active = TRUE`,
        prodSql`SELECT COUNT(*) as total FROM kpis`,
        prodSql`SELECT COUNT(*) as total FROM areas`,
        prodSql`SELECT COUNT(*) as total FROM kpi_values`,
        prodSql`SELECT COUNT(*) as total FROM exchange_rates`
      ]);
      
      console.log('📦 Proveedores:', prodStats[0][0].total);
      console.log('📦 Productos:', prodStats[1][0].total);
      console.log('📈 KPIs:', prodStats[2][0].total);
      console.log('🏗️ Áreas:', prodStats[3][0].total);
      console.log('📊 Valores KPI:', prodStats[4][0].total);
      console.log('💱 Tipos de cambio:', prodStats[5][0].total);
    } catch (error) {
      console.log('⚠️ Algunas tablas no existen aún en producción, se crearán durante la migración');
    }
    
    console.log('\n=== PASO 4: Migrando datos críticos ===');
    
    // Migrar proveedores (solo los que no existen)
    console.log('📦 Migrando proveedores...');
    const devProviders = await devSql`
      SELECT * FROM provider 
      WHERE is_active = TRUE 
      ORDER BY created_at
    `;
    
    let providersMigrated = 0;
    for (const provider of devProviders) {
      try {
        // Verificar si ya existe
        const existing = await prodSql`
          SELECT id FROM provider WHERE name = $1 AND company_id = $2
        `;
        
        if (existing.length === 0) {
          await prodSql`
            INSERT INTO provider (
              id, name, email, phone, contact_name, notes, rating, is_active,
              short_name, company_id, location, requires_rep, rep_frequency, 
              reminder_email, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
            )
          `, [
            provider.id, provider.name, provider.email, provider.phone,
            provider.contact_name, provider.notes, provider.rating, provider.is_active,
            provider.short_name, provider.company_id, provider.location,
            provider.requires_rep, provider.rep_frequency, provider.reminder_email,
            provider.created_at, provider.updated_at
          ];
          providersMigrated++;
        }
      } catch (error) {
        console.log(`⚠️ Error migrando proveedor ${provider.name}:`, error.message);
      }
    }
    console.log(`✅ Proveedores migrados: ${providersMigrated}`);
    
    // Migrar productos
    console.log('📦 Migrando productos...');
    const devProducts = await devSql`
      SELECT * FROM products 
      WHERE is_active = TRUE 
      ORDER BY created_at
    `;
    
    let productsMigrated = 0;
    for (const product of devProducts) {
      try {
        const existing = await prodSql`
          SELECT id FROM products WHERE name = $1 AND company_id = $2
        `;
        
        if (existing.length === 0) {
          await prodSql`
            INSERT INTO products (id, name, company_id, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [product.id, product.name, product.company_id, product.is_active, product.created_at, product.updated_at];
          productsMigrated++;
        }
      } catch (error) {
        console.log(`⚠️ Error migrando producto ${product.name}:`, error.message);
      }
    }
    console.log(`✅ Productos migrados: ${productsMigrated}`);
    
    // Migrar tipos de cambio recientes
    console.log('💱 Migrando tipos de cambio...');
    const devExchangeRates = await devSql`
      SELECT * FROM exchange_rates 
      WHERE created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
    `;
    
    let exchangeRatesMigrated = 0;
    for (const rate of devExchangeRates) {
      try {
        const existing = await prodSql`
          SELECT id FROM exchange_rates 
          WHERE source = $1 AND DATE(created_at) = DATE($2)
        `;
        
        if (existing.length === 0) {
          await prodSql`
            INSERT INTO exchange_rates (id, date, buy_rate, sell_rate, source, notes, created_by, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [rate.id, rate.date, rate.buy_rate, rate.sell_rate, rate.source, rate.notes, rate.created_by, rate.created_at];
          exchangeRatesMigrated++;
        }
      } catch (error) {
        console.log(`⚠️ Error migrando tipo de cambio:`, error.message);
      }
    }
    console.log(`✅ Tipos de cambio migrados: ${exchangeRatesMigrated}`);
    
    // Migrar KPIs
    console.log('📈 Migrando KPIs...');
    const devKpis = await devSql`
      SELECT * FROM kpis 
      ORDER BY id
    `;
    
    let kpisMigrated = 0;
    for (const kpi of devKpis) {
      try {
        const existing = await prodSql`
          SELECT id FROM kpis WHERE id = $1
        `;
        
        if (existing.length === 0) {
          await prodSql`
            INSERT INTO kpis (
              id, name, description, area_id, company_id, unit, target, frequency,
              calculation_method, responsible, inverted_metric,
              kpi_definition, business_perspectives, measurement_approach, trend_analysis,
              diagnostic_questions, visualization_suggestions, risk_alerts,
              practical_recommendations, integration_points, tools_technologies, impact_of_change
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          `, [
            kpi.id, kpi.name, kpi.description, kpi.area_id, kpi.company_id,
            kpi.unit, kpi.target, kpi.frequency, kpi.calculation_method,
            kpi.responsible, kpi.inverted_metric,
            kpi.kpi_definition, kpi.business_perspectives, kpi.measurement_approach,
            kpi.trend_analysis, kpi.diagnostic_questions, kpi.visualization_suggestions,
            kpi.risk_alerts, kpi.practical_recommendations, kpi.integration_points,
            kpi.tools_technologies, kpi.impact_of_change
          ];
          kpisMigrated++;
        }
      } catch (error) {
        console.log(`⚠️ Error migrando KPI ${kpi.name}:`, error.message);
      }
    }
    console.log(`✅ KPIs migrados: ${kpisMigrated}`);
    
    // Migrar valores de KPI
    console.log('📊 Migrando valores de KPI...');
    const devKpiValues = await devSql`
      SELECT * FROM kpi_values 
      ORDER BY created_at DESC
    `;
    
    let kpiValuesMigrated = 0;
    for (const kpiValue of devKpiValues) {
      try {
        const existing = await prodSql`
          SELECT id FROM kpi_values WHERE id = $1
        `;
        
        if (existing.length === 0) {
          await prodSql`
            INSERT INTO kpi_values (
              id, kpi_id, user_id, value, date, period, compliance_percentage, status, comments, updated_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `, [
            kpiValue.id, kpiValue.kpi_id, kpiValue.user_id, kpiValue.value,
            kpiValue.date, kpiValue.period, kpiValue.compliance_percentage,
            kpiValue.status, kpiValue.comments, kpiValue.updated_by, kpiValue.created_at
          ];
          kpiValuesMigrated++;
        }
      } catch (error) {
        console.log(`⚠️ Error migrando valor de KPI:`, error.message);
      }
    }
    console.log(`✅ Valores de KPI migrados: ${kpiValuesMigrated}`);
    
    // Migrar áreas
    console.log('🏗️ Migrando áreas...');
    const devAreas = await devSql`
      SELECT * FROM areas 
      ORDER BY id
    `;
    
    let areasMigrated = 0;
    for (const area of devAreas) {
      try {
        const existing = await prodSql`
          SELECT id FROM areas WHERE id = $1
        `;
        
        if (existing.length === 0) {
          await prodSql`
            INSERT INTO areas (id, name, description) VALUES ($1, $2, $3)
          `, [area.id, area.name, area.description];
          areasMigrated++;
        }
      } catch (error) {
        console.log(`⚠️ Error migrando área ${area.name}:`, error.message);
      }
    }
    console.log(`✅ Áreas migradas: ${areasMigrated}`);
    
    console.log('\n=== PASO 5: Verificación final ===');
    
    const finalProdStats = await Promise.all([
      prodSql`SELECT COUNT(*) as total FROM provider WHERE is_active = TRUE`,
      prodSql`SELECT COUNT(*) as total FROM products WHERE is_active = TRUE`,
      prodSql`SELECT COUNT(*) as total FROM exchange_rates`
    ]);
    
    const finalProdStatsExtended = await Promise.all([
      prodSql`SELECT COUNT(*) as total FROM kpis`,
      prodSql`SELECT COUNT(*) as total FROM kpi_values`,
      prodSql`SELECT COUNT(*) as total FROM areas`
    ]);
    
    console.log('📦 Proveedores en producción:', finalProdStats[0][0].total);
    console.log('📦 Productos en producción:', finalProdStats[1][0].total);
    console.log('💱 Tipos de cambio en producción:', finalProdStats[2][0].total);
    console.log('📈 KPIs en producción:', finalProdStatsExtended[0][0].total);
    console.log('📊 Valores de KPI en producción:', finalProdStatsExtended[1][0].total);
    console.log('🏗️ Áreas en producción:', finalProdStatsExtended[2][0].total);
    
    console.log('\n🎉 ¡Migración completada exitosamente!');
    console.log('📊 Resumen completo:');
    console.log(`   - Proveedores migrados: ${providersMigrated}`);
    console.log(`   - Productos migrados: ${productsMigrated}`);
    console.log(`   - Tipos de cambio migrados: ${exchangeRatesMigrated}`);
    console.log(`   - KPIs migrados: ${kpisMigrated}`);
    console.log(`   - Valores de KPI migrados: ${kpiValuesMigrated}`);
    console.log(`   - Áreas migradas: ${areasMigrated}`);
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

migrateData();

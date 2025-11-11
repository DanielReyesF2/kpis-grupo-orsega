import 'dotenv/config';
import { db } from '../server/db';
import { exchangeRates } from '../shared/schema';
import { sql } from 'drizzle-orm';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

/**
 * Script para agregar datos de ejemplo de MONEX y Santander
 * basados en datos DOF existentes para HOY y AYER
 * Esto es temporal hasta que Lolita comience a actualizarlos
 */
async function addMonexSantanderSampleData() {
  try {
    console.log('🔍 Buscando datos DOF de HOY y AYER...');
    
    const now = new Date();
    const today = startOfDay(now);
    const todayEnd = endOfDay(today);
    const yesterday = startOfDay(subDays(now, 1));
    const yesterdayEnd = endOfDay(yesterday);
    
    console.log(`📅 Rango: ${format(yesterday, 'yyyy-MM-dd')} hasta ${format(today, 'yyyy-MM-dd')}`);
    
    // Obtener datos DOF de hoy y ayer
    const dofResult = await db.execute(sql`
      SELECT id, source, date, buy_rate, sell_rate
      FROM exchange_rates
      WHERE source = 'DOF'
        AND (
          (date >= ${yesterday} AND date <= ${yesterdayEnd})
          OR (date >= ${today} AND date <= ${todayEnd})
        )
      ORDER BY date ASC
    `);
    
    const dofRates = dofResult.rows.map((row: any) => ({
      id: row.id,
      source: row.source,
      date: new Date(row.date),
      buyRate: parseFloat(row.buy_rate),
      sellRate: parseFloat(row.sell_rate)
    }));
    
    if (dofRates.length === 0) {
      console.log('❌ No se encontraron datos DOF para HOY y AYER');
      console.log('   Por favor, ejecuta primero el script fix-missing-dof-data.ts');
      process.exit(1);
      return;
    }
    
    console.log(`✅ Se encontraron ${dofRates.length} registros DOF`);
    
    let monexAdded = 0;
    let santanderAdded = 0;
    let monexSkipped = 0;
    let santanderSkipped = 0;
    
    // Para cada registro DOF, crear datos de MONEX y Santander
    for (const dofRate of dofRates) {
      const baseRate = dofRate.buyRate; // DOF usa el mismo valor para compra y venta
      
      // MONEX: spread típico ~0.10-0.15
      // Compra: ligeramente menor que DOF (~0.02 menos)
      // Venta: ligeramente mayor que DOF (~0.12 más)
      const monexBuy = Number((baseRate - 0.02).toFixed(4));
      const monexSell = Number((baseRate + 0.12).toFixed(4));
      
      // Santander: spread típico ~0.15-0.20
      // Compra: ligeramente menor que DOF (~0.03 menos)
      // Venta: ligeramente mayor que DOF (~0.17 más)
      const santanderBuy = Number((baseRate - 0.03).toFixed(4));
      const santanderSell = Number((baseRate + 0.17).toFixed(4));
      
      // Verificar si ya existe MONEX para esta fecha
      const existingMonex = await db.execute(sql`
        SELECT id
        FROM exchange_rates
        WHERE source = 'MONEX'
          AND date >= ${startOfDay(dofRate.date)}
          AND date <= ${endOfDay(dofRate.date)}
        LIMIT 1
      `);
      
      if (existingMonex.rows.length === 0) {
        // Insertar MONEX
        await db.insert(exchangeRates).values({
          buyRate: monexBuy,
          sellRate: monexSell,
          source: 'MONEX',
          date: dofRate.date,
          notes: 'Datos de ejemplo basados en DOF (temporal - Lolita actualizará pronto)',
          createdBy: 23 // Usuario sistema
        });
        monexAdded++;
        console.log(`   ✅ MONEX agregado para ${format(dofRate.date, 'yyyy-MM-dd HH:mm')}: Compra ${monexBuy}, Venta ${monexSell}`);
      } else {
        monexSkipped++;
        console.log(`   ⏭️  MONEX ya existe para ${format(dofRate.date, 'yyyy-MM-dd HH:mm')}, omitido`);
      }
      
      // Verificar si ya existe Santander para esta fecha
      const existingSantander = await db.execute(sql`
        SELECT id
        FROM exchange_rates
        WHERE source = 'Santander'
          AND date >= ${startOfDay(dofRate.date)}
          AND date <= ${endOfDay(dofRate.date)}
        LIMIT 1
      `);
      
      if (existingSantander.rows.length === 0) {
        // Insertar Santander
        await db.insert(exchangeRates).values({
          buyRate: santanderBuy,
          sellRate: santanderSell,
          source: 'Santander',
          date: dofRate.date,
          notes: 'Datos de ejemplo basados en DOF (temporal - Lolita actualizará pronto)',
          createdBy: 23 // Usuario sistema
        });
        santanderAdded++;
        console.log(`   ✅ Santander agregado para ${format(dofRate.date, 'yyyy-MM-dd HH:mm')}: Compra ${santanderBuy}, Venta ${santanderSell}`);
      } else {
        santanderSkipped++;
        console.log(`   ⏭️  Santander ya existe para ${format(dofRate.date, 'yyyy-MM-dd HH:mm')}, omitido`);
      }
    }
    
    console.log('\n📊 RESUMEN:');
    console.log('=' .repeat(60));
    console.log(`   - Registros DOF encontrados: ${dofRates.length}`);
    console.log(`   - MONEX agregados: ${monexAdded}`);
    console.log(`   - MONEX omitidos (ya existían): ${monexSkipped}`);
    console.log(`   - Santander agregados: ${santanderAdded}`);
    console.log(`   - Santander omitidos (ya existían): ${santanderSkipped}`);
    console.log(`\n✅ Proceso completado. Los datos están listos para mostrar en las tarjetas.`);
    console.log(`   Nota: Estos son datos de ejemplo. Lolita actualizará los datos reales pronto.`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al agregar datos de MONEX y Santander:', error);
    process.exit(1);
  }
}

addMonexSantanderSampleData();



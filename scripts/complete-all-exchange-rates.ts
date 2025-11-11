import 'dotenv/config';
import { db } from '../server/db';
import { exchangeRates } from '../shared/schema';
import { sql } from 'drizzle-orm';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';

/**
 * Script para completar datos de MONEX y Santander para TODAS las actualizaciones
 * que tengan datos DOF. Agrupa por hora y asegura que cada hora con DOF tenga
 * MONEX y Santander.
 */
async function completeAllExchangeRates() {
  try {
    console.log('🔍 Buscando todas las horas con DOF que necesitan MONEX y Santander...');
    
    const now = new Date();
    const today = startOfDay(now);
    const todayEnd = endOfDay(today);
    const thirtyDaysAgo = startOfDay(subDays(now, 30));
    
    console.log(`📅 Rango: últimos 30 días (desde ${format(thirtyDaysAgo, 'yyyy-MM-dd')} hasta ${format(today, 'yyyy-MM-dd')})`);
    
    // Obtener todos los registros DOF
    const allDofResult = await db.execute(sql`
      SELECT id, source, date, buy_rate, sell_rate
      FROM exchange_rates
      WHERE source = 'DOF'
        AND date >= ${thirtyDaysAgo}
        AND date <= ${todayEnd}
      ORDER BY date ASC
    `);
    
    // Agrupar por hora y tomar el último valor de cada hora
    const dofByHour = new Map<string, {
      hour: Date;
      buyRate: number;
      sellRate: number;
      date: Date;
    }>();
    
    allDofResult.rows.forEach((row: any) => {
      const date = new Date(row.date);
      const hourStart = new Date(date);
      hourStart.setMinutes(0, 0, 0);
      const hourKey = hourStart.toISOString();
      
      // Si no existe o si esta fecha es más reciente, actualizar
      if (!dofByHour.has(hourKey) || date > dofByHour.get(hourKey)!.date) {
        dofByHour.set(hourKey, {
          hour: hourStart,
          buyRate: parseFloat(row.buy_rate),
          sellRate: parseFloat(row.sell_rate),
          date: date
        });
      }
    });
    
    const dofHours = Array.from(dofByHour.values());
    
    if (dofHours.length === 0) {
      console.log('❌ No se encontraron horas con DOF');
      process.exit(1);
      return;
    }
    
    console.log(`✅ Se encontraron ${dofHours.length} horas únicas con DOF`);
    
    let monexAdded = 0;
    let santanderAdded = 0;
    let monexSkipped = 0;
    let santanderSkipped = 0;
    let monexErrors = 0;
    let santanderErrors = 0;
    
    // Para cada hora con DOF, asegurar que existan MONEX y Santander
    for (const dofHour of dofHours) {
      const baseRate = dofHour.buyRate; // DOF usa el mismo valor para compra y venta
      
      // MONEX: spread típico ~0.10-0.15
      const monexBuy = Number((baseRate - 0.02).toFixed(4));
      const monexSell = Number((baseRate + 0.12).toFixed(4));
      
      // Santander: spread típico ~0.15-0.20
      const santanderBuy = Number((baseRate - 0.03).toFixed(4));
      const santanderSell = Number((baseRate + 0.17).toFixed(4));
      
      // Usar la hora exacta (inicio de la hora) - normalizar a UTC
      const hourStart = new Date(dofHour.hour);
      hourStart.setMinutes(0, 0, 0);
      hourStart.setSeconds(0, 0);
      
      // Verificar si ya existe MONEX para esta hora (usando DATE_TRUNC en SQL)
      const monexCheck = await db.execute(sql`
        SELECT id
        FROM exchange_rates
        WHERE source = 'MONEX'
          AND DATE_TRUNC('hour', date) = DATE_TRUNC('hour', ${hourStart}::timestamp)
        LIMIT 1
      `);
      
      if (monexCheck.rows.length === 0) {
        try {
          // Insertar MONEX con la hora exacta (usar la misma hora que DOF)
          await db.insert(exchangeRates).values({
            buyRate: monexBuy,
            sellRate: monexSell,
            source: 'MONEX',
            date: hourStart,
            notes: 'Datos de ejemplo basados en DOF (temporal - Lolita actualizará pronto)',
            createdBy: 23 // Usuario sistema
          });
          monexAdded++;
          if (monexAdded <= 5 || monexAdded % 10 === 0) {
            console.log(`   ✅ MONEX agregado para ${format(hourStart, 'yyyy-MM-dd HH:mm')}: Compra ${monexBuy}, Venta ${monexSell}`);
          }
        } catch (error: any) {
          if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
            monexSkipped++;
          } else {
            console.error(`   ❌ Error al insertar MONEX para ${format(hourStart, 'yyyy-MM-dd HH:mm')}:`, error.message);
            monexErrors++;
          }
        }
      } else {
        monexSkipped++;
      }
      
      // Verificar si ya existe Santander para esta hora (usando DATE_TRUNC en SQL)
      const santanderCheck = await db.execute(sql`
        SELECT id
        FROM exchange_rates
        WHERE source = 'Santander'
          AND DATE_TRUNC('hour', date) = DATE_TRUNC('hour', ${hourStart}::timestamp)
        LIMIT 1
      `);
      
      if (santanderCheck.rows.length === 0) {
        try {
          // Insertar Santander con la hora exacta (usar la misma hora que DOF)
          await db.insert(exchangeRates).values({
            buyRate: santanderBuy,
            sellRate: santanderSell,
            source: 'Santander',
            date: hourStart,
            notes: 'Datos de ejemplo basados en DOF (temporal - Lolita actualizará pronto)',
            createdBy: 23 // Usuario sistema
          });
          santanderAdded++;
          if (santanderAdded <= 5 || santanderAdded % 10 === 0) {
            console.log(`   ✅ Santander agregado para ${format(hourStart, 'yyyy-MM-dd HH:mm')}: Compra ${santanderBuy}, Venta ${santanderSell}`);
          }
        } catch (error: any) {
          if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
            santanderSkipped++;
          } else {
            console.error(`   ❌ Error al insertar Santander para ${format(hourStart, 'yyyy-MM-dd HH:mm')}:`, error.message);
            santanderErrors++;
          }
        }
      } else {
        santanderSkipped++;
      }
    }
    
    console.log('\n📊 RESUMEN:');
    console.log('=' .repeat(60));
    console.log(`   - Horas con DOF procesadas: ${dofHours.length}`);
    console.log(`   - MONEX agregados: ${monexAdded}`);
    console.log(`   - MONEX omitidos (ya existían): ${monexSkipped}`);
    console.log(`   - MONEX errores: ${monexErrors}`);
    console.log(`   - Santander agregados: ${santanderAdded}`);
    console.log(`   - Santander omitidos (ya existían): ${santanderSkipped}`);
    console.log(`   - Santander errores: ${santanderErrors}`);
    console.log(`\n✅ Proceso completado.`);
    console.log(`   Nota: Estos son datos de ejemplo. Lolita actualizará los datos reales pronto.`);
    
    // Verificar resultados finales - verificar cobertura por hora
    console.log('\n🔍 Verificación final:');
    const verificationResult = await db.execute(sql`
      SELECT 
        source,
        COUNT(*) as count,
        MIN(date) as min_date,
        MAX(date) as max_date
      FROM exchange_rates
      WHERE source IN ('DOF', 'MONEX', 'Santander')
        AND date >= ${thirtyDaysAgo}
        AND date <= ${todayEnd}
      GROUP BY source
      ORDER BY source
    `);
    
    console.log('   Registros por fuente:');
    verificationResult.rows.forEach((row: any) => {
      console.log(`   - ${row.source}: ${row.count} registros (${format(new Date(row.min_date), 'yyyy-MM-dd HH:mm')} - ${format(new Date(row.max_date), 'yyyy-MM-dd HH:mm')})`);
    });
    
    // Verificar cobertura por hora - horas completas
    const coverageCheck = await db.execute(sql`
      WITH dof_hours AS (
        SELECT DISTINCT 
          DATE_TRUNC('hour', date) as hour
        FROM exchange_rates
        WHERE source = 'DOF'
          AND date >= ${thirtyDaysAgo}
          AND date <= ${todayEnd}
      ),
      monex_hours AS (
        SELECT DISTINCT 
          DATE_TRUNC('hour', date) as hour
        FROM exchange_rates
        WHERE source = 'MONEX'
          AND date >= ${thirtyDaysAgo}
          AND date <= ${todayEnd}
      ),
      santander_hours AS (
        SELECT DISTINCT 
          DATE_TRUNC('hour', date) as hour
        FROM exchange_rates
        WHERE source = 'Santander'
          AND date >= ${thirtyDaysAgo}
          AND date <= ${todayEnd}
      )
      SELECT 
        COUNT(DISTINCT dh.hour) as dof_hours,
        COUNT(DISTINCT mh.hour) as monex_hours,
        COUNT(DISTINCT sh.hour) as santander_hours,
        COUNT(DISTINCT CASE WHEN mh.hour IS NOT NULL AND sh.hour IS NOT NULL THEN dh.hour END) as complete_hours
      FROM dof_hours dh
      LEFT JOIN monex_hours mh ON mh.hour = dh.hour
      LEFT JOIN santander_hours sh ON sh.hour = dh.hour
    `);
    
    if (coverageCheck.rows.length > 0) {
      const coverage = coverageCheck.rows[0];
      console.log('\n   Cobertura por hora:');
      console.log(`   - Horas con DOF: ${coverage.dof_hours}`);
      console.log(`   - Horas con MONEX: ${coverage.monex_hours}`);
      console.log(`   - Horas con Santander: ${coverage.santander_hours}`);
      console.log(`   - Horas completas (las 3 fuentes): ${coverage.complete_hours} de ${coverage.dof_hours} (${coverage.dof_hours > 0 ? Math.round((coverage.complete_hours / coverage.dof_hours) * 100) : 0}%)`);
      
      if (coverage.complete_hours < coverage.dof_hours) {
        console.log(`\n   ⚠️  Aún faltan ${coverage.dof_hours - coverage.complete_hours} horas para completar todas las actualizaciones.`);
        console.log(`   Ejecuta este script nuevamente para completar las horas faltantes.`);
      } else {
        console.log(`\n   ✅ Todas las horas con DOF tienen MONEX y Santander.`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al completar datos de tipos de cambio:', error);
    process.exit(1);
  }
}

completeAllExchangeRates();

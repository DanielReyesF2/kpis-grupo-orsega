import 'dotenv/config';
import { db } from '../server/db';
import { exchangeRates } from '../shared/schema';
import { sql } from 'drizzle-orm';
import { subDays, format, startOfDay, endOfDay } from 'date-fns';

/**
 * Script para verificar datos DOF de los últimos 7 días
 * Identifica días faltantes y datos futuros
 */
async function verifyDofData() {
  try {
    console.log('🔍 Verificando datos DOF de los últimos 7 días...');
    
    const now = new Date();
    const today = startOfDay(now);
    const todayEnd = endOfDay(today);
    const sevenDaysAgo = startOfDay(subDays(now, 7));
    
    console.log(`📅 Rango de verificación: ${format(sevenDaysAgo, 'yyyy-MM-dd')} hasta ${format(today, 'yyyy-MM-dd')}`);
    
    // Obtener todos los registros DOF de los últimos 7 días usando SQL
    const result = await db.execute(sql`
      SELECT id, source, date, buy_rate, sell_rate
      FROM exchange_rates
      WHERE source = 'DOF'
        AND date >= ${sevenDaysAgo}
        AND date <= ${todayEnd}
      ORDER BY date ASC
    `);
    
    const dofRates = result.rows.map((row: any) => ({
      id: row.id,
      source: row.source,
      date: new Date(row.date),
      buyRate: row.buy_rate,
      sellRate: row.sell_rate
    }));
    
    // Agrupar por día
    const ratesByDay = new Map<string, any[]>();
    dofRates.forEach(rate => {
      const dayKey = format(new Date(rate.date), 'yyyy-MM-dd');
      if (!ratesByDay.has(dayKey)) {
        ratesByDay.set(dayKey, []);
      }
      ratesByDay.get(dayKey)!.push(rate);
    });
    
    // Verificar días faltantes y datos futuros
    const missingDays: string[] = [];
    const futureDates: any[] = [];
    
    // Generar lista de días esperados
    for (let i = 0; i <= 7; i++) {
      const day = startOfDay(subDays(now, i));
      const dayKey = format(day, 'yyyy-MM-dd');
      
      // Verificar si es futuro
      if (day > today) {
        const futureRates = dofRates.filter(rate => {
          const rateDay = startOfDay(new Date(rate.date));
          return rateDay.getTime() === day.getTime();
        });
        if (futureRates.length > 0) {
          futureDates.push(...futureRates.map(rate => ({
            id: rate.id,
            date: rate.date,
            buyRate: rate.buyRate,
            sellRate: rate.sellRate
          })));
        }
      } else {
        // Verificar si falta el día
        if (!ratesByDay.has(dayKey)) {
          missingDays.push(dayKey);
        }
      }
    }
    
    // Mostrar resultados
    console.log('\n📊 RESULTADOS DE VERIFICACIÓN:');
    console.log('=' .repeat(60));
    
    // Días con datos
    console.log(`\n✅ Días con datos (${ratesByDay.size} días):`);
    Array.from(ratesByDay.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .forEach(([day, rates]) => {
        console.log(`   - ${day}: ${rates.length} registro(s)`);
        rates.forEach(rate => {
          const rateDate = new Date(rate.date);
          console.log(`     • ID: ${rate.id}, Fecha: ${rateDate.toISOString()}, Compra: ${rate.buyRate}, Venta: ${rate.sellRate}`);
        });
      });
    
    // Días faltantes
    if (missingDays.length > 0) {
      console.log(`\n❌ Días faltantes (${missingDays.length} días):`);
      missingDays.sort().reverse().forEach(day => {
        console.log(`   - ${day}`);
      });
    } else {
      console.log(`\n✅ No hay días faltantes en los últimos 7 días`);
    }
    
    // Datos futuros
    if (futureDates.length > 0) {
      console.log(`\n⚠️  Datos futuros encontrados (${futureDates.length} registros):`);
      futureDates.forEach(rate => {
        const rateDate = new Date(rate.date);
        console.log(`   - ID: ${rate.id}, Fecha: ${rateDate.toISOString()}, Compra: ${rate.buyRate}, Venta: ${rate.sellRate}`);
      });
    } else {
      console.log(`\n✅ No se encontraron datos futuros`);
    }
    
    // Resumen
    console.log('\n📋 RESUMEN:');
    console.log('=' .repeat(60));
    console.log(`   - Días con datos: ${ratesByDay.size} / 8 días (últimos 7 días + hoy)`);
    console.log(`   - Días faltantes: ${missingDays.length}`);
    console.log(`   - Registros futuros: ${futureDates.length}`);
    console.log(`   - Total de registros DOF: ${dofRates.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al verificar datos DOF:', error);
    process.exit(1);
  }
}

verifyDofData();


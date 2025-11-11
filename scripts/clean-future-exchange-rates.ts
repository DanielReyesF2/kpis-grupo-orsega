import 'dotenv/config';
import { db } from '../server/db';
import { exchangeRates } from '../shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Script para limpiar datos futuros de la tabla exchange_rates
 * Elimina todos los registros con fecha posterior a HOY (zona horaria México)
 */
async function cleanFutureExchangeRates() {
  try {
    console.log('🔍 Iniciando limpieza de datos futuros de tipos de cambio...');
    
    // Obtener fecha actual del servidor y normalizar a inicio del día siguiente
    const now = new Date();
    const today = new Date(now);
    today.setHours(23, 59, 59, 999); // Fin del día de hoy
    
    // Obtener inicio del día siguiente (mañana a las 00:00:00)
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    console.log(`📅 Fecha actual: ${now.toISOString()}`);
    console.log(`📅 Eliminando registros con fecha > ${today.toISOString()}`);
    
    // Buscar registros futuros usando SQL directo para mejor control
    const futureRates = await db.execute(sql`
      SELECT id, source, date, buy_rate, sell_rate
      FROM exchange_rates
      WHERE date > ${today}
      ORDER BY date ASC
    `);
    
    if (futureRates.rows.length === 0) {
      console.log('✅ No se encontraron registros futuros para eliminar');
      process.exit(0);
      return;
    }
    
    console.log(`⚠️  Se encontraron ${futureRates.rows.length} registros futuros:`);
    futureRates.rows.forEach((rate: any) => {
      const rateDate = new Date(rate.date);
      console.log(`   - ID: ${rate.id}, Fuente: ${rate.source}, Fecha: ${rateDate.toISOString()}, Compra: ${rate.buy_rate}, Venta: ${rate.sell_rate}`);
    });
    
    // Eliminar registros futuros
    const result = await db.execute(sql`
      DELETE FROM exchange_rates
      WHERE date > ${today}
    `);
    
    console.log(`✅ Se eliminaron ${futureRates.rows.length} registros futuros`);
    console.log(`📊 Resumen:`);
    console.log(`   - Registros eliminados: ${futureRates.rows.length}`);
    const sources = [...new Set(futureRates.rows.map((r: any) => r.source))];
    console.log(`   - Fuentes afectadas: ${sources.join(', ')}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al limpiar datos futuros:', error);
    process.exit(1);
  }
}

cleanFutureExchangeRates();

import 'dotenv/config';
import { importBanxicoHistoricalData } from '../server/banxico-importer';
import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

/**
 * Script para importar datos DOF faltantes de los últimos 4 días
 * Solo importa si no existen y valida que no sean fechas futuras
 */
async function fixMissingDofData() {
  try {
    console.log('🔍 Buscando datos DOF faltantes de los últimos 4 días...');
    
    const now = new Date();
    const today = startOfDay(now);
    const todayEnd = endOfDay(today);
    const fourDaysAgo = startOfDay(subDays(now, 4));
    
    console.log(`📅 Rango de importación: ${format(fourDaysAgo, 'yyyy-MM-dd')} hasta ${format(today, 'yyyy-MM-dd')}`);
    
    // Verificar qué días tienen datos usando SQL
    const result = await db.execute(sql`
      SELECT id, source, date, buy_rate, sell_rate
      FROM exchange_rates
      WHERE source = 'DOF'
        AND date >= ${fourDaysAgo}
        AND date <= ${todayEnd}
      ORDER BY date ASC
    `);
    
    const existingRates = result.rows.map((row: any) => ({
      id: row.id,
      source: row.source,
      date: new Date(row.date),
      buyRate: row.buy_rate,
      sellRate: row.sell_rate
    }));
    
    // Agrupar por día
    const existingDays = new Set<string>();
    existingRates.forEach(rate => {
      const dayKey = format(new Date(rate.date), 'yyyy-MM-dd');
      existingDays.add(dayKey);
    });
    
    // Identificar días faltantes
    const missingDays: string[] = [];
    for (let i = 0; i <= 4; i++) {
      const day = startOfDay(subDays(now, i));
      const dayKey = format(day, 'yyyy-MM-dd');
      
      // Solo importar si no es futuro y no existe
      if (day <= today && !existingDays.has(dayKey)) {
        missingDays.push(dayKey);
      }
    }
    
    if (missingDays.length === 0) {
      console.log('✅ No hay días faltantes en los últimos 4 días');
      process.exit(0);
      return;
    }
    
    console.log(`\n📋 Días faltantes encontrados (${missingDays.length} días):`);
    missingDays.forEach(day => console.log(`   - ${day}`));
    
    // Calcular rango de fechas para importar
    const startDate = missingDays[missingDays.length - 1]; // Día más antiguo
    const endDate = missingDays[0]; // Día más reciente
    
    console.log(`\n📥 Importando datos DOF desde ${startDate} hasta ${endDate}...`);
    
    // Importar datos de Banxico
    const result = await importBanxicoHistoricalData(startDate, endDate);
    
    console.log(`\n✅ Importación completada:`);
    console.log(`   - Importados: ${result.imported}`);
    console.log(`   - Omitidos: ${result.skipped}`);
    console.log(`   - Total: ${result.total}`);
    
    // Verificar que no se importaron datos futuros usando SQL
    const importedResult = await db.execute(sql`
      SELECT id, source, date, buy_rate, sell_rate
      FROM exchange_rates
      WHERE source = 'DOF'
        AND date >= ${new Date(`${startDate}T00:00:00`)}
      ORDER BY date ASC
    `);
    
    const importedRates = importedResult.rows.map((row: any) => ({
      id: row.id,
      source: row.source,
      date: new Date(row.date),
      buyRate: row.buy_rate,
      sellRate: row.sell_rate
    }));
    
    const futureRates = importedRates.filter(rate => {
      const rateDate = startOfDay(new Date(rate.date));
      return rateDate > today;
    });
    
    if (futureRates.length > 0) {
      console.warn(`\n⚠️  Advertencia: Se encontraron ${futureRates.length} registros futuros después de la importación:`);
      futureRates.forEach(rate => {
        console.warn(`   - ID: ${rate.id}, Fecha: ${rate.date.toISOString()}`);
      });
      console.warn(`   Por favor, ejecute el script clean-future-exchange-rates.ts para limpiarlos`);
    } else {
      console.log(`\n✅ No se importaron datos futuros`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al importar datos DOF faltantes:', error);
    process.exit(1);
  }
}

fixMissingDofData();


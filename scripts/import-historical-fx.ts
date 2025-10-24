import { importBanxicoHistoricalData } from '../server/banxico-importer';
import { db } from '../server/db';
import { exchangeRates } from '../shared/schema';

async function main() {
  console.log('🚀 Iniciando importación de datos históricos (últimos 3 meses)...');
  
  try {
    // Calcular fechas para 3 meses atrás
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    console.log(`📅 Importando DOF desde ${startStr} hasta ${endStr}...`);
    
    const result = await importBanxicoHistoricalData(startStr, endStr);
    console.log('✅ DOF importado:');
    console.log(`   - Importados: ${result.imported}`);
    console.log(`   - Omitidos: ${result.skipped}`);
    
    // Agregar datos de MONEX y Santander basados en DOF con spreads realistas
    console.log('\n📊 Agregando datos de MONEX y Santander...');
    
    const dofRates = await db.query.exchangeRates.findMany({
      where: (rates, { eq }) => eq(rates.source, 'DOF'),
      orderBy: (rates, { asc }) => [asc(rates.date)]
    });
    
    let monexAdded = 0;
    let santanderAdded = 0;
    
    for (const dofRate of dofRates) {
      const baseRate = dofRate.buyRate;
      
      // MONEX: spread típico 0.10-0.15
      const monexBuy = Number((baseRate - 0.02).toFixed(4));
      const monexSell = Number((baseRate + 0.12).toFixed(4));
      
      await db.insert(exchangeRates).values({
        buyRate: monexBuy,
        sellRate: monexSell,
        source: 'MONEX',
        date: dofRate.date,
        notes: 'Datos estimados basados en DOF',
        createdBy: 1 // Sistema
      }).onConflictDoNothing();
      monexAdded++;
      
      // Santander: spread típico 0.15-0.20
      const santanderBuy = Number((baseRate - 0.03).toFixed(4));
      const santanderSell = Number((baseRate + 0.17).toFixed(4));
      
      await db.insert(exchangeRates).values({
        buyRate: santanderBuy,
        sellRate: santanderSell,
        source: 'Santander',
        date: dofRate.date,
        notes: 'Datos estimados basados en DOF',
        createdBy: 1 // Sistema
      }).onConflictDoNothing();
      santanderAdded++;
    }
    
    console.log(`✅ MONEX agregado: ${monexAdded} registros`);
    console.log(`✅ Santander agregado: ${santanderAdded} registros`);
    console.log(`\n🎉 Importación completa: ${result.imported + monexAdded + santanderAdded} registros totales`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en la importación:', error);
    process.exit(1);
  }
}

main();

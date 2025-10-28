import { config } from 'dotenv';
config();

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function seedExchangeRates() {
  console.log('🔄 Iniciando seed de tipos de cambio iniciales...\n');

  try {
    // Datos iniciales basados en valores actuales del mercado
    const exchangeRates = [
      {
        source: 'Santander',
        buy_rate: 19.65,
        sell_rate: 21.35,
        date: new Date(),
      },
      {
        source: 'MONEX',
        buy_rate: 17.64,
        sell_rate: 19.50,
        date: new Date(),
      },
      {
        source: 'DOF',
        buy_rate: 18.3729,
        sell_rate: 18.4129,
        date: new Date(),
      },
    ];

    let insertedCount = 0;
    let skippedCount = 0;

    for (const rate of exchangeRates) {
      try {
        // Verificar si ya existe un registro para esta fuente hoy
        const existing = await sql`
          SELECT id 
          FROM exchange_rates 
          WHERE source = ${rate.source} 
            AND DATE(date) = DATE(${rate.date})
          LIMIT 1
        `;

        if (existing.length > 0) {
          console.log(`⏭️  Ya existe registro para ${rate.source} de hoy, omitiendo...`);
          skippedCount++;
          continue;
        }

        // Buscar un usuario admin o manager para usar como created_by
        const adminUser = await sql`
          SELECT id FROM users WHERE role IN ('admin', 'manager') LIMIT 1
        `;
        
        const createdBy = adminUser.length > 0 ? adminUser[0].id : 1; // Fallback a usuario ID 1

        // Insertar nuevo registro
        await sql`
          INSERT INTO exchange_rates (source, buy_rate, sell_rate, date, created_by)
          VALUES (${rate.source}, ${rate.buy_rate}, ${rate.sell_rate}, ${rate.date}, ${createdBy})
        `;

        console.log(`✅ Insertado: ${rate.source} | Compra: ${rate.buy_rate} | Venta: ${rate.sell_rate}`);
        insertedCount++;
      } catch (error) {
        console.error(`❌ Error insertando ${rate.source}:`, error.message);
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`   ✅ Insertados: ${insertedCount}`);
    console.log(`   ⏭️  Omitidos (ya existían): ${skippedCount}`);
    console.log(`   📦 Total procesados: ${exchangeRates.length}`);

    // Mostrar los tipos de cambio actuales en la base de datos
    console.log('\n📈 Tipos de cambio actuales en la base de datos:');
    const currentRates = await sql`
      SELECT source, buy_rate, sell_rate, date
      FROM exchange_rates
      WHERE DATE(date) = CURRENT_DATE
      ORDER BY source, date DESC
    `;

    if (currentRates.length > 0) {
      currentRates.forEach((rate) => {
        console.log(`   ${rate.source}: Compra ${rate.buy_rate} | Venta ${rate.sell_rate} | ${new Date(rate.date).toLocaleString('es-MX')}`);
      });
    } else {
      console.log('   ⚠️  No hay tipos de cambio para hoy');
    }

    console.log('\n✅ Seed completado exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante el seed:', error);
    process.exit(1);
  }
}

seedExchangeRates();


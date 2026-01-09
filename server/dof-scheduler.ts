import cron from 'node-cron';
import { db } from './db.js';
import { exchangeRates } from '../shared/schema.js';

const SYSTEM_USER_ID = 23;

export async function fetchDOFExchangeRate() {
  console.log('🔄 [DOF Scheduler] Obteniendo tipo de cambio del DOF...');

  const banxicoToken = process.env.BANXICO_TOKEN;
  if (!banxicoToken) {
    console.error('❌ [DOF Scheduler] BANXICO_TOKEN no configurado en variables de entorno');
    console.error('❌ [DOF Scheduler] No se puede obtener tipo de cambio sin token de Banxico');
    return;
  }

  try {
    const response = await fetch('https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos/oportuno', {
      headers: {
        'Bmx-Token': banxicoToken
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [DOF Scheduler] Error HTTP ${response.status}: ${errorText}`);
      console.error('❌ [DOF Scheduler] No se pudo obtener el tipo de cambio oficial de Banxico');
      console.error('❌ [DOF Scheduler] Verificar BANXICO_TOKEN y disponibilidad del API');
      // NO insertar valores estimados - solo usar datos oficiales de Banxico
      return;
    }

    const data = await response.json();

    if (!data?.bmx?.series?.[0]?.datos?.[0]?.dato) {
      console.error('❌ [DOF Scheduler] Estructura de respuesta de Banxico inesperada:', JSON.stringify(data));
      // NO insertar valores estimados - solo usar datos oficiales de Banxico
      return;
    }

    const latestRate = parseFloat(data.bmx.series[0].datos[0].dato);

    if (isNaN(latestRate)) {
      console.error('❌ [DOF Scheduler] Valor de tipo de cambio inválido:', data.bmx.series[0].datos[0].dato);
      // NO insertar valores estimados - solo usar datos oficiales de Banxico
      return;
    }

    // Verificar si ya hay un registro reciente (últimas 2 horas) para evitar duplicados
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

    const recentRate = await db.query.exchangeRates.findFirst({
      where: (rates, { and, eq, gte }) => and(
        eq(rates.source, 'DOF'),
        gte(rates.date, twoHoursAgo)
      ),
      orderBy: (rates, { desc }) => [desc(rates.date)]
    });

    if (recentRate && Math.abs(recentRate.buyRate - latestRate) < 0.0001) {
      console.log('ℹ️  [DOF Scheduler] El tipo de cambio no ha cambiado, no se insertará duplicado');
      return;
    }

    // Usar el valor DOF oficial EXACTO sin modificar - NO hay fallback ni varianza
    const buyRate = Number(latestRate.toFixed(4));
    const sellRate = Number(latestRate.toFixed(4));

    await db.insert(exchangeRates).values({
      buyRate,
      sellRate,
      source: 'DOF',
      notes: 'Tipo de cambio oficial DOF desde Banxico (Serie SF43718)',
      date: new Date(),
      createdBy: SYSTEM_USER_ID,
    });

    console.log(`✅ [DOF Scheduler] Tipo de cambio oficial insertado: $${buyRate} MXN/USD`);
  } catch (error) {
    console.error('❌ [DOF Scheduler] Error al obtener tipo de cambio:', error);
    console.error('❌ [DOF Scheduler] No se insertará ningún valor - solo datos oficiales de Banxico');
    // NO insertar valores estimados/fallback - solo usar datos oficiales de Banxico
  }
}

export function initializeDOFScheduler() {
  // Ejecutar inmediatamente al iniciar para tener datos desde el primer momento
  console.log('🚀 [DOF Scheduler] Ejecutando actualización inicial...');
  fetchDOFExchangeRate().catch(err => {
    console.error('❌ [DOF Scheduler] Error en actualización inicial:', err);
  });

  // El DOF publica el tipo de cambio una sola vez al día
  // Se ejecuta a las 9:00 AM hora de México (cuando ya está disponible el TC del día)
  // Nota: El TC que se publica es el que aplica para ese día
  cron.schedule('0 9 * * 1-5', async () => {
    console.log('⏰ [DOF Scheduler] Ejecutando actualización diaria de 9:00 AM (Hora de México)');
    await fetchDOFExchangeRate();
  }, {
    timezone: 'America/Mexico_City'
  });

  console.log('📅 [DOF Scheduler] Programador de tipo de cambio DOF inicializado');
  console.log('⏰ Actualización automática programada:');
  console.log('   - 9:00 AM (Hora de México) - Solo días hábiles (Lun-Vie)');
  console.log('✅ El scheduler está activo. El DOF publica un solo TC por día.');
}

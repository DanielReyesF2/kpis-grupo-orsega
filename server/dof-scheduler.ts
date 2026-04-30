import cron from 'node-cron';
import { db } from './db.js';
import { exchangeRates } from '../shared/schema.js';

const SYSTEM_USER_ID = 23;

/**
 * Calcula el siguiente día hábil (lunes a viernes) a partir de una fecha.
 * Si es viernes → lunes. Si es sábado → lunes. Domingo → lunes.
 */
function getNextBusinessDay(from: Date): Date {
  const next = new Date(from);
  const day = next.getDay(); // 0=dom, 5=vie, 6=sab
  if (day === 5) next.setDate(next.getDate() + 3);      // vie → lun
  else if (day === 6) next.setDate(next.getDate() + 2);  // sab → lun
  else next.setDate(next.getDate() + 1);                  // lun-jue → +1
  return next;
}

/**
 * Formatea fecha como "YYYY-MM-DD" en zona horaria de México.
 */
function formatDateMx(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

export async function fetchDOFExchangeRate() {
  console.log('🔄 [DOF Scheduler] Obteniendo tipo de cambio del DOF...');

  const banxicoToken = process.env.BANXICO_TOKEN;
  if (!banxicoToken) {
    console.error('❌ [DOF Scheduler] BANXICO_TOKEN no configurado en variables de entorno');
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
      return;
    }

    const data = await response.json();

    if (!data?.bmx?.series?.[0]?.datos?.[0]?.dato) {
      console.error('❌ [DOF Scheduler] Estructura de respuesta de Banxico inesperada:', JSON.stringify(data));
      return;
    }

    const latestRate = parseFloat(data.bmx.series[0].datos[0].dato);

    if (isNaN(latestRate)) {
      console.error('❌ [DOF Scheduler] Valor de tipo de cambio inválido:', data.bmx.series[0].datos[0].dato);
      return;
    }

    // El TC FIX publicado a las 12:00 aplica para el siguiente día hábil.
    // Guardar con la fecha del día hábil al que aplica.
    const now = new Date();
    const nextBizDay = getNextBusinessDay(now);
    const nextBizDateStr = formatDateMx(nextBizDay);

    // Deduplicación: no insertar si ya existe un DOF con la misma fecha de aplicación
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

    const buyRate = Number(latestRate.toFixed(4));
    const sellRate = Number(latestRate.toFixed(4));

    await db.insert(exchangeRates).values({
      buyRate,
      sellRate,
      source: 'DOF',
      notes: `TC DOF para ${nextBizDateStr} — publicado ${formatDateMx(now)} 12:00`,
      date: new Date(),
      createdBy: SYSTEM_USER_ID,
    });

    console.log(`✅ [DOF Scheduler] TC DOF insertado: $${buyRate} MXN/USD (aplica ${nextBizDateStr})`);
  } catch (error) {
    console.error('❌ [DOF Scheduler] Error al obtener tipo de cambio:', error);
  }
}

export function initializeDOFScheduler() {
  // Ejecutar inmediatamente al iniciar para tener datos desde el primer momento
  console.log('🚀 [DOF Scheduler] Ejecutando actualización inicial...');
  fetchDOFExchangeRate().catch(err => {
    console.error('❌ [DOF Scheduler] Error en actualización inicial:', err);
  });

  // Lolita/DOF: El tipo de cambio FIX se publica a las 12:00 PM en el DOF.
  // Bajamos a las 12:20 PM GDL (America/Mexico_City) para dar margen.
  // El TC publicado a las 12:00 aplica para el siguiente día hábil.
  // Después de las 12:00, el TC visible en la app es el de mañana.
  cron.schedule('20 12 * * 1-5', async () => {
    console.log('⏰ [DOF Scheduler] Actualización de 12:20 PM — bajando TC DOF del día');
    await fetchDOFExchangeRate();
  }, {
    timezone: 'America/Mexico_City'
  });

  // Retry a las 12:45 por si Banxico se retrasó publicando
  cron.schedule('45 12 * * 1-5', async () => {
    console.log('⏰ [DOF Scheduler] Retry 12:45 PM — verificando TC DOF');
    await fetchDOFExchangeRate();
  }, {
    timezone: 'America/Mexico_City'
  });

  console.log('📅 [DOF Scheduler] Programador de tipo de cambio DOF inicializado');
  console.log('⏰ Actualización automática programada:');
  console.log('   - 12:20 PM (Hora GDL/CDMX) — descarga principal');
  console.log('   - 12:45 PM (Hora GDL/CDMX) — retry si no se obtuvo');
  console.log('   - Solo días hábiles (Lun-Vie)');
  console.log('ℹ️  El TC publicado a las 12:00 aplica para el siguiente día hábil');
}

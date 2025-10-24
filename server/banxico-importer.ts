import { db } from "./db";
import { exchangeRates } from "@shared/schema";

const BANXICO_API_URL = "https://www.banxico.org.mx/SieAPIRest/service/v1";
const SERIES_ID = "SF43718"; // Tipo de cambio FIX - Nota: Este es un valor único, no compra/venta separados

interface BanxicoDataPoint {
  fecha: string; // formato DD/MM/YYYY
  dato: string; // valor como string
}

interface BanxicoResponse {
  bmx: {
    series: Array<{
      idSerie: string;
      titulo: string;
      datos: BanxicoDataPoint[];
    }>;
  };
}

export async function importBanxicoHistoricalData(
  startDate: string, // formato YYYY-MM-DD
  endDate: string // formato YYYY-MM-DD
) {
  const token = process.env.BANXICO_TOKEN;
  
  if (!token) {
    throw new Error("BANXICO_TOKEN no está configurado");
  }

  const url = `${BANXICO_API_URL}/series/${SERIES_ID}/datos/${startDate}/${endDate}`;
  
  console.log(`📥 [Banxico Import] Importando datos desde ${startDate} hasta ${endDate}...`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Bmx-Token': token
      }
    });

    if (!response.ok) {
      throw new Error(`Error en API Banxico: ${response.status} ${response.statusText}`);
    }

    const data: BanxicoResponse = await response.json();
    const seriesData = data.bmx.series[0]?.datos || [];

    console.log(`📊 [Banxico Import] Recibidos ${seriesData.length} registros`);

    let imported = 0;
    let skipped = 0;

    for (const point of seriesData) {
      // Convertir fecha de DD/MM/YYYY a YYYY-MM-DD
      const [day, month, year] = point.fecha.split('/');
      const isoDate = `${year}-${month}-${day}`;
      
      // El tipo de cambio FIX es el valor oficial DOF
      // Se usa el mismo valor para compra y venta (es valor de referencia)
      const rate = parseFloat(point.dato);
      const buyRate = rate.toFixed(4);
      const sellRate = rate.toFixed(4);

      // Verificar si ya existe este registro
      const existing = await db.query.exchangeRates.findFirst({
        where: (rates, { and, eq }) => and(
          eq(rates.source, 'DOF'),
          eq(rates.date, new Date(`${isoDate}T09:00:00`))
        )
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Insertar en la base de datos
      await db.insert(exchangeRates).values({
        buyRate: Number(buyRate),
        sellRate: Number(sellRate),
        source: 'DOF',
        notes: `Importado de Banxico (Serie ${SERIES_ID})`,
        date: new Date(`${isoDate}T09:00:00`),
        createdBy: 23, // Usuario sistema
      });

      imported++;
    }

    console.log(`✅ [Banxico Import] Importados: ${imported}, Omitidos (ya existían): ${skipped}`);
    
    return {
      success: true,
      imported,
      skipped,
      total: seriesData.length
    };

  } catch (error) {
    console.error('❌ [Banxico Import] Error:', error);
    throw error;
  }
}

// Función auxiliar para importar septiembre y octubre 2025
export async function importSeptemberOctober2025() {
  console.log('🚀 [Banxico Import] Iniciando importación de Sept-Oct 2025...');
  
  const result = await importBanxicoHistoricalData('2025-09-01', '2025-10-31');
  
  console.log('🎉 [Banxico Import] Importación completada:', result);
  return result;
}

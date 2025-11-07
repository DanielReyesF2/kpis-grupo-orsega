/**
 * Script para agregar KPIs de Tesorería para Lolita (Dolores Navarro)
 * Ejecutar con: npx tsx scripts/add-lolita-treasury-kpis.ts
 */

import 'dotenv/config';
import { db } from '../server/db';
import { kpisDura, kpisOrsega } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

const treasuryKpis = [
  // KPIs para Dura International (companyId: 1, areaId: 9)
  {
    name: 'Tiempo promedio de procesamiento de pagos',
    description: 'Mide el tiempo promedio desde la recepción de un pago hasta su procesamiento completo. Objetivo: procesar pagos en menos de 2 días hábiles.',
    areaId: 9,
    companyId: 1,
    unit: 'días',
    target: '2 días',
    frequency: 'weekly',
    calculationMethod: 'Promedio de días entre recepción y procesamiento de pagos',
    responsible: 'Dolores Navarro',
    invertedMetric: true,
  },
  {
    name: 'Precisión en el registro de tipos de cambio',
    description: 'Mide la exactitud en el registro diario de tipos de cambio. Objetivo: 100% de precisión en los registros.',
    areaId: 9,
    companyId: 1,
    unit: '%',
    target: '100%',
    frequency: 'daily',
    calculationMethod: '(Registros correctos / Total de registros) x 100',
    responsible: 'Dolores Navarro',
    invertedMetric: false,
  },
  {
    name: 'Cumplimiento en el envío de comprobantes',
    description: 'Mide el porcentaje de comprobantes enviados a tiempo a proveedores. Objetivo: 100% de comprobantes enviados dentro de 24 horas.',
    areaId: 9,
    companyId: 1,
    unit: '%',
    target: '100%',
    frequency: 'weekly',
    calculationMethod: '(Comprobantes enviados a tiempo / Total de comprobantes) x 100',
    responsible: 'Dolores Navarro',
    invertedMetric: false,
  },
  {
    name: 'Eficiencia en la gestión de complementos de pago',
    description: 'Mide el tiempo promedio para gestionar complementos de pago requeridos. Objetivo: procesar complementos en menos de 3 días hábiles.',
    areaId: 9,
    companyId: 1,
    unit: 'días',
    target: '3 días',
    frequency: 'weekly',
    calculationMethod: 'Promedio de días para gestionar complementos de pago',
    responsible: 'Dolores Navarro',
    invertedMetric: true,
  },
  // KPIs para Grupo Orsega (companyId: 2, areaId: 12)
  {
    name: 'Tiempo promedio de procesamiento de pagos',
    description: 'Mide el tiempo promedio desde la recepción de un pago hasta su procesamiento completo. Objetivo: procesar pagos en menos de 2 días hábiles.',
    areaId: 12,
    companyId: 2,
    unit: 'días',
    target: '2 días',
    frequency: 'weekly',
    calculationMethod: 'Promedio de días entre recepción y procesamiento de pagos',
    responsible: 'Dolores Navarro',
    invertedMetric: true,
  },
  {
    name: 'Precisión en el registro de tipos de cambio',
    description: 'Mide la exactitud en el registro diario de tipos de cambio. Objetivo: 100% de precisión en los registros.',
    areaId: 12,
    companyId: 2,
    unit: '%',
    target: '100%',
    frequency: 'daily',
    calculationMethod: '(Registros correctos / Total de registros) x 100',
    responsible: 'Dolores Navarro',
    invertedMetric: false,
  },
  {
    name: 'Cumplimiento en el envío de comprobantes',
    description: 'Mide el porcentaje de comprobantes enviados a tiempo a proveedores. Objetivo: 100% de comprobantes enviados dentro de 24 horas.',
    areaId: 12,
    companyId: 2,
    unit: '%',
    target: '100%',
    frequency: 'weekly',
    calculationMethod: '(Comprobantes enviados a tiempo / Total de comprobantes) x 100',
    responsible: 'Dolores Navarro',
    invertedMetric: false,
  },
  {
    name: 'Eficiencia en la gestión de complementos de pago',
    description: 'Mide el tiempo promedio para gestionar complementos de pago requeridos. Objetivo: procesar complementos en menos de 3 días hábiles.',
    areaId: 12,
    companyId: 2,
    unit: 'días',
    target: '3 días',
    frequency: 'weekly',
    calculationMethod: 'Promedio de días para gestionar complementos de pago',
    responsible: 'Dolores Navarro',
    invertedMetric: true,
  },
];

async function addLolitaKPIs() {
  try {
    console.log('📊 Iniciando inserción de KPIs de Tesorería para Dolores Navarro...\n');

    let inserted = 0;
    let skipped = 0;

    for (const kpi of treasuryKpis) {
      const table = kpi.companyId === 1 ? kpisDura : kpisOrsega;
      const companyName = kpi.companyId === 1 ? 'Dura' : 'Orsega';

      // Verificar si ya existe un KPI con el mismo nombre, área y responsable
      const existing = await db
        .select()
        .from(table)
        .where(
          and(
            eq(table.kpiName, kpi.name),
            eq(table.area, 'Tesorería'),
            eq(table.responsible, kpi.responsible)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`⏭️  KPI ya existe: "${kpi.name}" (${companyName})`);
        skipped++;
        continue;
      }

      // Insertar en la tabla correspondiente
      await db.insert(table).values({
        area: 'Tesorería',
        kpiName: kpi.name,
        description: kpi.description,
        calculationMethod: kpi.calculationMethod,
        goal: kpi.target,
        unit: kpi.unit,
        frequency: kpi.frequency,
        responsible: kpi.responsible,
      });

      console.log(`✅ KPI creado: "${kpi.name}" (${companyName})`);
      inserted++;
    }

    console.log(`\n📈 Resumen:`);
    console.log(`   ✅ Insertados: ${inserted}`);
    console.log(`   ⏭️  Omitidos: ${skipped}`);
    console.log(`   📊 Total procesados: ${treasuryKpis.length}`);

    // Verificar KPIs creados
    const duraKPIs = await db
      .select({
        id: kpisDura.id,
        name: kpisDura.kpiName,
        responsible: kpisDura.responsible,
        area: kpisDura.area,
      })
      .from(kpisDura)
      .where(eq(kpisDura.responsible, 'Dolores Navarro'));

    const orsegaKPIs = await db
      .select({
        id: kpisOrsega.id,
        name: kpisOrsega.kpiName,
        responsible: kpisOrsega.responsible,
        area: kpisOrsega.area,
      })
      .from(kpisOrsega)
      .where(eq(kpisOrsega.responsible, 'Dolores Navarro'));

    console.log(`\n📋 KPIs de Dolores Navarro en la base de datos:`);
    duraKPIs.forEach((kpi) => {
      console.log(`   - [${kpi.id}] ${kpi.name} (Dura, ${kpi.area})`);
    });
    orsegaKPIs.forEach((kpi) => {
      console.log(`   - [${kpi.id}] ${kpi.name} (Orsega, ${kpi.area})`);
    });

    console.log('\n✅ Proceso completado exitosamente!');
  } catch (error) {
    console.error('❌ Error al insertar KPIs:', error);
    process.exit(1);
  }
}

addLolitaKPIs();


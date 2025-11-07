import 'dotenv/config';
import { db } from '../server/db';
import { kpisDura, kpisOrsega } from '@shared/schema';
import { eq, and, or, isNull, sql } from 'drizzle-orm';

async function updateKpiGoals() {
  console.log('🚀 Iniciando actualización de goals en KPIs...\n');

  try {
    // ============================================
    // KPIs DE VENTAS
    // ============================================
    console.log('📊 Actualizando KPIs de VENTAS...');

    // Volumen de ventas alcanzado
    await db
      .update(kpisDura)
      .set({ goal: '55,620 KG' })
      .where(
        and(
          sql`LOWER(${kpisDura.kpiName}) LIKE '%volumen%ventas%'`,
          eq(kpisDura.area, 'Ventas'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Volumen de ventas`);

    await db
      .update(kpisOrsega)
      .set({ goal: '775,735 unidades' })
      .where(
        and(
          sql`LOWER(${kpisOrsega.kpiName}) LIKE '%volumen%ventas%'`,
          eq(kpisOrsega.area, 'Ventas'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Volumen de ventas`);

    // Porcentaje de crecimiento en ventas
    await db
      .update(kpisDura)
      .set({ goal: '+10% vs año anterior' })
      .where(
        and(
          or(
            sql`LOWER(${kpisDura.kpiName}) LIKE '%crecimiento%ventas%'`,
            sql`LOWER(${kpisDura.kpiName}) LIKE '%crecimiento%2024%'`,
            sql`LOWER(${kpisDura.kpiName}) LIKE '%crecimiento vs%'`
          ),
          eq(kpisDura.area, 'Ventas'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Crecimiento en ventas`);

    await db
      .update(kpisOrsega)
      .set({ goal: '+10% vs año anterior' })
      .where(
        and(
          or(
            sql`LOWER(${kpisOrsega.kpiName}) LIKE '%crecimiento%ventas%'`,
            sql`LOWER(${kpisOrsega.kpiName}) LIKE '%crecimiento%2024%'`,
            sql`LOWER(${kpisOrsega.kpiName}) LIKE '%crecimiento vs%'`
          ),
          eq(kpisOrsega.area, 'Ventas'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Crecimiento en ventas`);

    // Nuevos clientes adquiridos
    await db
      .update(kpisDura)
      .set({ goal: '2 nuevos/mes' })
      .where(
        and(
          sql`LOWER(${kpisDura.kpiName}) LIKE '%nuevos clientes%'`,
          eq(kpisDura.area, 'Ventas'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Nuevos clientes`);

    await db
      .update(kpisOrsega)
      .set({ goal: '2 nuevos/mes' })
      .where(
        and(
          sql`LOWER(${kpisOrsega.kpiName}) LIKE '%nuevos clientes%'`,
          eq(kpisOrsega.area, 'Ventas'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Nuevos clientes`);

    // Tasa de retención de clientes
    await db
      .update(kpisDura)
      .set({ goal: '90%' })
      .where(
        and(
          sql`LOWER(${kpisDura.kpiName}) LIKE '%retención%clientes%'`,
          eq(kpisDura.area, 'Ventas'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Retención de clientes`);

    await db
      .update(kpisOrsega)
      .set({ goal: '90%' })
      .where(
        and(
          sql`LOWER(${kpisOrsega.kpiName}) LIKE '%retención%clientes%'`,
          eq(kpisOrsega.area, 'Ventas'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Retención de clientes`);

    // Satisfacción interdepartamental
    await db
      .update(kpisDura)
      .set({ goal: 'Retroalimentación continua' })
      .where(
        and(
          sql`LOWER(${kpisDura.kpiName}) LIKE '%satisfacción interdepartamental%'`,
          eq(kpisDura.area, 'Ventas'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Satisfacción interdepartamental`);

    await db
      .update(kpisOrsega)
      .set({ goal: 'Retroalimentación continua' })
      .where(
        and(
          sql`LOWER(${kpisOrsega.kpiName}) LIKE '%satisfacción interdepartamental%'`,
          eq(kpisOrsega.area, 'Ventas'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Satisfacción interdepartamental`);

    // ============================================
    // KPIs DE LOGÍSTICA
    // ============================================
    console.log('\n📦 Actualizando KPIs de LOGÍSTICA...');

    // Precisión de inventarios
    await db
      .update(kpisDura)
      .set({ goal: '100%' })
      .where(
        and(
          sql`LOWER(${kpisDura.kpiName}) LIKE '%precisión%inventarios%'`,
          eq(kpisDura.area, 'Logística'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Precisión de inventarios`);

    await db
      .update(kpisOrsega)
      .set({ goal: '100%' })
      .where(
        and(
          sql`LOWER(${kpisOrsega.kpiName}) LIKE '%precisión%inventarios%'`,
          eq(kpisOrsega.area, 'Logística'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Precisión de inventarios`);

    // Cumplimiento de tiempos de entrega
    await db
      .update(kpisDura)
      .set({ goal: '100%' })
      .where(
        and(
          or(
            sql`LOWER(${kpisDura.kpiName}) LIKE '%cumplimiento%tiempos%entrega%'`,
            sql`LOWER(${kpisDura.kpiName}) LIKE '%entregas%tiempo%'`
          ),
          eq(kpisDura.area, 'Logística'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Cumplimiento de entregas`);

    await db
      .update(kpisOrsega)
      .set({ goal: '100%' })
      .where(
        and(
          or(
            sql`LOWER(${kpisOrsega.kpiName}) LIKE '%cumplimiento%tiempos%entrega%'`,
            sql`LOWER(${kpisOrsega.kpiName}) LIKE '%entregas%tiempo%'`
          ),
          eq(kpisOrsega.area, 'Logística'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Cumplimiento de entregas`);

    // Costos de transporte
    await db
      .update(kpisDura)
      .set({ goal: '< Inflación anual' })
      .where(
        and(
          or(
            sql`LOWER(${kpisDura.kpiName}) LIKE '%costos%transporte%'`,
            sql`LOWER(${kpisDura.kpiName}) LIKE '%costos logísticos%'`
          ),
          eq(kpisDura.area, 'Logística'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Costos de transporte`);

    await db
      .update(kpisOrsega)
      .set({ goal: '< Inflación anual' })
      .where(
        and(
          or(
            sql`LOWER(${kpisOrsega.kpiName}) LIKE '%costos%transporte%'`,
            sql`LOWER(${kpisOrsega.kpiName}) LIKE '%costos logísticos%'`
          ),
          eq(kpisOrsega.area, 'Logística'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Costos de transporte`);

    // Satisfacción de clientes internos
    await db
      .update(kpisDura)
      .set({ goal: '100%' })
      .where(
        and(
          or(
            sql`LOWER(${kpisDura.kpiName}) LIKE '%satisfacción%clientes%internos%'`,
            sql`LOWER(${kpisDura.kpiName}) LIKE '%satisfacción interdepartamental%'`
          ),
          eq(kpisDura.area, 'Logística'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Satisfacción clientes internos`);

    await db
      .update(kpisOrsega)
      .set({ goal: '100%' })
      .where(
        and(
          or(
            sql`LOWER(${kpisOrsega.kpiName}) LIKE '%satisfacción%clientes%internos%'`,
            sql`LOWER(${kpisOrsega.kpiName}) LIKE '%satisfacción interdepartamental%'`
          ),
          eq(kpisOrsega.area, 'Logística'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Satisfacción clientes internos`);

    // Tiempo de recuperación de evidencias
    await db
      .update(kpisDura)
      .set({ goal: '< 24 horas' })
      .where(
        and(
          sql`LOWER(${kpisDura.kpiName}) LIKE '%tiempo%recuperación%evidencias%'`,
          eq(kpisDura.area, 'Logística'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Tiempo recuperación evidencias`);

    await db
      .update(kpisOrsega)
      .set({ goal: '< 24 horas' })
      .where(
        and(
          sql`LOWER(${kpisOrsega.kpiName}) LIKE '%tiempo%recuperación%evidencias%'`,
          eq(kpisOrsega.area, 'Logística'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Tiempo recuperación evidencias`);

    // Incidencias en Transporte (si existe)
    await db
      .update(kpisDura)
      .set({ goal: '0 incidencias' })
      .where(
        and(
          sql`LOWER(${kpisDura.kpiName}) LIKE '%incidencias%transporte%'`,
          eq(kpisDura.area, 'Logística'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Incidencias en transporte`);

    await db
      .update(kpisOrsega)
      .set({ goal: '0 incidencias' })
      .where(
        and(
          sql`LOWER(${kpisOrsega.kpiName}) LIKE '%incidencias%transporte%'`,
          eq(kpisOrsega.area, 'Logística'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Incidencias en transporte`);

    // ============================================
    // KPIs DE TESORERÍA
    // ============================================
    console.log('\n💰 Actualizando KPIs de TESORERÍA...');

    // Tiempo promedio de procesamiento de pagos
    await db
      .update(kpisDura)
      .set({ goal: '2 días' })
      .where(
        and(
          sql`LOWER(${kpisDura.kpiName}) LIKE '%tiempo promedio%procesamiento%pagos%'`,
          eq(kpisDura.area, 'Tesorería'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Tiempo procesamiento pagos`);

    await db
      .update(kpisOrsega)
      .set({ goal: '2 días' })
      .where(
        and(
          sql`LOWER(${kpisOrsega.kpiName}) LIKE '%tiempo promedio%procesamiento%pagos%'`,
          eq(kpisOrsega.area, 'Tesorería'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Tiempo procesamiento pagos`);

    // Precisión en el registro de tipos de cambio
    await db
      .update(kpisDura)
      .set({ goal: '100%' })
      .where(
        and(
          sql`LOWER(${kpisDura.kpiName}) LIKE '%precisión%registro%tipos%cambio%'`,
          eq(kpisDura.area, 'Tesorería'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Precisión tipos de cambio`);

    await db
      .update(kpisOrsega)
      .set({ goal: '100%' })
      .where(
        and(
          sql`LOWER(${kpisOrsega.kpiName}) LIKE '%precisión%registro%tipos%cambio%'`,
          eq(kpisOrsega.area, 'Tesorería'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Precisión tipos de cambio`);

    // Cumplimiento en el envío de comprobantes
    await db
      .update(kpisDura)
      .set({ goal: '100%' })
      .where(
        and(
          sql`LOWER(${kpisDura.kpiName}) LIKE '%cumplimiento%envío%comprobantes%'`,
          eq(kpisDura.area, 'Tesorería'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Cumplimiento envío comprobantes`);

    await db
      .update(kpisOrsega)
      .set({ goal: '100%' })
      .where(
        and(
          sql`LOWER(${kpisOrsega.kpiName}) LIKE '%cumplimiento%envío%comprobantes%'`,
          eq(kpisOrsega.area, 'Tesorería'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Cumplimiento envío comprobantes`);

    // Eficiencia en la gestión de complementos de pago
    await db
      .update(kpisDura)
      .set({ goal: '3 días' })
      .where(
        and(
          sql`LOWER(${kpisDura.kpiName}) LIKE '%eficiencia%gestión%complementos%'`,
          eq(kpisDura.area, 'Tesorería'),
          or(isNull(kpisDura.goal), eq(kpisDura.goal, ''))
        )
      );
    console.log(`  ✅ Dura: Eficiencia complementos`);

    await db
      .update(kpisOrsega)
      .set({ goal: '3 días' })
      .where(
        and(
          sql`LOWER(${kpisOrsega.kpiName}) LIKE '%eficiencia%gestión%complementos%'`,
          eq(kpisOrsega.area, 'Tesorería'),
          or(isNull(kpisOrsega.goal), eq(kpisOrsega.goal, ''))
        )
      );
    console.log(`  ✅ Orsega: Eficiencia complementos`);

    // ============================================
    // VERIFICACIÓN
    // ============================================
    console.log('\n📋 Verificando actualizaciones...\n');

    const duraVentas = await db
      .select()
      .from(kpisDura)
      .where(eq(kpisDura.area, 'Ventas'));
    
    const orsegaVentas = await db
      .select()
      .from(kpisOrsega)
      .where(eq(kpisOrsega.area, 'Ventas'));

    console.log(`📊 VENTAS - Dura: ${duraVentas.length} KPIs`);
    duraVentas.forEach(kpi => {
      console.log(`   ${kpi.kpiName}: ${kpi.goal || '❌ Sin goal'}`);
    });

    console.log(`\n📊 VENTAS - Orsega: ${orsegaVentas.length} KPIs`);
    orsegaVentas.forEach(kpi => {
      console.log(`   ${kpi.kpiName}: ${kpi.goal || '❌ Sin goal'}`);
    });

    const duraLogistica = await db
      .select()
      .from(kpisDura)
      .where(eq(kpisDura.area, 'Logística'));
    
    const orsegaLogistica = await db
      .select()
      .from(kpisOrsega)
      .where(eq(kpisOrsega.area, 'Logística'));

    console.log(`\n📦 LOGÍSTICA - Dura: ${duraLogistica.length} KPIs`);
    duraLogistica.forEach(kpi => {
      console.log(`   ${kpi.kpiName}: ${kpi.goal || '❌ Sin goal'}`);
    });

    console.log(`\n📦 LOGÍSTICA - Orsega: ${orsegaLogistica.length} KPIs`);
    orsegaLogistica.forEach(kpi => {
      console.log(`   ${kpi.kpiName}: ${kpi.goal || '❌ Sin goal'}`);
    });

    const duraTesoreria = await db
      .select()
      .from(kpisDura)
      .where(eq(kpisDura.area, 'Tesorería'));
    
    const orsegaTesoreria = await db
      .select()
      .from(kpisOrsega)
      .where(eq(kpisOrsega.area, 'Tesorería'));

    console.log(`\n💰 TESORERÍA - Dura: ${duraTesoreria.length} KPIs`);
    duraTesoreria.forEach(kpi => {
      console.log(`   ${kpi.kpiName}: ${kpi.goal || '❌ Sin goal'}`);
    });

    console.log(`\n💰 TESORERÍA - Orsega: ${orsegaTesoreria.length} KPIs`);
    orsegaTesoreria.forEach(kpi => {
      console.log(`   ${kpi.kpiName}: ${kpi.goal || '❌ Sin goal'}`);
    });

    console.log('\n✅ ¡Actualización completada exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al actualizar goals:', error);
    process.exit(1);
  }
}

updateKpiGoals();


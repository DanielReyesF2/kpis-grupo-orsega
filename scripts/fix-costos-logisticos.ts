import 'dotenv/config';
import { db } from '../server/db';
import { kpisDura, kpisOrsega } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Fix Costos Logísticos KPI
 *
 * The goal "< Inflación anual" cannot be calculated automatically.
 * This script updates it to "5" (5% of logistics costs over total sales).
 *
 * This is a "lower is better" KPI - detected automatically by kpi-utils.ts
 * because the name contains "costos".
 */
async function fixCostosLogisticos() {
  console.log('🚀 Fixing Costos Logísticos KPI...\n');

  try {
    // Update Dura
    const duraResult = await db
      .update(kpisDura)
      .set({
        goal: '5',
        unit: '%'
      })
      .where(
        sql`LOWER(${kpisDura.kpiName}) LIKE '%costos%logísticos%' OR LOWER(${kpisDura.kpiName}) LIKE '%costos%transporte%'`
      )
      .returning();

    console.log(`  ✅ Dura: Updated ${duraResult.length} KPIs`);
    for (const kpi of duraResult) {
      console.log(`     - ${kpi.kpiName} → goal: ${kpi.goal}, unit: ${kpi.unit}`);
    }

    // Update Orsega
    const orsegaResult = await db
      .update(kpisOrsega)
      .set({
        goal: '5',
        unit: '%'
      })
      .where(
        sql`LOWER(${kpisOrsega.kpiName}) LIKE '%costos%logísticos%' OR LOWER(${kpisOrsega.kpiName}) LIKE '%costos%transporte%'`
      )
      .returning();

    console.log(`  ✅ Orsega: Updated ${orsegaResult.length} KPIs`);
    for (const kpi of orsegaResult) {
      console.log(`     - ${kpi.kpiName} → goal: ${kpi.goal}, unit: ${kpi.unit}`);
    }

    const totalUpdated = duraResult.length + orsegaResult.length;
    console.log(`\n✅ Done! Updated ${totalUpdated} KPIs total.`);
    console.log('📝 Note: "Costos Logísticos" is detected as "lower is better" by kpi-utils.ts');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating KPIs:', error);
    process.exit(1);
  }
}

fixCostosLogisticos();

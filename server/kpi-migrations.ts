/**
 * KPI Migrations
 * Auto-fixes known KPI data issues (e.g. non-numeric goals).
 * Safe to run multiple times (idempotent).
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;
const sql = neon(process.env.DATABASE_URL!);

/**
 * Fix "Costos Logisticos" KPIs that have a non-numeric goal like "< Inflacion anual".
 * Sets goal = '5' and unit = '%' in both kpis_dura and kpis_orsega.
 *
 * Idempotent: rows that already have goal = '5' and unit = '%' are not touched
 * because the WHERE clause filters on non-numeric goals.
 */
async function fixCostosLogisticosGoal(): Promise<number> {
  let totalUpdated = 0;

  for (const table of ['kpis_dura', 'kpis_orsega'] as const) {
    // First, check which rows would be affected (for logging purposes)
    const candidates = await sql`
      SELECT id, kpi_name, goal, unit
      FROM ${sql(table)}
      WHERE (kpi_name ILIKE '%Costos%logísticos%' OR kpi_name ILIKE '%Costos%transporte%')
        AND (goal IS NULL OR goal !~ '^[0-9]+(\\.[0-9]+)?$')
    `;

    if (candidates.length === 0) {
      console.log(`[kpi-migrations] ${table}: No non-numeric "Costos Logisticos" goals to fix. Already clean.`);
      continue;
    }

    for (const row of candidates) {
      console.log(
        `[kpi-migrations] ${table}: Fixing KPI id=${row.id} "${row.kpi_name}" — goal "${row.goal}" -> "5", unit "${row.unit}" -> "%"`
      );
    }

    // Perform the update
    const updated = await sql`
      UPDATE ${sql(table)}
      SET goal = '5',
          unit = '%'
      WHERE (kpi_name ILIKE '%Costos%logísticos%' OR kpi_name ILIKE '%Costos%transporte%')
        AND (goal IS NULL OR goal !~ '^[0-9]+(\\.[0-9]+)?$')
    `;

    const count = candidates.length;
    console.log(`[kpi-migrations] ${table}: Updated ${count} row(s).`);
    totalUpdated += count;
  }

  return totalUpdated;
}

/**
 * Run all KPI migrations.
 * Each migration is idempotent — safe to call on every server start.
 */
export async function runKpiMigrations(): Promise<void> {
  console.log('[kpi-migrations] Starting KPI migrations...');

  try {
    const fixed = await fixCostosLogisticosGoal();

    if (fixed > 0) {
      console.log(`[kpi-migrations] Done. Fixed ${fixed} KPI row(s) total.`);
    } else {
      console.log('[kpi-migrations] Done. No changes needed — all KPIs are already correct.');
    }
  } catch (error) {
    console.error('[kpi-migrations] Migration failed:', error);
    throw error;
  }
}

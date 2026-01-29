/**
 * KPI Migrations
 * Auto-fixes known KPI data issues.
 * Safe to run multiple times (idempotent).
 *
 * KEY BUSINESS RULE:
 * Dura International and Grupo Orsega are the SAME team, same people, same KPIs.
 * The only difference is currency (USD vs MXN).
 * All migrations MUST apply identically to BOTH kpis_dura and kpis_orsega.
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import WebSocket from 'ws';

neonConfig.webSocketConstructor = WebSocket;
const sql = neon(process.env.DATABASE_URL!);

// ============================================================================
// MIGRATION 1: Fix Costos Logísticos non-numeric goals
// ============================================================================
async function fixCostosLogisticosGoal(): Promise<number> {
  let totalUpdated = 0;

  for (const table of ['kpis_dura', 'kpis_orsega']) {
    const candidates = table === 'kpis_dura'
      ? await sql`
          SELECT id, kpi_name, goal, unit FROM kpis_dura
          WHERE (kpi_name ILIKE '%Costos%logísticos%' OR kpi_name ILIKE '%Costos%logisticos%' OR kpi_name ILIKE '%Costos%transporte%' OR kpi_name ILIKE '%Costo de Transporte%')
            AND (goal IS NULL OR goal !~ '^[0-9]+(\.[0-9]+)?$')
        `
      : await sql`
          SELECT id, kpi_name, goal, unit FROM kpis_orsega
          WHERE (kpi_name ILIKE '%Costos%logísticos%' OR kpi_name ILIKE '%Costos%logisticos%' OR kpi_name ILIKE '%Costos%transporte%' OR kpi_name ILIKE '%Costo de Transporte%')
            AND (goal IS NULL OR goal !~ '^[0-9]+(\.[0-9]+)?$')
        `;

    if (candidates.length === 0) {
      console.log(`[kpi-migrations] ${table}: Costos Logísticos goals already clean.`);
      continue;
    }

    for (const row of candidates) {
      console.log(`[kpi-migrations] ${table}: Fixing id=${row.id} "${row.kpi_name}" — goal "${row.goal}" -> "5", unit -> "%"`);
    }

    if (table === 'kpis_dura') {
      await sql`
        UPDATE kpis_dura SET goal = '5', unit = '%'
        WHERE (kpi_name ILIKE '%Costos%logísticos%' OR kpi_name ILIKE '%Costos%logisticos%' OR kpi_name ILIKE '%Costos%transporte%' OR kpi_name ILIKE '%Costo de Transporte%')
          AND (goal IS NULL OR goal !~ '^[0-9]+(\.[0-9]+)?$')
      `;
    } else {
      await sql`
        UPDATE kpis_orsega SET goal = '5', unit = '%'
        WHERE (kpi_name ILIKE '%Costos%logísticos%' OR kpi_name ILIKE '%Costos%logisticos%' OR kpi_name ILIKE '%Costos%transporte%' OR kpi_name ILIKE '%Costo de Transporte%')
          AND (goal IS NULL OR goal !~ '^[0-9]+(\.[0-9]+)?$')
      `;
    }

    console.log(`[kpi-migrations] ${table}: Updated ${candidates.length} row(s).`);
    totalUpdated += candidates.length;
  }

  return totalUpdated;
}

// ============================================================================
// MIGRATION 2: Assign responsible to KPIs that have NULL responsible
// Same people work for BOTH companies — apply identically to both tables.
// ============================================================================

/** Area-based assignments: same for both companies */
const AREA_ASSIGNMENTS = [
  { areaPattern: '%Compras%', responsible: 'Alejandra Palomera' },
  { areaPattern: '%Almacén%', responsible: 'Jesús Espinoza' },
  { areaPattern: '%Almacen%', responsible: 'Jesús Espinoza' },
  { areaPattern: '%Bodega%', responsible: 'Jesús Espinoza' },
  { areaPattern: '%Inventario%', responsible: 'Jesús Espinoza' },
  { areaPattern: '%Tesorería%', responsible: 'Dolores Navarro' },
  { areaPattern: '%Tesoreria%', responsible: 'Dolores Navarro' },
  { areaPattern: '%Contabilidad%', responsible: 'Julio Martell' },
];

/** Name-based assignments for KPIs that may not have area set */
const NAME_ASSIGNMENTS = [
  { namePattern: '%retención%clientes%', responsible: 'Omar' },
  { namePattern: '%retencion%clientes%', responsible: 'Omar' },
  { namePattern: '%Liquidez%', responsible: 'Julio Martell' },
  { namePattern: '%cobranza%', responsible: 'Julio Martell' },
  { namePattern: '%Rentabilidad%financiera%', responsible: 'Julio Martell' },
];

async function assignMissingResponsibles(): Promise<number> {
  let totalUpdated = 0;

  // Apply to BOTH tables
  for (const table of ['kpis_dura', 'kpis_orsega']) {
    // Area-based assignments
    for (const { areaPattern, responsible } of AREA_ASSIGNMENTS) {
      const updated = table === 'kpis_dura'
        ? await sql`UPDATE kpis_dura SET responsible = ${responsible} WHERE responsible IS NULL AND area ILIKE ${areaPattern}`
        : await sql`UPDATE kpis_orsega SET responsible = ${responsible} WHERE responsible IS NULL AND area ILIKE ${areaPattern}`;

      if (updated.length > 0) {
        console.log(`[kpi-migrations] ${table}: Assigned "${responsible}" to ${updated.length} KPI(s) in area "${areaPattern}".`);
        totalUpdated += updated.length;
      }
    }

    // Name-based assignments
    for (const { namePattern, responsible } of NAME_ASSIGNMENTS) {
      const updated = table === 'kpis_dura'
        ? await sql`UPDATE kpis_dura SET responsible = ${responsible} WHERE responsible IS NULL AND kpi_name ILIKE ${namePattern}`
        : await sql`UPDATE kpis_orsega SET responsible = ${responsible} WHERE responsible IS NULL AND kpi_name ILIKE ${namePattern}`;

      if (updated.length > 0) {
        console.log(`[kpi-migrations] ${table}: Assigned "${responsible}" to ${updated.length} KPI(s) matching name "${namePattern}".`);
        totalUpdated += updated.length;
      }
    }

    // Catch-all: any remaining NULL responsibles → Mario Reynoso (Gerente General)
    const remaining = table === 'kpis_dura'
      ? await sql`UPDATE kpis_dura SET responsible = 'Mario Reynoso' WHERE responsible IS NULL`
      : await sql`UPDATE kpis_orsega SET responsible = 'Mario Reynoso' WHERE responsible IS NULL`;

    if (remaining.length > 0) {
      console.log(`[kpi-migrations] ${table}: Assigned "Mario Reynoso" (default) to ${remaining.length} remaining KPI(s) with no responsible.`);
      totalUpdated += remaining.length;
    }
  }

  if (totalUpdated === 0) {
    console.log('[kpi-migrations] All KPIs already have responsible assigned.');
  }

  return totalUpdated;
}

// ============================================================================
// MIGRATION 3: Ensure Calidad KPIs exist in BOTH tables
// Same people, same KPIs — Fernanda del Valle handles Calidad for both.
// ============================================================================
async function ensureCalidadKpis(): Promise<number> {
  let totalCreated = 0;

  for (const table of ['kpis_dura', 'kpis_orsega']) {
    const existing = table === 'kpis_dura'
      ? await sql`SELECT id FROM kpis_dura WHERE area ILIKE '%Calidad%' LIMIT 1`
      : await sql`SELECT id FROM kpis_orsega WHERE area ILIKE '%Calidad%' LIMIT 1`;

    if (existing.length > 0) {
      console.log(`[kpi-migrations] ${table}: Calidad KPIs already exist. Skipping.`);
      continue;
    }

    console.log(`[kpi-migrations] ${table}: Creating 3 Calidad KPIs for Fernanda del Valle...`);

    if (table === 'kpis_dura') {
      await sql`
        INSERT INTO kpis_dura (area, kpi_name, description, calculation_method, goal, unit, frequency, source, responsible)
        VALUES
          ('Calidad', 'Tasa de Productos No Conformes', 'Porcentaje de productos que no cumplen los estándares de calidad', 'Productos no conformes / Total productos * 100', '2', '%', 'monthly', 'Manual', 'Fernanda del Valle'),
          ('Calidad', 'Resolución de Quejas de Clientes', 'Tiempo promedio para resolver quejas de clientes', 'Promedio de días desde recepción hasta resolución', '5', 'días', 'weekly', 'Manual', 'Fernanda del Valle'),
          ('Calidad', 'Cumplimiento de Auditorías Internas', 'Porcentaje de cumplimiento en auditorías de calidad', 'Puntos cumplidos / Total puntos auditados * 100', '100', '%', 'monthly', 'Manual', 'Fernanda del Valle')
      `;
    } else {
      await sql`
        INSERT INTO kpis_orsega (area, kpi_name, description, calculation_method, goal, unit, frequency, source, responsible)
        VALUES
          ('Calidad', 'Tasa de Productos No Conformes', 'Porcentaje de productos que no cumplen los estándares de calidad', 'Productos no conformes / Total productos * 100', '2', '%', 'monthly', 'Manual', 'Fernanda del Valle'),
          ('Calidad', 'Resolución de Quejas de Clientes', 'Tiempo promedio para resolver quejas de clientes', 'Promedio de días desde recepción hasta resolución', '5', 'días', 'weekly', 'Manual', 'Fernanda del Valle'),
          ('Calidad', 'Cumplimiento de Auditorías Internas', 'Porcentaje de cumplimiento en auditorías de calidad', 'Puntos cumplidos / Total puntos auditados * 100', '100', '%', 'monthly', 'Manual', 'Fernanda del Valle')
      `;
    }

    console.log(`[kpi-migrations] ${table}: Created 3 Calidad KPIs.`);
    totalCreated += 3;
  }

  return totalCreated;
}

// ============================================================================
// MIGRATION 4: Ensure Compras/Almacén/Tesorería KPIs exist in BOTH tables
// If one table has KPIs that the other doesn't, create them.
// ============================================================================
async function ensureSymmetricKpis(): Promise<number> {
  let totalCreated = 0;

  // KPIs that should exist in BOTH tables (from the plan)
  const requiredKpis = [
    // Compras — Alejandra Palomera
    { area: 'Compras', kpi_name: 'Tiempo de respuesta a cotizaciones', description: 'Tiempo promedio para responder cotizaciones de proveedores', calculation_method: 'Promedio de tiempo entre solicitud y respuesta', goal: '24', unit: 'horas', frequency: 'monthly', source: 'Manual', responsible: 'Alejandra Palomera' },
    { area: 'Compras', kpi_name: 'Porcentaje de proveedores certificados', description: 'Proporción de proveedores con certificaciones vigentes', calculation_method: 'Proveedores certificados / Total proveedores * 100', goal: '95', unit: '%', frequency: 'quarterly', source: 'Manual', responsible: 'Alejandra Palomera' },
    { area: 'Compras', kpi_name: 'Reducción de costos de compras', description: 'Porcentaje de reducción en costos de compras vs periodo anterior', calculation_method: '(Costo anterior - Costo actual) / Costo anterior * 100', goal: '5', unit: '%', frequency: 'monthly', source: 'Manual', responsible: 'Alejandra Palomera' },

    // Almacén — Jesús Espinoza
    { area: 'Almacén', kpi_name: 'Precisión de inventario', description: 'Exactitud del inventario físico vs sistema', calculation_method: 'Coincidencias / Total items * 100', goal: '98', unit: '%', frequency: 'monthly', source: 'Manual', responsible: 'Jesús Espinoza' },
    { area: 'Almacén', kpi_name: 'Tiempo de despacho', description: 'Tiempo promedio desde solicitud hasta despacho de mercancía', calculation_method: 'Promedio de horas desde solicitud hasta despacho', goal: '2', unit: 'horas', frequency: 'daily', source: 'Manual', responsible: 'Jesús Espinoza' },
    { area: 'Almacén', kpi_name: 'Rotación de inventario', description: 'Número de veces que se renueva el inventario al año', calculation_method: 'Costo de ventas / Inventario promedio', goal: '12', unit: 'veces/año', frequency: 'monthly', source: 'Manual', responsible: 'Jesús Espinoza' },
  ];

  for (const table of ['kpis_dura', 'kpis_orsega']) {
    for (const kpi of requiredKpis) {
      // Check if KPI already exists (by area + similar name)
      const existing = table === 'kpis_dura'
        ? await sql`SELECT id FROM kpis_dura WHERE area ILIKE ${kpi.area} AND kpi_name ILIKE ${kpi.kpi_name} LIMIT 1`
        : await sql`SELECT id FROM kpis_orsega WHERE area ILIKE ${kpi.area} AND kpi_name ILIKE ${kpi.kpi_name} LIMIT 1`;

      if (existing.length > 0) continue;

      console.log(`[kpi-migrations] ${table}: Creating "${kpi.kpi_name}" (${kpi.area}) -> ${kpi.responsible}`);

      if (table === 'kpis_dura') {
        await sql`
          INSERT INTO kpis_dura (area, kpi_name, description, calculation_method, goal, unit, frequency, source, responsible)
          VALUES (${kpi.area}, ${kpi.kpi_name}, ${kpi.description}, ${kpi.calculation_method}, ${kpi.goal}, ${kpi.unit}, ${kpi.frequency}, ${kpi.source}, ${kpi.responsible})
        `;
      } else {
        await sql`
          INSERT INTO kpis_orsega (area, kpi_name, description, calculation_method, goal, unit, frequency, source, responsible)
          VALUES (${kpi.area}, ${kpi.kpi_name}, ${kpi.description}, ${kpi.calculation_method}, ${kpi.goal}, ${kpi.unit}, ${kpi.frequency}, ${kpi.source}, ${kpi.responsible})
        `;
      }
      totalCreated++;
    }
  }

  if (totalCreated > 0) {
    console.log(`[kpi-migrations] Created ${totalCreated} missing KPI(s) across both tables.`);
  } else {
    console.log('[kpi-migrations] All required KPIs already exist in both tables.');
  }

  return totalCreated;
}

// ============================================================================
// MAIN: Run all migrations
// ============================================================================
export async function runKpiMigrations(): Promise<void> {
  console.log('[kpi-migrations] Starting KPI migrations...');
  console.log('[kpi-migrations] Rule: Dura & Orsega = same team, same KPIs, same responsibles.');

  try {
    const fixedGoals = await fixCostosLogisticosGoal();
    const assignedResponsibles = await assignMissingResponsibles();
    const createdCalidad = await ensureCalidadKpis();
    const createdSymmetric = await ensureSymmetricKpis();

    const totalChanges = fixedGoals + assignedResponsibles + createdCalidad + createdSymmetric;

    if (totalChanges > 0) {
      console.log(`[kpi-migrations] Done. Applied ${totalChanges} change(s) total.`);
    } else {
      console.log('[kpi-migrations] Done. No changes needed — all KPIs are correct and symmetric.');
    }
  } catch (error) {
    console.error('[kpi-migrations] Migration failed:', error);
    throw error;
  }
}

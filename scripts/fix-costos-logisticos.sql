-- Fix Costos Logísticos KPI: Change non-numeric goal to numeric value
-- The goal "< Inflación anual" cannot be calculated automatically
-- New goal: 5% (percentage of logistics costs over total sales)
-- This is a "lower is better" KPI (detected by kpi-utils.ts via "costos" in name)

-- Update Dura
UPDATE kpis_dura
SET goal = '5',
    unit = '%'
WHERE kpi_name ILIKE '%Costos%logísticos%'
   OR kpi_name ILIKE '%Costos%transporte%';

-- Update Orsega
UPDATE kpis_orsega
SET goal = '5',
    unit = '%'
WHERE kpi_name ILIKE '%Costos%logísticos%'
   OR kpi_name ILIKE '%Costos%transporte%';

-- Verify the update
SELECT 'kpis_dura' as table_name, id, kpi_name, goal, unit
FROM kpis_dura
WHERE kpi_name ILIKE '%Costos%logísticos%'
   OR kpi_name ILIKE '%Costos%transporte%'
UNION ALL
SELECT 'kpis_orsega' as table_name, id, kpi_name, goal, unit
FROM kpis_orsega
WHERE kpi_name ILIKE '%Costos%logísticos%'
   OR kpi_name ILIKE '%Costos%transporte%';

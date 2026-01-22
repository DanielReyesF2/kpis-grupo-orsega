-- Script para corregir la meta de Tasa de Retención de Clientes a 90%
-- Fecha: 2026-01-22

-- Actualizar en kpis_orsega (Grupo Orsega)
UPDATE kpis_orsega
SET goal = '90%',
    target = '90%'
WHERE LOWER(kpi_name) LIKE '%retención%clientes%'
   OR LOWER(kpi_name) LIKE '%retencion%clientes%'
   OR LOWER(kpi_name) LIKE '%tasa de retención%'
   OR LOWER(kpi_name) LIKE '%retention%';

-- Actualizar en kpis_dura (Dura International) también por consistencia
UPDATE kpis_dura
SET goal = '90%',
    target = '90%'
WHERE LOWER(kpi_name) LIKE '%retención%clientes%'
   OR LOWER(kpi_name) LIKE '%retencion%clientes%'
   OR LOWER(kpi_name) LIKE '%tasa de retención%'
   OR LOWER(kpi_name) LIKE '%retention%';

-- Verificar los cambios
SELECT 'ORSEGA' as empresa, id, kpi_name, goal, target
FROM kpis_orsega
WHERE LOWER(kpi_name) LIKE '%retención%' OR LOWER(kpi_name) LIKE '%retencion%'
UNION ALL
SELECT 'DURA' as empresa, id, kpi_name, goal, target
FROM kpis_dura
WHERE LOWER(kpi_name) LIKE '%retención%' OR LOWER(kpi_name) LIKE '%retencion%';

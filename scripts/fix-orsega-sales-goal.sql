-- Script para corregir el goal del KPI de Volumen de Ventas de Orsega
-- Problema: Goal mensual está en 55,000 cuando debería ser ~858,373
-- Esto causa que el porcentaje de ventas se muestre como 1292% en lugar de ~83%

-- Primero verificar el KPI actual
SELECT
  id,
  "kpiName",
  goal,
  "companyId",
  "updatedAt"
FROM "Kpi"
WHERE id = 1 AND "companyId" = 2;

-- Actualizar el goal mensual a 858,373 (objetivo anual 10,300,476)
UPDATE "Kpi"
SET
  goal = '858373',
  "updatedAt" = NOW()
WHERE id = 1 AND "companyId" = 2;

-- Verificar el cambio
SELECT
  id,
  "kpiName",
  goal,
  "companyId",
  "updatedAt"
FROM "Kpi"
WHERE id = 1 AND "companyId" = 2;

-- Resultado esperado:
-- Antes: goal = '55000' → Objetivo anual = 660,000 → 8,527,860 / 660,000 = 1292%
-- Después: goal = '858373' → Objetivo anual = 10,300,476 → 8,527,860 / 10,300,476 = 83%

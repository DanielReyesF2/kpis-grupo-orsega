-- =====================================================
-- SETUP COMPLETO - KPIs de Logística
-- =====================================================
-- Este script hace TODO lo necesario en un solo paso:
-- 1. Agrega columnas a tabla shipments
-- 2. Crea 3 KPIs para Dura International (ID: 1)
-- 3. Crea 3 KPIs para Grupo Orsega (ID: 2)
-- Total: 6 KPIs para Thalia Rodríguez
-- =====================================================

-- PASO 1: Agregar columnas a tabla shipments
-- =====================================================
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS transport_cost REAL;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS in_route_at TIMESTAMP;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;

-- Verificar columnas
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'shipments'
AND column_name IN ('transport_cost', 'in_route_at', 'delivered_at');

-- PASO 2: Crear KPIs para DURA INTERNATIONAL (ID: 1)
-- =====================================================

INSERT INTO "Kpi" (name, description, goal, "companyId", "userId", category, frequency, "createdAt", "updatedAt")
VALUES
  ('Costo de Transporte', 'Costo promedio por envío (MXN)', '5000', 1, 7, 'Logística', 'monthly', NOW(), NOW()),
  ('Tiempo de Preparación', 'Tiempo promedio desde creación hasta envío (horas)', '24', 1, 7, 'Logística', 'monthly', NOW(), NOW()),
  ('Tiempo de Entrega', 'Tiempo promedio desde envío hasta entrega (horas)', '48', 1, 7, 'Logística', 'monthly', NOW(), NOW());

-- PASO 3: Crear KPIs para GRUPO ORSEGA (ID: 2)
-- =====================================================

INSERT INTO "Kpi" (name, description, goal, "companyId", "userId", category, frequency, "createdAt", "updatedAt")
VALUES
  ('Costo de Transporte', 'Costo promedio por envío (MXN)', '5000', 2, 7, 'Logística', 'monthly', NOW(), NOW()),
  ('Tiempo de Preparación', 'Tiempo promedio desde creación hasta envío (horas)', '24', 2, 7, 'Logística', 'monthly', NOW(), NOW()),
  ('Tiempo de Entrega', 'Tiempo promedio desde envío hasta entrega (horas)', '48', 2, 7, 'Logística', 'monthly', NOW(), NOW());

-- VERIFICACIÓN FINAL
-- =====================================================

-- Ver columnas agregadas
\echo '\n===== COLUMNAS AGREGADAS A SHIPMENTS ====='
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'shipments'
AND column_name IN ('transport_cost', 'in_route_at', 'delivered_at');

-- Ver KPIs creados
\echo '\n===== KPIs DE LOGÍSTICA CREADOS ====='
SELECT
  id,
  name,
  goal,
  "companyId",
  CASE
    WHEN "companyId" = 1 THEN 'Dura International'
    WHEN "companyId" = 2 THEN 'Grupo Orsega'
    ELSE 'Otra'
  END as empresa,
  "userId",
  category,
  frequency
FROM "Kpi"
WHERE category = 'Logística'
AND "userId" = 7
ORDER BY "companyId", name;

\echo '\n===== RESUMEN ====='
SELECT
  COUNT(*) as total_kpis,
  COUNT(DISTINCT "companyId") as empresas,
  STRING_AGG(DISTINCT name, ', ') as kpis_creados
FROM "Kpi"
WHERE category = 'Logística'
AND "userId" = 7;

\echo '\n✅ Setup completo! Deberías ver 6 KPIs (3 por cada empresa)'

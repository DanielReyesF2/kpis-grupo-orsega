-- =====================================================
-- SETUP COMPLETO - KPIs de Logística
-- Para ejecutar en Neon Console
-- =====================================================

-- PASO 1: Agregar columnas a tabla shipments
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS transport_cost REAL;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS in_route_at TIMESTAMP;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;

-- PASO 2: Crear KPIs para DURA INTERNATIONAL (ID: 1)
INSERT INTO "Kpi" (name, description, goal, "companyId", "userId", category, frequency, "createdAt", "updatedAt")
VALUES
  ('Costo de Transporte', 'Costo promedio por envío (MXN)', '5000', 1, 7, 'Logística', 'monthly', NOW(), NOW()),
  ('Tiempo de Preparación', 'Tiempo promedio desde creación hasta envío (horas)', '24', 1, 7, 'Logística', 'monthly', NOW(), NOW()),
  ('Tiempo de Entrega', 'Tiempo promedio desde envío hasta entrega (horas)', '48', 1, 7, 'Logística', 'monthly', NOW(), NOW());

-- PASO 3: Crear KPIs para GRUPO ORSEGA (ID: 2)
INSERT INTO "Kpi" (name, description, goal, "companyId", "userId", category, frequency, "createdAt", "updatedAt")
VALUES
  ('Costo de Transporte', 'Costo promedio por envío (MXN)', '5000', 2, 7, 'Logística', 'monthly', NOW(), NOW()),
  ('Tiempo de Preparación', 'Tiempo promedio desde creación hasta envío (horas)', '24', 2, 7, 'Logística', 'monthly', NOW(), NOW()),
  ('Tiempo de Entrega', 'Tiempo promedio desde envío hasta entrega (horas)', '48', 2, 7, 'Logística', 'monthly', NOW(), NOW());

-- VERIFICACIÓN: Ver KPIs creados
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



-- =====================================================
-- Script para crear KPIs de Logística automatizados
-- =====================================================
--
-- CONFIGURACIÓN:
-- - Usuario: Thalia Rodríguez (ID: 7)
-- - Se crearán KPIs para AMBAS empresas (ejecutar 2 veces, una por empresa)
--
-- INSTRUCCIONES:
-- 1. Primero obtén los IDs de las empresas ejecutando:
--    SELECT id, name FROM "Company" ORDER BY id;
--
-- 2. Reemplaza [COMPANY_ID] con el ID de cada empresa:
--    - Grupo Orsega: ?
--    - Dura International: ?
--
-- 3. Ejecuta este script UNA VEZ por cada empresa
--
-- NOTA: Estos KPIs se actualizarán automáticamente cuando
-- Thalia mueva tarjetas del Kanban a "Entregado"
-- =====================================================

-- KPI 1: Costo de Transporte (PROMEDIO POR ENVÍO)
-- Mide el costo promedio por transporte individual
INSERT INTO "Kpi" (
  name,
  description,
  goal,
  "companyId",
  "userId",
  category,
  frequency,
  "createdAt",
  "updatedAt"
) VALUES (
  'Costo de Transporte',
  'Costo promedio por envío (MXN)',
  '5000', -- Meta por defecto: $5,000 MXN por transporte (EDITABLE DESDE UI)
  [COMPANY_ID], -- Reemplazar con ID de empresa (Orsega o Dura)
  7, -- Thalia Rodríguez
  'Logística',
  'monthly',
  NOW(),
  NOW()
);

-- KPI 2: Tiempo de Preparación
-- Mide el tiempo promedio desde creación hasta que sale (en horas)
INSERT INTO "Kpi" (
  name,
  description,
  goal,
  "companyId",
  "userId",
  category,
  frequency,
  "createdAt",
  "updatedAt"
) VALUES (
  'Tiempo de Preparación',
  'Tiempo promedio desde creación hasta envío (horas)',
  '24', -- Meta: 24 horas (EDITABLE DESDE UI)
  [COMPANY_ID], -- Reemplazar con ID de empresa (Orsega o Dura)
  7, -- Thalia Rodríguez
  'Logística',
  'monthly',
  NOW(),
  NOW()
);

-- KPI 3: Tiempo de Entrega
-- Mide el tiempo promedio desde que sale hasta que se entrega (en horas)
INSERT INTO "Kpi" (
  name,
  description,
  goal,
  "companyId",
  "userId",
  category,
  frequency,
  "createdAt",
  "updatedAt"
) VALUES (
  'Tiempo de Entrega',
  'Tiempo promedio desde envío hasta entrega (horas)',
  '48', -- Meta: 48 horas (EDITABLE DESDE UI)
  [COMPANY_ID], -- Reemplazar con ID de empresa (Orsega o Dura)
  7, -- Thalia Rodríguez
  'Logística',
  'monthly',
  NOW(),
  NOW()
);

-- =====================================================
-- Verificar que los KPIs se crearon correctamente
-- =====================================================
SELECT
  id,
  name,
  goal,
  "companyId",
  "userId",
  category
FROM "Kpi"
WHERE category = 'Logística'
AND "userId" = 7
ORDER BY "companyId", id DESC;

-- =====================================================
-- DESPUÉS DE CREAR PARA AMBAS EMPRESAS:
-- Deberías ver 6 KPIs en total (3 por cada empresa)
-- =====================================================

-- =====================================================
-- Script para crear KPIs de Logística automatizados
-- =====================================================
--
-- INSTRUCCIONES:
-- 1. Reemplaza [USER_ID_THALIA] con el ID real de Thalia
-- 2. Reemplaza [COMPANY_ID] con el ID de la empresa (1=Digocel, 2=Orsega)
-- 3. Ejecuta este script en tu base de datos Neon
--
-- NOTA: Estos KPIs se actualizarán automáticamente cuando
-- Thalia mueva tarjetas del Kanban a "Entregado"
-- =====================================================

-- KPI 1: Costo de Transporte
-- Mide el costo total mensual de todos los envíos
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
  'Costo total mensual de envíos (MXN)',
  '50000', -- Meta: $50,000 MXN/mes (ajustar según necesidad)
  [COMPANY_ID], -- Reemplazar con ID de empresa
  [USER_ID_THALIA], -- Reemplazar con ID de Thalia
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
  '24', -- Meta: 24 horas
  [COMPANY_ID], -- Reemplazar con ID de empresa
  [USER_ID_THALIA], -- Reemplazar con ID de Thalia
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
  '48', -- Meta: 48 horas (2 días)
  [COMPANY_ID], -- Reemplazar con ID de empresa
  [USER_ID_THALIA], -- Reemplazar con ID de Thalia
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
ORDER BY id DESC
LIMIT 3;

-- =====================================================
-- KPIs de Logística para DURA INTERNATIONAL (ID: 1)
-- =====================================================
-- Usuario: Thalia Rodríguez (ID: 7)
-- Empresa: Dura International (ID: 1)
-- =====================================================

-- KPI 1: Costo de Transporte (PROMEDIO POR ENVÍO)
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
  '5000',
  1, -- Dura International
  7, -- Thalia Rodríguez
  'Logística',
  'monthly',
  NOW(),
  NOW()
);

-- KPI 2: Tiempo de Preparación
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
  '24',
  1, -- Dura International
  7, -- Thalia Rodríguez
  'Logística',
  'monthly',
  NOW(),
  NOW()
);

-- KPI 3: Tiempo de Entrega
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
  '48',
  1, -- Dura International
  7, -- Thalia Rodríguez
  'Logística',
  'monthly',
  NOW(),
  NOW()
);

-- Verificar creación
SELECT
  id,
  name,
  goal,
  "companyId",
  "userId",
  category
FROM "Kpi"
WHERE category = 'Logística'
AND "companyId" = 1
ORDER BY id DESC;

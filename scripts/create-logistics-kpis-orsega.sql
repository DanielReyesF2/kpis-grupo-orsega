-- =====================================================
-- KPIs de Logística para GRUPO ORSEGA (ID: 2)
-- =====================================================
-- Usuario: Thalia Rodríguez (ID: 7)
-- Empresa: Grupo Orsega (ID: 2)
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
  2, -- Grupo Orsega
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
  2, -- Grupo Orsega
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
  2, -- Grupo Orsega
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
AND "companyId" = 2
ORDER BY id DESC;

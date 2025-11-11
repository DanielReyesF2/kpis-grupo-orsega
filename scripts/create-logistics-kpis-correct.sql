-- =====================================================
-- CREAR KPIs DE LOGÍSTICA - ESTRUCTURA CORRECTA
-- =====================================================
-- Usa las tablas: kpis_dura y kpis_orsega
-- =====================================================

-- 1. CREAR KPIs PARA DURA INTERNATIONAL (kpis_dura)
-- =====================================================
INSERT INTO kpis_dura (
  area,
  kpi_name,
  description,
  goal,
  unit,
  frequency,
  responsible,
  period,
  created_at
) VALUES
  (
    'Logística',
    'Costo de Transporte',
    'Costo promedio por envío individual (MXN)',
    '5000',
    'MXN',
    'monthly',
    'Thalia Rodríguez',
    'mensual',
    NOW()
  ),
  (
    'Logística',
    'Tiempo de Preparación',
    'Tiempo promedio desde creación hasta envío (horas)',
    '24',
    'horas',
    'monthly',
    'Thalia Rodríguez',
    'mensual',
    NOW()
  ),
  (
    'Logística',
    'Tiempo de Entrega',
    'Tiempo promedio desde envío hasta entrega (horas)',
    '48',
    'horas',
    'monthly',
    'Thalia Rodríguez',
    'mensual',
    NOW()
  );

-- 2. CREAR KPIs PARA GRUPO ORSEGA (kpis_orsega)
-- =====================================================
INSERT INTO kpis_orsega (
  area,
  kpi_name,
  description,
  goal,
  unit,
  frequency,
  responsible,
  period,
  created_at
) VALUES
  (
    'Logística',
    'Costo de Transporte',
    'Costo promedio por envío individual (MXN)',
    '5000',
    'MXN',
    'monthly',
    'Thalia Rodríguez',
    'mensual',
    NOW()
  ),
  (
    'Logística',
    'Tiempo de Preparación',
    'Tiempo promedio desde creación hasta envío (horas)',
    '24',
    'horas',
    'monthly',
    'Thalia Rodríguez',
    'mensual',
    NOW()
  ),
  (
    'Logística',
    'Tiempo de Entrega',
    'Tiempo promedio desde envío hasta entrega (horas)',
    '48',
    'horas',
    'monthly',
    'Thalia Rodríguez',
    'mensual',
    NOW()
  );

-- 3. VERIFICACIÓN
-- =====================================================
SELECT 
  'KPIs DURA' as empresa,
  id,
  area,
  kpi_name,
  goal,
  unit,
  responsible
FROM kpis_dura
WHERE area = 'Logística'
ORDER BY kpi_name;

SELECT 
  'KPIs ORSEGA' as empresa,
  id,
  area,
  kpi_name,
  goal,
  unit,
  responsible
FROM kpis_orsega
WHERE area = 'Logística'
ORDER BY kpi_name;



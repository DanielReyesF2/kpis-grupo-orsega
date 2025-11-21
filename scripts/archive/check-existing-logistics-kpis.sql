-- =====================================================
-- VERIFICAR KPIs DE LOGÍSTICA EXISTENTES
-- =====================================================

-- Ver KPIs de Logística en Dura International
SELECT 
  id,
  area,
  kpi_name,
  description,
  goal,
  unit,
  frequency,
  responsible,
  calculation_method
FROM kpis_dura
WHERE area = 'Logística'
ORDER BY kpi_name;

-- Ver KPIs de Logística en Grupo Orsega
SELECT 
  id,
  area,
  kpi_name,
  description,
  goal,
  unit,
  frequency,
  responsible,
  calculation_method
FROM kpis_orsega
WHERE area = 'Logística'
ORDER BY kpi_name;



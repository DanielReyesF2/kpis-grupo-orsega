-- Ver KPIs de Logística en Orsega
SELECT 
  id,
  area,
  kpi_name,
  description,
  goal,
  unit,
  frequency,
  responsible
FROM kpis_orsega
WHERE area = 'Logística'
ORDER BY kpi_name;



-- =====================================================
-- TEST: Verificar formato de datos que devuelve el backend
-- =====================================================

-- Simular lo que devuelve mapKpiValueRecord para Dura
SELECT 
  kv.id,
  kv.kpi_id as "kpiId",
  kv.value::text as value,
  CASE 
    WHEN kv.month IS NOT NULL AND kv.year IS NOT NULL 
    THEN INITCAP(kv.month) || ' ' || kv.year::text
    ELSE NULL
  END as period,
  kv.created_at as date,
  kv.compliance_percentage as "compliancePercentage",
  kv.status,
  kv.comments,
  kv.updated_by as "updatedBy",
  kv.month,
  kv.year,
  1 as "companyId"
FROM kpi_values_dura kv
JOIN kpis_dura k ON kv.kpi_id = k.id
WHERE k.area = 'Logística'
ORDER BY kv.year DESC, kv.month DESC, k.kpi_name
LIMIT 10;

-- Verificar que los KPIs tienen el formato correcto
SELECT 
  k.id,
  k.kpi_name as "kpiName",
  k.kpi_name as name,
  k.area,
  k.goal as target,
  k.goal,
  k.unit,
  k.frequency,
  k.responsible,
  1 as "companyId"
FROM kpis_dura k
WHERE k.area = 'Logística'
ORDER BY k.id;



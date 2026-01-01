-- ============================================
-- DIAGNÓSTICO: Verificar datos faltantes por empresa/año/mes
-- ============================================

-- 1. Vista general: Registros por empresa y año
SELECT
    CASE WHEN company_id = 1 THEN 'DURA' ELSE 'ORSEGA' END as empresa,
    sale_year as año,
    COUNT(*) as total_registros,
    ROUND(SUM(total_amount)::numeric, 2) as total_mxn
FROM sales_data
WHERE company_id IN (1, 2)
GROUP BY company_id, sale_year
ORDER BY company_id, sale_year;

-- 2. Detalle por mes para cada empresa (2022-2025)
SELECT
    CASE WHEN company_id = 1 THEN 'DURA' ELSE 'ORSEGA' END as empresa,
    sale_year as año,
    sale_month as mes,
    COUNT(*) as registros,
    ROUND(SUM(total_amount)::numeric, 2) as total_mxn
FROM sales_data
WHERE company_id IN (1, 2) AND sale_year >= 2022
GROUP BY company_id, sale_year, sale_month
ORDER BY company_id, sale_year, sale_month;

-- 3. Identificar meses FALTANTES para DURA (company_id = 1)
WITH all_months AS (
    SELECT generate_series(2022, 2025) as year_num,
           generate_series(1, 12) as month_num
),
dura_data AS (
    SELECT DISTINCT sale_year, sale_month
    FROM sales_data
    WHERE company_id = 1
)
SELECT
    'DURA' as empresa,
    am.year_num as año,
    am.month_num as mes,
    CASE WHEN dd.sale_year IS NULL THEN '❌ FALTA' ELSE '✓ OK' END as estado
FROM (SELECT DISTINCT year_num, month_num FROM all_months, generate_series(1,12) as m(month_num) WHERE year_num >= 2022) am
CROSS JOIN LATERAL (SELECT generate_series(1,12)) as months(month_num)
LEFT JOIN dura_data dd ON am.year_num = dd.sale_year AND am.month_num = dd.sale_month
WHERE am.year_num <= 2025
ORDER BY am.year_num, am.month_num;

-- 4. Identificar meses FALTANTES para ORSEGA (company_id = 2)
WITH orsega_data AS (
    SELECT DISTINCT sale_year, sale_month
    FROM sales_data
    WHERE company_id = 2
)
SELECT
    'ORSEGA' as empresa,
    y.year_num as año,
    m.month_num as mes,
    CASE WHEN od.sale_year IS NULL THEN '❌ FALTA' ELSE '✓ OK' END as estado
FROM generate_series(2022, 2025) as y(year_num)
CROSS JOIN generate_series(1, 12) as m(month_num)
LEFT JOIN orsega_data od ON y.year_num = od.sale_year AND m.month_num = od.sale_month
WHERE NOT (y.year_num = 2025 AND m.month_num > 12)  -- No verificar meses futuros
ORDER BY y.year_num, m.month_num;

-- 5. Resumen simple: ¿Qué meses tienen datos?
SELECT
    CASE WHEN company_id = 1 THEN 'DURA' ELSE 'ORSEGA' END as empresa,
    sale_year as año,
    STRING_AGG(DISTINCT sale_month::text, ', ' ORDER BY sale_month::text) as meses_con_datos
FROM sales_data
WHERE company_id IN (1, 2) AND sale_year >= 2022
GROUP BY company_id, sale_year
ORDER BY company_id, sale_year;

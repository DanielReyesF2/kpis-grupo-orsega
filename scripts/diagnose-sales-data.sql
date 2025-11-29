-- ============================================
-- SCRIPT DE DIAGNÓSTICO: sales_data
-- ============================================
-- Este script verifica el estado de los datos en sales_data
-- para diagnosticar por qué no se muestran datos en el módulo de ventas
-- ============================================

-- 1. Total de registros por company_id
SELECT 
    company_id,
    COUNT(*) as total_registros,
    COUNT(DISTINCT client_id) as clientes_unicos,
    COUNT(DISTINCT product_id) as productos_unicos
FROM sales_data
GROUP BY company_id
ORDER BY company_id;

-- 2. Registros con company_id NULL o incorrecto
SELECT 
    COUNT(*) as registros_sin_company_id
FROM sales_data
WHERE company_id IS NULL OR company_id NOT IN (1, 2);

-- 3. Rango de fechas en sales_data
SELECT 
    MIN(sale_date) as fecha_minima,
    MAX(sale_date) as fecha_maxima,
    MIN(sale_year) as año_minimo,
    MAX(sale_year) as año_maximo,
    MIN(sale_month) as mes_minimo,
    MAX(sale_month) as mes_maximo
FROM sales_data;

-- 4. Distribución de datos por año y mes (últimos 3 años)
SELECT 
    sale_year,
    sale_month,
    COUNT(*) as total_registros,
    SUM(quantity) as volumen_total,
    COUNT(DISTINCT client_id) as clientes_unicos
FROM sales_data
WHERE sale_year >= EXTRACT(YEAR FROM CURRENT_DATE) - 2
GROUP BY sale_year, sale_month
ORDER BY sale_year DESC, sale_month DESC;

-- 5. Datos específicos para Dura International (company_id = 1)
SELECT 
    COUNT(*) as total_registros_dura,
    MIN(sale_date) as fecha_minima_dura,
    MAX(sale_date) as fecha_maxima_dura,
    SUM(quantity) as volumen_total_dura,
    COUNT(DISTINCT client_id) as clientes_unicos_dura,
    COUNT(DISTINCT product_id) as productos_unicos_dura
FROM sales_data
WHERE company_id = 1;

-- 6. Verificar registros del mes actual (enero 2025)
SELECT 
    COUNT(*) as registros_mes_actual,
    SUM(quantity) as volumen_mes_actual,
    COUNT(DISTINCT client_id) as clientes_mes_actual
FROM sales_data
WHERE company_id = 1
    AND sale_year = EXTRACT(YEAR FROM CURRENT_DATE)
    AND sale_month = EXTRACT(MONTH FROM CURRENT_DATE);

-- 7. Verificar registros de últimos 12 meses
SELECT 
    COUNT(*) as registros_ultimos_12_meses,
    SUM(quantity) as volumen_ultimos_12_meses,
    COUNT(DISTINCT client_id) as clientes_ultimos_12_meses
FROM sales_data
WHERE company_id = 1
    AND sale_date >= CURRENT_DATE - INTERVAL '12 months'
    AND sale_date <= CURRENT_DATE;

-- 8. Verificar registros de últimos 3 meses
SELECT 
    COUNT(*) as registros_ultimos_3_meses,
    SUM(quantity) as volumen_ultimos_3_meses,
    COUNT(DISTINCT client_id) as clientes_ultimos_3_meses
FROM sales_data
WHERE company_id = 1
    AND sale_date >= CURRENT_DATE - INTERVAL '3 months'
    AND sale_date <= CURRENT_DATE;

-- 9. Verificar inconsistencias en fechas
SELECT 
    COUNT(*) as registros_con_fecha_incorrecta
FROM sales_data
WHERE company_id = 1
    AND (
        EXTRACT(YEAR FROM sale_date) != sale_year
        OR EXTRACT(MONTH FROM sale_date) != sale_month
    );

-- 10. Último mes con datos disponibles
SELECT 
    sale_year,
    sale_month,
    COUNT(*) as registros,
    SUM(quantity) as volumen
FROM sales_data
WHERE company_id = 1
GROUP BY sale_year, sale_month
ORDER BY sale_year DESC, sale_month DESC
LIMIT 1;

-- 11. Comparación: ¿Hay datos en ventas_dura que no se migraron?
-- (Solo si la tabla ventas_dura todavía existe)
SELECT 
    COUNT(*) as registros_en_ventas_dura
FROM information_schema.tables 
WHERE table_name = 'ventas_dura';

-- Si existe ventas_dura, comparar conteos
-- SELECT 
--     (SELECT COUNT(*) FROM ventas_dura WHERE company_id = 1) as total_ventas_dura,
--     (SELECT COUNT(*) FROM sales_data WHERE company_id = 1) as total_sales_data,
--     (SELECT COUNT(*) FROM ventas_dura WHERE company_id = 1) - 
--     (SELECT COUNT(*) FROM sales_data WHERE company_id = 1) as diferencia;


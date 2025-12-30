-- ============================================
-- MIGRACIÓN: Copiar datos de ventas a sales_data
-- ============================================
-- Este script copia los datos de la tabla 'ventas' a 'sales_data'
-- para que todos los endpoints existentes funcionen correctamente
--
-- IMPORTANTE: Ejecutar en Neon SQL Editor
-- ============================================

-- PASO 1: Verificar estado actual
SELECT '=== ESTADO ANTES DE MIGRACIÓN ===' as info;
SELECT
    'ventas' as tabla,
    COUNT(*) as registros,
    MIN(fecha) as fecha_inicio,
    MAX(fecha) as fecha_fin
FROM ventas
UNION ALL
SELECT
    'sales_data' as tabla,
    COUNT(*) as registros,
    MIN(sale_date) as fecha_inicio,
    MAX(sale_date) as fecha_fin
FROM sales_data;

-- PASO 2: Primero crear clientes que no existen en la tabla clients
INSERT INTO clients (company_id, name, is_active, created_at)
SELECT DISTINCT
    v.company_id,
    v.cliente,
    true,
    NOW()
FROM ventas v
WHERE NOT EXISTS (
    SELECT 1 FROM clients c
    WHERE c.company_id = v.company_id
    AND UPPER(TRIM(c.name)) = UPPER(TRIM(v.cliente))
)
ON CONFLICT DO NOTHING;

-- PASO 3: Insertar datos de ventas a sales_data con client_id vinculado
INSERT INTO sales_data (
    company_id,
    client_id,
    client_name,
    product_name,
    quantity,
    unit,
    sale_date,
    sale_month,
    sale_year,
    sale_week,
    invoice_number,
    folio,
    unit_price,
    total_amount,
    created_at,
    updated_at
)
SELECT
    v.company_id,
    c.id as client_id,
    v.cliente as client_name,
    COALESCE(v.producto, 'SIN PRODUCTO') as product_name,
    COALESCE(v.cantidad, 0) as quantity,
    COALESCE(v.unidad, 'KG') as unit,
    v.fecha as sale_date,
    v.mes as sale_month,
    v.anio as sale_year,
    EXTRACT(WEEK FROM v.fecha)::INTEGER as sale_week,
    v.factura as invoice_number,
    v.folio,
    v.precio_unitario as unit_price,
    COALESCE(v.importe_mn, v.importe, v.usd * COALESCE(v.tipo_cambio, 17.0)) as total_amount,
    COALESCE(v.created_at, NOW()),
    COALESCE(v.updated_at, NOW())
FROM ventas v
LEFT JOIN clients c ON c.company_id = v.company_id AND UPPER(TRIM(c.name)) = UPPER(TRIM(v.cliente))
WHERE NOT EXISTS (
    SELECT 1 FROM sales_data sd
    WHERE sd.company_id = v.company_id
    AND sd.sale_date = v.fecha
    AND sd.client_name = v.cliente
    AND COALESCE(sd.invoice_number, '') = COALESCE(v.factura, '')
);

-- PASO 4: Verificar estado después de migración
SELECT '=== ESTADO DESPUÉS DE MIGRACIÓN ===' as info;
SELECT
    company_id,
    CASE company_id WHEN 1 THEN 'DURA' WHEN 2 THEN 'ORSEGA' END as empresa,
    COUNT(*) as total_registros,
    COUNT(client_id) as registros_con_client_id,
    MIN(sale_date) as fecha_inicio,
    MAX(sale_date) as fecha_fin,
    COUNT(DISTINCT sale_year) as años_con_datos
FROM sales_data
GROUP BY company_id
ORDER BY company_id;

-- PASO 5: Resumen por año y empresa
SELECT
    company_id,
    CASE company_id WHEN 1 THEN 'DURA' WHEN 2 THEN 'ORSEGA' END as empresa,
    sale_year as anio,
    COUNT(*) as registros,
    COUNT(DISTINCT client_name) as clientes_unicos,
    ROUND(SUM(quantity)::numeric, 2) as total_cantidad,
    ROUND(SUM(COALESCE(total_amount, 0))::numeric, 2) as total_importe
FROM sales_data
GROUP BY company_id, sale_year
ORDER BY company_id, sale_year;

-- PASO 6: Verificar clientes vinculados
SELECT '=== CLIENTES VINCULADOS ===' as info;
SELECT
    company_id,
    CASE company_id WHEN 1 THEN 'DURA' WHEN 2 THEN 'ORSEGA' END as empresa,
    COUNT(*) as total_registros,
    COUNT(client_id) as con_client_id,
    COUNT(*) - COUNT(client_id) as sin_client_id,
    ROUND(COUNT(client_id)::numeric / COUNT(*)::numeric * 100, 1) as porcentaje_vinculado
FROM sales_data
GROUP BY company_id
ORDER BY company_id;

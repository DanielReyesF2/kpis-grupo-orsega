-- ============================================
-- SCRIPT MAESTRO: Migración a tabla unificada VENTAS
-- ============================================
-- Ejecutar este script en Neon para completar toda la migración
-- ============================================

-- PASO 1: Crear tabla unificada VENTAS
-- ============================================

BEGIN;

-- 1. Crear la tabla unificada VENTAS
CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL DEFAULT 1,

    -- Datos de la factura
    fecha DATE NOT NULL,
    folio VARCHAR(50),
    factura VARCHAR(50),

    -- Cliente
    cliente VARCHAR(255) NOT NULL,

    -- Producto
    producto VARCHAR(255),
    familia_producto VARCHAR(100),

    -- Cantidades
    cantidad DECIMAL(15, 3),
    unidad VARCHAR(20) DEFAULT 'KG',

    -- Precios y montos
    precio_unitario DECIMAL(15, 4),
    importe DECIMAL(15, 2),
    usd DECIMAL(15, 2),
    mn DECIMAL(15, 2),
    tipo_cambio DECIMAL(10, 4),
    importe_mn DECIMAL(15, 2),

    -- Campos calculados (año/mes para queries rápidas)
    anio SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR FROM fecha)::SMALLINT) STORED,
    mes SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM fecha)::SMALLINT) STORED,

    -- Comparativos históricos (opcionales)
    venta_2024 DECIMAL(15, 2),
    venta_2025 DECIMAL(15, 2),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Crear índices
CREATE INDEX IF NOT EXISTS idx_ventas_company_id ON ventas(company_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(company_id, cliente);
CREATE INDEX IF NOT EXISTS idx_ventas_producto ON ventas(company_id, producto);
CREATE INDEX IF NOT EXISTS idx_ventas_anio_mes ON ventas(company_id, anio DESC, mes DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente_anio ON ventas(company_id, cliente, anio);

COMMIT;

-- PASO 2: Migrar datos de DURA (ventas_dura → ventas)
-- ============================================

BEGIN;

INSERT INTO ventas (
    company_id,
    fecha,
    folio,
    cliente,
    producto,
    cantidad,
    unidad,
    precio_unitario,
    importe,
    venta_2024,
    venta_2025,
    created_at
)
SELECT
    1 as company_id,  -- DURA = 1
    fecha,
    folio,
    cliente,
    producto,
    cantidad,
    'KG' as unidad,
    precio_unitario,
    importe,
    venta_2024,
    venta_2025,
    COALESCE(created_at, CURRENT_TIMESTAMP)
FROM ventas_dura
WHERE fecha IS NOT NULL
  AND cliente IS NOT NULL
  AND TRIM(cliente) != ''
ON CONFLICT DO NOTHING;

COMMIT;

-- PASO 3: Crear vista de compatibilidad
-- ============================================

DROP VIEW IF EXISTS sales_data_view CASCADE;

CREATE OR REPLACE VIEW sales_data_view AS
SELECT
    v.id,
    v.company_id,
    NULL::VARCHAR(10) as submodulo,
    NULL::INTEGER as client_id,
    v.cliente as client_name,
    NULL::INTEGER as product_id,
    v.producto as product_name,
    v.cantidad as quantity,
    v.unidad as unit,
    v.fecha as sale_date,
    v.mes as sale_month,
    v.anio as sale_year,
    EXTRACT(WEEK FROM v.fecha)::INTEGER as sale_week,
    v.factura as invoice_number,
    v.folio,
    v.precio_unitario as unit_price,
    COALESCE(v.importe, v.importe_mn) as total_amount,
    v.venta_2024 as quantity_2024,
    v.venta_2025 as quantity_2025,
    v.tipo_cambio,
    v.importe_mn,
    NULL::TEXT as notes,
    NULL::INTEGER as upload_id,
    v.created_at,
    v.updated_at
FROM ventas v;

-- VERIFICACIÓN FINAL
-- ============================================

SELECT '=== RESUMEN DE MIGRACIÓN ===' as info;

SELECT
    company_id,
    CASE company_id WHEN 1 THEN 'DURA' WHEN 2 THEN 'ORSEGA' ELSE 'OTRO' END as empresa,
    COUNT(*) as total_registros,
    MIN(fecha) as fecha_inicio,
    MAX(fecha) as fecha_fin,
    COUNT(DISTINCT cliente) as clientes_unicos,
    COUNT(DISTINCT producto) as productos_unicos
FROM ventas
GROUP BY company_id
ORDER BY company_id;

SELECT '=== DATOS DE ORSEGA PENDIENTES ===' as info;
SELECT 'Ejecuta orsega-inserts.sql para agregar los datos de ORSEGA' as nota;

-- ============================================
-- MIGRACIÓN: Crear tabla unificada VENTAS
-- ============================================
-- Una sola tabla para TODOS los datos de ventas
-- company_id = 1 → DURA
-- company_id = 2 → ORSEGA
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

-- 2. Crear índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_ventas_company_id ON ventas(company_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(company_id, cliente);
CREATE INDEX IF NOT EXISTS idx_ventas_producto ON ventas(company_id, producto);
CREATE INDEX IF NOT EXISTS idx_ventas_anio_mes ON ventas(company_id, anio DESC, mes DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente_anio ON ventas(company_id, cliente, anio);

-- 3. Comentarios para documentación
COMMENT ON TABLE ventas IS 'Tabla unificada de ventas para todas las empresas del grupo';
COMMENT ON COLUMN ventas.company_id IS '1=DURA, 2=ORSEGA';
COMMENT ON COLUMN ventas.anio IS 'Año extraído automáticamente de fecha';
COMMENT ON COLUMN ventas.mes IS 'Mes extraído automáticamente de fecha';

COMMIT;

-- 4. Crear vista de compatibilidad con el código existente
-- Esta vista permite que el código que usa "sales_data" siga funcionando
DROP VIEW IF EXISTS sales_data_view CASCADE;

CREATE OR REPLACE VIEW sales_data_view AS
SELECT
    v.id,
    v.company_id,
    NULL::VARCHAR(10) as submodulo,
    NULL::INTEGER as client_id,  -- No tenemos FK a clients
    v.cliente as client_name,
    NULL::INTEGER as product_id,  -- No tenemos FK a products
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

COMMENT ON VIEW sales_data_view IS 'Vista de compatibilidad - mapea ventas a estructura sales_data';

COMMIT;

-- Verificar creación
SELECT
    'Tabla ventas creada exitosamente' as status,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'ventas') as columnas;

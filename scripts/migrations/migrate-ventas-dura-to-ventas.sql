-- ============================================
-- MIGRACIÓN: ventas_dura → ventas
-- ============================================
-- Mueve todos los datos de DURA a la tabla unificada
-- company_id = 1 para DURA
-- ============================================

BEGIN;

-- Verificar que la tabla ventas existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ventas') THEN
        RAISE EXCEPTION 'La tabla ventas no existe. Ejecuta primero create-unified-ventas.sql';
    END IF;
END $$;

-- Migrar datos de ventas_dura a ventas
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

-- Reportar resultados
DO $$
DECLARE
    count_dura INTEGER;
    count_ventas INTEGER;
BEGIN
    SELECT COUNT(*) INTO count_dura FROM ventas_dura;
    SELECT COUNT(*) INTO count_ventas FROM ventas WHERE company_id = 1;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRACIÓN COMPLETADA';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Registros en ventas_dura: %', count_dura;
    RAISE NOTICE 'Registros migrados a ventas (DURA): %', count_ventas;
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- Verificación final
SELECT
    'DURA' as empresa,
    COUNT(*) as total_registros,
    MIN(fecha) as fecha_inicio,
    MAX(fecha) as fecha_fin,
    COUNT(DISTINCT cliente) as clientes_unicos,
    COUNT(DISTINCT producto) as productos_unicos
FROM ventas
WHERE company_id = 1;

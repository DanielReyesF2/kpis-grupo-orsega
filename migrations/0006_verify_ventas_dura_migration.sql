-- MIGRATION: Verificación de migración ventas_dura → sales_data
-- Date: 2025-11-28
-- Description: Script de verificación para comparar datos entre ventas_dura y sales_data
--              Identifica registros no migrados, duplicados, y genera estadísticas

-- Este script NO modifica datos, solo genera reportes

DO $$
DECLARE
    target_company_id INTEGER := 1; -- Dura International
    total_ventas_dura INTEGER;
    total_sales_data INTEGER;
    total_clients_dura INTEGER;
    total_clients_system INTEGER;
    total_products_dura INTEGER;
    total_products_system INTEGER;
    missing_clients INTEGER;
    missing_products INTEGER;
    duplicate_records INTEGER;
    invalid_records INTEGER;
    min_date_dura DATE;
    max_date_dura DATE;
    min_date_sales DATE;
    max_date_sales DATE;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN DE MIGRACIÓN: VENTAS_DURA → SALES_DATA';
    RAISE NOTICE 'Company ID: % (Dura International)', target_company_id;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- 1. Conteos generales
    RAISE NOTICE '1. CONTEOS GENERALES';
    RAISE NOTICE '----------------------------------------';
    
    SELECT COUNT(*) INTO total_ventas_dura FROM ventas_dura;
    SELECT COUNT(*) INTO total_sales_data 
    FROM sales_data 
    WHERE company_id = target_company_id;
    
    RAISE NOTICE 'Registros en ventas_dura: %', total_ventas_dura;
    RAISE NOTICE 'Registros en sales_data (company_id=%): %', target_company_id, total_sales_data;
    RAISE NOTICE 'Diferencia: %', (total_ventas_dura - total_sales_data);
    RAISE NOTICE '';

    -- 2. Rango de fechas
    RAISE NOTICE '2. RANGO DE FECHAS';
    RAISE NOTICE '----------------------------------------';
    
    SELECT MIN(fecha), MAX(fecha) INTO min_date_dura, max_date_dura FROM ventas_dura;
    SELECT MIN(sale_date), MAX(sale_date) INTO min_date_sales, max_date_sales 
    FROM sales_data WHERE company_id = target_company_id;
    
    RAISE NOTICE 'ventas_dura: % a %', min_date_dura, max_date_dura;
    RAISE NOTICE 'sales_data: % a %', min_date_sales, max_date_sales;
    RAISE NOTICE '';

    -- 3. Clientes
    RAISE NOTICE '3. CLIENTES';
    RAISE NOTICE '----------------------------------------';
    
    SELECT COUNT(DISTINCT cliente) INTO total_clients_dura 
    FROM ventas_dura 
    WHERE cliente IS NOT NULL AND TRIM(cliente) != '';
    
    SELECT COUNT(*) INTO total_clients_system
    FROM clients
    WHERE company_id = target_company_id;
    
    -- Clientes en ventas_dura que no están en el sistema
    SELECT COUNT(*) INTO missing_clients
    FROM (
        SELECT DISTINCT TRIM(v.cliente) as cliente
        FROM ventas_dura v
        WHERE v.cliente IS NOT NULL AND TRIM(v.cliente) != ''
        EXCEPT
        SELECT TRIM(c.name)
        FROM clients c
        WHERE c.company_id = target_company_id
    ) missing;
    
    RAISE NOTICE 'Clientes únicos en ventas_dura: %', total_clients_dura;
    RAISE NOTICE 'Clientes en sistema (company_id=%): %', target_company_id, total_clients_system;
    RAISE NOTICE 'Clientes faltantes en sistema: %', missing_clients;
    RAISE NOTICE '';

    -- 4. Productos
    RAISE NOTICE '4. PRODUCTOS';
    RAISE NOTICE '----------------------------------------';
    
    SELECT COUNT(DISTINCT producto) INTO total_products_dura 
    FROM ventas_dura 
    WHERE producto IS NOT NULL AND TRIM(producto) != '';
    
    SELECT COUNT(*) INTO total_products_system
    FROM products
    WHERE company_id = target_company_id;
    
    -- Productos en ventas_dura que no están en el sistema
    SELECT COUNT(*) INTO missing_products
    FROM (
        SELECT DISTINCT TRIM(v.producto) as producto
        FROM ventas_dura v
        WHERE v.producto IS NOT NULL AND TRIM(v.producto) != ''
        EXCEPT
        SELECT TRIM(p.product_name)
        FROM products p
        WHERE p.company_id = target_company_id
    ) missing;
    
    RAISE NOTICE 'Productos únicos en ventas_dura: %', total_products_dura;
    RAISE NOTICE 'Productos en sistema (company_id=%): %', target_company_id, total_products_system;
    RAISE NOTICE 'Productos faltantes en sistema: %', missing_products;
    RAISE NOTICE '';

    -- 5. Registros duplicados en sales_data
    RAISE NOTICE '5. REGISTROS DUPLICADOS EN SALES_DATA';
    RAISE NOTICE '----------------------------------------';
    
    SELECT COUNT(*) INTO duplicate_records
    FROM (
        SELECT 
            company_id,
            client_name,
            product_name,
            sale_date,
            folio,
            quantity,
            COUNT(*) as dup_count
        FROM sales_data
        WHERE company_id = target_company_id
        GROUP BY company_id, client_name, product_name, sale_date, folio, quantity
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE 'Grupos de registros duplicados encontrados: %', duplicate_records;
    RAISE NOTICE '';

    -- 6. Registros inválidos en ventas_dura (que no se migraron)
    RAISE NOTICE '6. REGISTROS INVÁLIDOS EN VENTAS_DURA';
    RAISE NOTICE '----------------------------------------';
    
    SELECT COUNT(*) INTO invalid_records
    FROM ventas_dura v
    WHERE v.fecha IS NULL
       OR v.cliente IS NULL 
       OR TRIM(v.cliente) = ''
       OR v.producto IS NULL 
       OR TRIM(v.producto) = ''
       OR v.cantidad IS NULL 
       OR v.cantidad <= 0
       OR v.fecha < '2020-01-01'::DATE
       OR v.fecha > CURRENT_DATE + INTERVAL '1 year';
    
    RAISE NOTICE 'Registros con datos inválidos (no migrables): %', invalid_records;
    RAISE NOTICE '';

    -- 7. Estadísticas por año
    RAISE NOTICE '7. ESTADÍSTICAS POR AÑO';
    RAISE NOTICE '----------------------------------------';
    
    RAISE NOTICE 'VENTAS_DURA:';
    FOR rec IN 
        SELECT 
            anio,
            COUNT(*) as total,
            COUNT(DISTINCT cliente) as clientes,
            COUNT(DISTINCT producto) as productos,
            SUM(cantidad) as cantidad_total,
            SUM(importe) as importe_total
        FROM ventas_dura
        WHERE anio IS NOT NULL
        GROUP BY anio
        ORDER BY anio
    LOOP
        RAISE NOTICE '  %: % registros, % clientes, % productos, % KG, $%', 
            rec.anio, rec.total, rec.clientes, rec.productos, 
            ROUND(rec.cantidad_total::numeric, 2), 
            ROUND(rec.importe_total::numeric, 2);
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE 'SALES_DATA:';
    FOR rec IN 
        SELECT 
            sale_year,
            COUNT(*) as total,
            COUNT(DISTINCT client_name) as clientes,
            COUNT(DISTINCT product_name) as productos,
            SUM(quantity) as cantidad_total,
            SUM(total_amount) as importe_total
        FROM sales_data
        WHERE company_id = target_company_id
          AND sale_year IS NOT NULL
        GROUP BY sale_year
        ORDER BY sale_year
    LOOP
        RAISE NOTICE '  %: % registros, % clientes, % productos, % KG, $%', 
            rec.sale_year, rec.total, rec.clientes, rec.productos, 
            ROUND(rec.cantidad_total::numeric, 2), 
            ROUND(COALESCE(rec.importe_total, 0)::numeric, 2);
    END LOOP;
    RAISE NOTICE '';

    -- 8. Resumen final
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMEN FINAL';
    RAISE NOTICE '========================================';
    
    IF total_sales_data >= total_ventas_dura * 0.95 THEN
        RAISE NOTICE '✓ Migración EXITOSA: Más del 95%% de registros migrados';
    ELSIF total_sales_data >= total_ventas_dura * 0.80 THEN
        RAISE NOTICE '⚠ Migración PARCIAL: Entre 80%% y 95%% de registros migrados';
        RAISE NOTICE '  Revisa los registros omitidos (duplicados o inválidos)';
    ELSE
        RAISE NOTICE '✗ Migración INCOMPLETA: Menos del 80%% de registros migrados';
        RAISE NOTICE '  Revisa los errores y ejecuta nuevamente la migración';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Próximos pasos:';
    RAISE NOTICE '  1. Verifica los datos en el frontend: /sales/dura';
    RAISE NOTICE '  2. Prueba los filtros por año (2022-2025)';
    RAISE NOTICE '  3. Verifica que las estadísticas se calculan correctamente';
    RAISE NOTICE '  4. Si todo está bien, puedes mantener ventas_dura como respaldo';
    RAISE NOTICE '     o eliminarla con: DROP TABLE IF EXISTS ventas_dura;';
    RAISE NOTICE '========================================';
END $$;

-- Query adicional: Mostrar algunos registros no migrados (si los hay)
DO $$
DECLARE
    target_company_id INTEGER := 1;
    unmigrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unmigrated_count
    FROM ventas_dura v
    WHERE NOT EXISTS (
        SELECT 1 
        FROM sales_data sd
        WHERE sd.company_id = target_company_id
          AND LOWER(TRIM(sd.client_name)) = LOWER(TRIM(v.cliente))
          AND LOWER(TRIM(sd.product_name)) = LOWER(TRIM(v.producto))
          AND sd.sale_date = v.fecha
          AND (
            (sd.folio = v.folio AND v.folio IS NOT NULL)
            OR (sd.folio IS NULL AND v.folio IS NULL)
          )
    )
    AND v.fecha IS NOT NULL
    AND v.cliente IS NOT NULL 
    AND TRIM(v.cliente) != ''
    AND v.producto IS NOT NULL 
    AND TRIM(v.producto) != ''
    AND v.cantidad IS NOT NULL 
    AND v.cantidad > 0;
    
    IF unmigrated_count > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '⚠ ADVERTENCIA: % registros válidos no fueron migrados', unmigrated_count;
        RAISE NOTICE 'Esto puede deberse a duplicados o problemas en la migración.';
        RAISE NOTICE 'Ejecuta la siguiente query para ver detalles:';
        RAISE NOTICE '';
        RAISE NOTICE 'SELECT v.* FROM ventas_dura v';
        RAISE NOTICE 'WHERE NOT EXISTS (';
        RAISE NOTICE '    SELECT 1 FROM sales_data sd';
        RAISE NOTICE '    WHERE sd.company_id = 1';
        RAISE NOTICE '      AND LOWER(TRIM(sd.client_name)) = LOWER(TRIM(v.cliente))';
        RAISE NOTICE '      AND LOWER(TRIM(sd.product_name)) = LOWER(TRIM(v.producto))';
        RAISE NOTICE '      AND sd.sale_date = v.fecha';
        RAISE NOTICE '      AND (sd.folio = v.folio OR (sd.folio IS NULL AND v.folio IS NULL))';
        RAISE NOTICE ') LIMIT 10;';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '✓ Todos los registros válidos fueron migrados correctamente';
    END IF;
END $$;
























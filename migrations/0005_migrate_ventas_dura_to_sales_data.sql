-- MIGRATION: Migrar datos de ventas_dura a sales_data
-- Date: 2025-11-28
-- Description: Migrar datos históricos de ventas_dura a la tabla sales_data del sistema
--              Creando clientes y productos si no existen
--              Mejorado: Detección avanzada de duplicados, validaciones y reportes detallados

BEGIN;

-- Asumimos que Dura International tiene company_id = 1
-- Si es diferente, ajusta este valor
DO $$
DECLARE
    target_company_id INTEGER := 1; -- Ajusta este valor si es necesario
    client_record RECORD;
    product_record RECORD;
    sales_record RECORD;
    new_client_id INTEGER;
    new_product_id INTEGER;
    sale_week INTEGER;
    sale_date_val DATE;
    
    -- Contadores
    total_clients INTEGER := 0;
    clients_created INTEGER := 0;
    total_products INTEGER := 0;
    products_created INTEGER := 0;
    total_sales INTEGER := 0;
    sales_inserted INTEGER := 0;
    sales_skipped INTEGER := 0;
    sales_invalid INTEGER := 0;
    
    -- Validaciones
    is_valid BOOLEAN;
    duplicate_count INTEGER;
    record_counter INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'INICIANDO MIGRACIÓN DE VENTAS_DURA A SALES_DATA';
    RAISE NOTICE 'Company ID: %', target_company_id;
    RAISE NOTICE '========================================';

    -- Paso 1: Crear clientes que no existen
    RAISE NOTICE '';
    RAISE NOTICE 'PASO 1: Creando clientes...';
    FOR client_record IN 
        SELECT DISTINCT cliente 
        FROM ventas_dura 
        WHERE cliente IS NOT NULL AND TRIM(cliente) != ''
        ORDER BY cliente
    LOOP
        total_clients := total_clients + 1;
        
        -- Verificar si el cliente ya existe
        SELECT id INTO new_client_id
        FROM clients
        WHERE company_id = target_company_id 
          AND LOWER(TRIM(name)) = LOWER(TRIM(client_record.cliente));
        
        -- Si no existe, crearlo
        IF new_client_id IS NULL THEN
            INSERT INTO clients (company_id, name, is_active, created_at)
            VALUES (target_company_id, TRIM(client_record.cliente), true, CURRENT_TIMESTAMP)
            RETURNING id INTO new_client_id;
            
            clients_created := clients_created + 1;
            IF clients_created <= 10 THEN
                RAISE NOTICE '  ✓ Cliente creado: % (ID: %)', client_record.cliente, new_client_id;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Clientes procesados: %, Creados: %, Existentes: %', 
        total_clients, clients_created, (total_clients - clients_created);

    -- Paso 2: Crear productos que no existen
    RAISE NOTICE '';
    RAISE NOTICE 'PASO 2: Creando productos...';
    FOR product_record IN 
        SELECT DISTINCT producto 
        FROM ventas_dura 
        WHERE producto IS NOT NULL AND TRIM(producto) != ''
        ORDER BY producto
    LOOP
        total_products := total_products + 1;
        
        -- Verificar si el producto ya existe
        SELECT id INTO new_product_id
        FROM products
        WHERE company_id = target_company_id 
          AND LOWER(TRIM(product_name)) = LOWER(TRIM(product_record.producto));
        
        -- Si no existe, crearlo
        IF new_product_id IS NULL THEN
            INSERT INTO products (company_id, product_name, unit, is_active, created_at)
            VALUES (target_company_id, TRIM(product_record.producto), 'KG', true, CURRENT_TIMESTAMP)
            RETURNING id INTO new_product_id;
            
            products_created := products_created + 1;
            IF products_created <= 10 THEN
                RAISE NOTICE '  ✓ Producto creado: % (ID: %)', product_record.producto, new_product_id;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Productos procesados: %, Creados: %, Existentes: %', 
        total_products, products_created, (total_products - products_created);

    -- Paso 3: Migrar datos de ventas con validaciones y detección mejorada de duplicados
    RAISE NOTICE '';
    RAISE NOTICE 'PASO 3: Migrando datos de ventas...';
    RAISE NOTICE 'Esto puede tardar varios minutos para ~3,875 registros...';
    
    FOR sales_record IN 
        SELECT 
            v.fecha,
            v.folio,
            v.cliente,
            v.producto,
            v.cantidad,
            v.precio_unitario,
            v.importe,
            v.anio,
            v.mes,
            v.venta_2024,
            v.venta_2025
        FROM ventas_dura v
        WHERE v.fecha IS NOT NULL
          AND v.cliente IS NOT NULL 
          AND v.producto IS NOT NULL
          AND TRIM(v.cliente) != ''
          AND TRIM(v.producto) != ''
        ORDER BY v.fecha, v.folio
    LOOP
        total_sales := total_sales + 1;
        record_counter := record_counter + 1;
        
        -- Mostrar progreso cada 500 registros
        IF record_counter % 500 = 0 THEN
            RAISE NOTICE '  Procesados: % / ~3,875 (Insertados: %, Omitidos: %, Inválidos: %)', 
                record_counter, sales_inserted, sales_skipped, sales_invalid;
        END IF;
        
        -- Validaciones de datos
        is_valid := true;
        
        -- Validar fecha
        sale_date_val := sales_record.fecha;
        IF sale_date_val IS NULL OR sale_date_val < '2020-01-01'::DATE OR sale_date_val > CURRENT_DATE + INTERVAL '1 year' THEN
            is_valid := false;
            sales_invalid := sales_invalid + 1;
            CONTINUE;
        END IF;
        
        -- Validar cantidad (debe ser > 0)
        IF sales_record.cantidad IS NULL OR sales_record.cantidad <= 0 THEN
            is_valid := false;
            sales_invalid := sales_invalid + 1;
            CONTINUE;
        END IF;
        
        -- Obtener IDs de cliente y producto
        SELECT id INTO new_client_id
        FROM clients
        WHERE company_id = target_company_id 
          AND LOWER(TRIM(name)) = LOWER(TRIM(sales_record.cliente));
        
        SELECT id INTO new_product_id
        FROM products
        WHERE company_id = target_company_id 
          AND LOWER(TRIM(product_name)) = LOWER(TRIM(sales_record.producto));
        
        -- Si no encontramos cliente o producto, saltar
        IF new_client_id IS NULL OR new_product_id IS NULL THEN
            sales_invalid := sales_invalid + 1;
            CONTINUE;
        END IF;
        
        -- Calcular semana ISO
        sale_week := EXTRACT(WEEK FROM sale_date_val);
        
        -- DETECCIÓN MEJORADA DE DUPLICADOS
        -- Comparar por: company_id, cliente, producto, fecha, folio, cantidad
        -- Esto es más estricto que solo fecha y folio
        SELECT COUNT(*) INTO duplicate_count
        FROM sales_data 
        WHERE company_id = target_company_id
          AND client_name = TRIM(sales_record.cliente)
          AND product_name = TRIM(sales_record.producto)
          AND sale_date = sale_date_val
          AND (
            (folio = sales_record.folio AND sales_record.folio IS NOT NULL)
            OR (folio IS NULL AND sales_record.folio IS NULL)
          )
          AND ABS(quantity - COALESCE(sales_record.cantidad, 0)) < 0.01; -- Tolerancia para decimales
        
        IF duplicate_count > 0 THEN
            sales_skipped := sales_skipped + 1;
            CONTINUE;
        END IF;
        
        -- Insertar en sales_data
        BEGIN
            INSERT INTO sales_data (
                company_id,
                client_id,
                client_name,
                product_id,
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
                quantity_2024,
                quantity_2025,
                created_at
            ) VALUES (
                target_company_id,
                new_client_id,
                TRIM(sales_record.cliente),
                new_product_id,
                TRIM(sales_record.producto),
                COALESCE(sales_record.cantidad, 0),
                'KG',
                sale_date_val,
                COALESCE(sales_record.mes, EXTRACT(MONTH FROM sale_date_val)::INTEGER),
                COALESCE(sales_record.anio, EXTRACT(YEAR FROM sale_date_val)::INTEGER),
                sale_week,
                sales_record.folio,
                sales_record.folio,
                sales_record.precio_unitario,
                sales_record.importe,
                sales_record.venta_2024,
                sales_record.venta_2025,
                CURRENT_TIMESTAMP
            );
            
            sales_inserted := sales_inserted + 1;
        EXCEPTION WHEN OTHERS THEN
            sales_invalid := sales_invalid + 1;
            RAISE WARNING 'Error al insertar registro: % - %', SQLERRM, SQLSTATE;
        END;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRACIÓN COMPLETADA';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMEN:';
    RAISE NOTICE '  Clientes: % procesados, % creados', total_clients, clients_created;
    RAISE NOTICE '  Productos: % procesados, % creados', total_products, products_created;
    RAISE NOTICE '  Ventas:';
    RAISE NOTICE '    - Total procesadas: %', total_sales;
    RAISE NOTICE '    - Insertadas: %', sales_inserted;
    RAISE NOTICE '    - Omitidas (duplicados): %', sales_skipped;
    RAISE NOTICE '    - Inválidas (datos incorrectos): %', sales_invalid;
    RAISE NOTICE '========================================';
END $$;

-- Verificar resultados finales
DO $$
DECLARE
    total_ventas_dura INTEGER;
    total_sales_data INTEGER;
    total_clients INTEGER;
    total_products INTEGER;
    target_company_id INTEGER := 1;
    min_date DATE;
    max_date DATE;
    year_range TEXT;
BEGIN
    SELECT COUNT(*) INTO total_ventas_dura FROM ventas_dura;
    SELECT COUNT(*) INTO total_sales_data 
    FROM sales_data 
    WHERE company_id = target_company_id;
    
    SELECT COUNT(*) INTO total_clients
    FROM clients
    WHERE company_id = target_company_id;
    
    SELECT COUNT(*) INTO total_products
    FROM products
    WHERE company_id = target_company_id;
    
    SELECT MIN(sale_date), MAX(sale_date) INTO min_date, max_date
    FROM sales_data
    WHERE company_id = target_company_id;
    
    IF min_date IS NOT NULL AND max_date IS NOT NULL THEN
        year_range := min_date::TEXT || ' a ' || max_date::TEXT;
    ELSE
        year_range := 'Sin datos';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN FINAL';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Registros en ventas_dura: %', total_ventas_dura;
    RAISE NOTICE 'Registros en sales_data (company_id=%): %', target_company_id, total_sales_data;
    RAISE NOTICE 'Clientes en sistema: %', total_clients;
    RAISE NOTICE 'Productos en sistema: %', total_products;
    RAISE NOTICE 'Rango de fechas: %', year_range;
    RAISE NOTICE '';
    RAISE NOTICE 'NOTA: Si hay diferencia entre ventas_dura y sales_data,';
    RAISE NOTICE 'puede deberse a:';
    RAISE NOTICE '  - Registros duplicados (omitidos)';
    RAISE NOTICE '  - Registros con datos inválidos (omitidos)';
    RAISE NOTICE '  - Registros ya existentes en sales_data';
    RAISE NOTICE '';
    RAISE NOTICE 'Ejecuta el script de verificación (0006) para más detalles.';
    RAISE NOTICE '========================================';
END $$;

COMMIT;

-- NOTA: Después de verificar que la migración fue exitosa,
-- puedes eliminar la tabla ventas_dura si lo deseas:
-- DROP TABLE IF EXISTS ventas_dura;


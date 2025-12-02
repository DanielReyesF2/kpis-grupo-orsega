-- ============================================
-- MIGRACIÓN: Crear tabla sales_data (Versión 2 - Más robusta)
-- ============================================
-- Fecha: 2025-01-XX
-- Descripción: Crear la tabla sales_data con todas sus columnas e índices
--              Esta versión verifica que las tablas dependientes existan primero
-- ============================================

-- Verificar que las tablas dependientes existan
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies') THEN
        RAISE EXCEPTION 'La tabla companies no existe. Debe crearse primero.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        RAISE EXCEPTION 'La tabla users no existe. Debe crearse primero.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
        RAISE EXCEPTION 'La tabla clients no existe. Debe crearse primero.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
        RAISE EXCEPTION 'La tabla products no existe. Debe crearse primero.';
    END IF;
    
    RAISE NOTICE '✅ Todas las tablas dependientes existen. Procediendo a crear tablas de ventas...';
END $$;

BEGIN;

-- Crear tabla de tracking de archivos subidos (DEBE IR ANTES de sales_data por FK)
CREATE TABLE IF NOT EXISTS sales_uploads (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT,
    file_size INTEGER,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    period_start DATE,
    period_end DATE,
    records_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'processed',
    notes TEXT
);

-- Crear tabla principal de datos de ventas
CREATE TABLE IF NOT EXISTS sales_data (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    client_id INTEGER REFERENCES clients(id),
    client_name VARCHAR(255) NOT NULL,
    product_id INTEGER REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(15, 2) NOT NULL,
    unit VARCHAR(50) DEFAULT 'KG',
    sale_date DATE NOT NULL,
    sale_month INTEGER NOT NULL CHECK (sale_month BETWEEN 1 AND 12),
    sale_year INTEGER NOT NULL,
    sale_week INTEGER CHECK (sale_week BETWEEN 1 AND 53),
    invoice_number VARCHAR(100),
    folio VARCHAR(100),
    unit_price DECIMAL(15, 2),
    total_amount DECIMAL(15, 2),
    quantity_2024 DECIMAL(15, 2),
    quantity_2025 DECIMAL(15, 2),
    notes TEXT,
    upload_id INTEGER REFERENCES sales_uploads(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de alertas de ventas
CREATE TABLE IF NOT EXISTS sales_alerts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    alert_type VARCHAR(50) NOT NULL,
    client_id INTEGER REFERENCES clients(id),
    client_name VARCHAR(255),
    severity VARCHAR(20) DEFAULT 'warning',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    data JSONB,
    is_active BOOLEAN DEFAULT true,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id)
);

COMMIT;

-- Crear índices (fuera de la transacción para mejor manejo de errores)
CREATE INDEX IF NOT EXISTS idx_sales_data_company_id ON sales_data(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_data_client_id ON sales_data(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_data_product_id ON sales_data(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_data_sale_date ON sales_data(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_data_sale_year_month ON sales_data(sale_year, sale_month);
CREATE INDEX IF NOT EXISTS idx_sales_data_company_date ON sales_data(company_id, sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_data_upload_id ON sales_data(upload_id) WHERE upload_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_data_quantity_2024 ON sales_data(quantity_2024) WHERE quantity_2024 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_data_quantity_2025 ON sales_data(quantity_2025) WHERE quantity_2025 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_data_total_amount ON sales_data(total_amount) WHERE total_amount IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_uploads_company_id ON sales_uploads(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_uploads_upload_date ON sales_uploads(upload_date);

CREATE INDEX IF NOT EXISTS idx_sales_alerts_company_id ON sales_alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_alerts_is_active ON sales_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_sales_alerts_is_read ON sales_alerts(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_sales_alerts_company_active ON sales_alerts(company_id, is_active, is_read);

-- Verificación final
DO $$
DECLARE
    sales_data_exists BOOLEAN;
    sales_uploads_exists BOOLEAN;
    sales_alerts_exists BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_data') INTO sales_data_exists;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_uploads') INTO sales_uploads_exists;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_alerts') INTO sales_alerts_exists;
    
    IF sales_data_exists AND sales_uploads_exists AND sales_alerts_exists THEN
        RAISE NOTICE '✅ ÉXITO: Todas las tablas se crearon correctamente';
        RAISE NOTICE '   - sales_data: %', sales_data_exists;
        RAISE NOTICE '   - sales_uploads: %', sales_uploads_exists;
        RAISE NOTICE '   - sales_alerts: %', sales_alerts_exists;
    ELSE
        RAISE WARNING '⚠️ ADVERTENCIA: Algunas tablas no se crearon';
        RAISE WARNING '   - sales_data: %', sales_data_exists;
        RAISE WARNING '   - sales_uploads: %', sales_uploads_exists;
        RAISE WARNING '   - sales_alerts: %', sales_alerts_exists;
    END IF;
END $$;


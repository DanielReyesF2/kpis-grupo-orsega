import { pool } from "./db";

/**
 * Esquema de base de datos para el Módulo de Ventas
 *
 * Tablas:
 * - sales_data: Datos históricos de ventas (desde enero 2022)
 * - sales_uploads: Tracking de archivos Excel subidos
 * - sales_alerts: Alertas generadas automáticamente
 */

const CREATE_TABLES_QUERIES = [
  // Tabla de productos (si no existe)
  `CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    product_code VARCHAR(100),
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(50) DEFAULT 'KG',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, product_code)
  );`,

  // Tabla principal de datos de ventas
  `CREATE TABLE IF NOT EXISTS sales_data (
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
    notes TEXT,
    upload_id INTEGER REFERENCES sales_uploads(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // Tabla de tracking de archivos subidos
  `CREATE TABLE IF NOT EXISTS sales_uploads (
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
  );`,

  // Tabla de alertas de ventas
  `CREATE TABLE IF NOT EXISTS sales_alerts (
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
  );`,
];

const CREATE_INDEX_QUERIES = [
  // Índices para sales_data
  `CREATE INDEX IF NOT EXISTS idx_sales_data_company_id ON sales_data(company_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_data_client_id ON sales_data(client_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_data_product_id ON sales_data(product_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_data_sale_date ON sales_data(sale_date DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_data_year_month ON sales_data(company_id, sale_year DESC, sale_month DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_data_client_year ON sales_data(client_id, sale_year DESC);`,

  // Índices para sales_uploads
  `CREATE INDEX IF NOT EXISTS idx_sales_uploads_company_id ON sales_uploads(company_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_uploads_date ON sales_uploads(upload_date DESC);`,

  // Índices para sales_alerts
  `CREATE INDEX IF NOT EXISTS idx_sales_alerts_company_id ON sales_alerts(company_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_alerts_active ON sales_alerts(is_active, company_id);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_alerts_type ON sales_alerts(alert_type, company_id);`,

  // Índices para products
  `CREATE INDEX IF NOT EXISTS idx_products_company_id ON products(company_id);`,
  `CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);`,
];

const CREATE_VIEWS_QUERIES = [
  // Vista para comparativo año actual vs anterior por cliente
  `CREATE OR REPLACE VIEW sales_comparison_by_client AS
   SELECT
     current_year.company_id,
     current_year.client_id,
     current_year.client_name,
     current_year.sale_year as current_year,
     current_year.sale_month as month,
     SUM(current_year.quantity) as current_year_total,
     COALESCE(SUM(previous_year.quantity), 0) as previous_year_total,
     SUM(current_year.quantity) - COALESCE(SUM(previous_year.quantity), 0) as differential,
     CASE
       WHEN COALESCE(SUM(previous_year.quantity), 0) > 0
       THEN ROUND(((SUM(current_year.quantity) - SUM(previous_year.quantity)) / SUM(previous_year.quantity) * 100)::numeric, 2)
       ELSE NULL
     END as percent_change,
     current_year.unit
   FROM sales_data current_year
   LEFT JOIN sales_data previous_year
     ON current_year.client_id = previous_year.client_id
     AND current_year.company_id = previous_year.company_id
     AND current_year.sale_month = previous_year.sale_month
     AND current_year.sale_year = previous_year.sale_year + 1
   GROUP BY
     current_year.company_id,
     current_year.client_id,
     current_year.client_name,
     current_year.sale_year,
     current_year.sale_month,
     current_year.unit;`,

  // Vista para detectar clientes inactivos
  `CREATE OR REPLACE VIEW inactive_clients AS
   SELECT
     c.id as client_id,
     c.name as client_name,
     c.company_id,
     MAX(sd.sale_date) as last_sale_date,
     DATE_PART('day', CURRENT_DATE - MAX(sd.sale_date)) as days_since_last_sale,
     COUNT(sd.id) as total_sales_count,
     SUM(sd.quantity) as total_quantity
   FROM clients c
   LEFT JOIN sales_data sd ON c.id = sd.client_id
   WHERE c.is_active = true
   GROUP BY c.id, c.name, c.company_id
   HAVING MAX(sd.sale_date) < CURRENT_DATE - INTERVAL '60 days'
     OR MAX(sd.sale_date) IS NULL;`,
];

export async function ensureSalesSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("📦 [Sales Schema] Creando tablas...");
    for (const query of CREATE_TABLES_QUERIES) {
      await client.query(query);
    }

    console.log("🔍 [Sales Schema] Creando índices...");
    for (const query of CREATE_INDEX_QUERIES) {
      await client.query(query);
    }

    console.log("📊 [Sales Schema] Creando vistas...");
    for (const query of CREATE_VIEWS_QUERIES) {
      await client.query(query);
    }

    await client.query("COMMIT");
    console.log("✅ Sales schema verified (tables/indexes/views created)");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to ensure sales schema:", error);
    throw error;
  } finally {
    client.release();
  }
}

import { pool } from "./db";

/**
 * Esquema de base de datos para el Módulo de Ventas
 *
 * Tablas:
 * - ventas: Datos históricos de ventas (desde enero 2022)
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
    familia_producto VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, product_code)
  );`,

  // Tabla de tracking de archivos subidos (DEBE IR ANTES de ventas por FK)
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

  // Tabla principal de datos de ventas
  `CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id),
    submodulo VARCHAR(10),
    client_id INTEGER REFERENCES clients(id),
    cliente VARCHAR(255) NOT NULL,
    product_id INTEGER REFERENCES products(id),
    producto VARCHAR(255) NOT NULL,
    cantidad DECIMAL(15, 2) NOT NULL,
    unidad VARCHAR(50) DEFAULT 'KG',
    fecha DATE NOT NULL,
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    anio INTEGER NOT NULL,
    sale_week INTEGER CHECK (sale_week BETWEEN 1 AND 53),
    factura VARCHAR(100),
    folio VARCHAR(100),
    precio_unitario DECIMAL(15, 2),
    importe DECIMAL(15, 2),
    quantity_2024 DECIMAL(15, 2),
    quantity_2025 DECIMAL(15, 2),
    tipo_cambio DECIMAL(10, 4),
    importe_mn DECIMAL(15, 2),
    notes TEXT,
    upload_id INTEGER REFERENCES sales_uploads(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

  // Tabla de responsables (catálogo)
  `CREATE TABLE IF NOT EXISTS sales_responsables (
    codigo VARCHAR(10) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // Tabla de acciones/tareas de ventas
  `CREATE TABLE IF NOT EXISTS sales_acciones (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clients(id),
    cliente_nombre VARCHAR(255) NOT NULL,
    submodulo VARCHAR(10) NOT NULL CHECK (submodulo IN ('DI', 'GO')),
    descripcion TEXT NOT NULL,
    prioridad VARCHAR(20) DEFAULT 'MEDIA' CHECK (prioridad IN ('CRITICA', 'ALTA', 'MEDIA', 'BAJA')),
    estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'CANCELADO')),
    responsables VARCHAR(50),
    diferencial DECIMAL(15, 2),
    kilos_2024 DECIMAL(15, 2),
    kilos_2025 DECIMAL(15, 2),
    usd_2025 DECIMAL(15, 2),
    utilidad DECIMAL(8, 2),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_limite DATE,
    fecha_completado TIMESTAMP,
    notas TEXT,
    excel_origen_id INTEGER REFERENCES sales_uploads(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // Tabla de historial de cambios en acciones
  `CREATE TABLE IF NOT EXISTS sales_acciones_historial (
    id SERIAL PRIMARY KEY,
    accion_id INTEGER NOT NULL REFERENCES sales_acciones(id) ON DELETE CASCADE,
    campo_modificado VARCHAR(50),
    valor_anterior TEXT,
    valor_nuevo TEXT,
    usuario_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,

  // Tabla de notificaciones
  `CREATE TABLE IF NOT EXISTS sales_notificaciones (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    destinatario_codigo VARCHAR(10) NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT,
    referencia_tipo VARCHAR(50),
    referencia_id INTEGER,
    leida BOOLEAN DEFAULT false,
    enviada_email BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
];

const CREATE_INDEX_QUERIES = [
  // Índices para ventas
  `CREATE INDEX IF NOT EXISTS idx_ventas_company_id ON ventas(company_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ventas_submodulo ON ventas(submodulo, company_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ventas_client_id ON ventas(client_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ventas_product_id ON ventas(product_id);`,
  `CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_ventas_anio_mes ON ventas(company_id, anio DESC, mes DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_ventas_client_anio ON ventas(client_id, anio DESC);`,

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

  // Índices para sales_acciones
  `CREATE INDEX IF NOT EXISTS idx_sales_acciones_submodulo ON sales_acciones(submodulo);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_acciones_estado ON sales_acciones(estado);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_acciones_prioridad ON sales_acciones(prioridad);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_acciones_responsables ON sales_acciones(responsables);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_acciones_cliente_id ON sales_acciones(cliente_id);`,

  // Índices para sales_acciones_historial
  `CREATE INDEX IF NOT EXISTS idx_sales_acciones_historial_accion_id ON sales_acciones_historial(accion_id);`,

  // Índices para sales_notificaciones
  `CREATE INDEX IF NOT EXISTS idx_sales_notificaciones_destinatario ON sales_notificaciones(destinatario_codigo, leida);`,
  `CREATE INDEX IF NOT EXISTS idx_sales_notificaciones_created_at ON sales_notificaciones(created_at DESC);`,
];

const CREATE_VIEWS_QUERIES = [
  // Vista para comparativo año actual vs anterior por cliente
  `CREATE OR REPLACE VIEW sales_comparison_by_client AS
   SELECT
     current_year.company_id,
     current_year.client_id,
     current_year.cliente,
     current_year.anio as current_year,
     current_year.mes as month,
     SUM(current_year.cantidad) as current_year_total,
     COALESCE(SUM(previous_year.cantidad), 0) as previous_year_total,
     SUM(current_year.cantidad) - COALESCE(SUM(previous_year.cantidad), 0) as differential,
     CASE
       WHEN COALESCE(SUM(previous_year.cantidad), 0) > 0
       THEN ROUND(((SUM(current_year.cantidad) - SUM(previous_year.cantidad)) / SUM(previous_year.cantidad) * 100)::numeric, 2)
       ELSE NULL
     END as percent_change,
     current_year.unidad
   FROM ventas current_year
   LEFT JOIN ventas previous_year
     ON current_year.client_id = previous_year.client_id
     AND current_year.company_id = previous_year.company_id
     AND current_year.mes = previous_year.mes
     AND current_year.anio = previous_year.anio + 1
   GROUP BY
     current_year.company_id,
     current_year.client_id,
     current_year.cliente,
     current_year.anio,
     current_year.mes,
     current_year.unidad;`,

  // Vista para detectar clientes inactivos
  `CREATE OR REPLACE VIEW inactive_clients AS
   SELECT
     c.id as client_id,
     c.name as client_name,
     c.company_id,
     MAX(sd.fecha) as last_sale_date,
     CASE
       WHEN MAX(sd.fecha) IS NOT NULL
       THEN EXTRACT(DAY FROM (CURRENT_DATE - MAX(sd.fecha)))
       ELSE NULL
     END as days_since_last_sale,
     COUNT(sd.id) as total_sales_count,
     SUM(sd.cantidad) as total_quantity
   FROM clients c
   LEFT JOIN ventas sd ON c.id = sd.client_id
   WHERE c.is_active = true
   GROUP BY c.id, c.name, c.company_id
   HAVING MAX(sd.fecha) < CURRENT_DATE - INTERVAL '60 days'
     OR MAX(sd.fecha) IS NULL;`,
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

    console.log("👥 [Sales Schema] Insertando responsables iniciales...");
    await client.query(`
      INSERT INTO sales_responsables (codigo, nombre, email, activo) VALUES
        ('ON', 'Omar Navarro', 'omar@orsega.com', true),
        ('EDV', 'Emilio del Valle', 'emilio@orsega.com', true),
        ('TR', 'Thalia Rodriguez', 'thalia@orsega.com', true),
        ('MR', 'Mario Reynoso', 'mario@orsega.com', true),
        ('AVM', '[Por confirmar]', null, true),
        ('MDK', '[Por confirmar]', null, true),
        ('AP', '[Por confirmar]', null, true)
      ON CONFLICT (codigo) DO NOTHING
    `);

    await client.query("COMMIT");
    console.log("✅ Sales schema verified (tables/indexes/views/responsables created)");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to ensure sales schema:", error);
    throw error;
  } finally {
    client.release();
  }
}

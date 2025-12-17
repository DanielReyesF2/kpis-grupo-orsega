-- Migración 0008: Agregar submodulo y tablas para acciones/responsables
-- Fecha: Diciembre 2025
-- Propósito: Extender módulo de ventas para soportar DI y GO con sistema de acciones

-- 1. Agregar campo submodulo a sales_data (si no existe)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'submodulo'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN submodulo VARCHAR(10);

    -- Actualizar registros existentes basados en company_id
    -- company_id 1 = Dura International (DI)
    -- company_id 2 = Grupo Orsega (GO)
    UPDATE sales_data SET submodulo =
      CASE
        WHEN company_id = 1 THEN 'DI'
        WHEN company_id = 2 THEN 'GO'
        ELSE 'DI' -- Default
      END
    WHERE submodulo IS NULL;

    -- Crear índice para submodulo
    CREATE INDEX idx_sales_data_submodulo ON sales_data(submodulo, company_id);

    RAISE NOTICE 'Campo submodulo agregado a sales_data';
  ELSE
    RAISE NOTICE 'Campo submodulo ya existe en sales_data';
  END IF;
END $$;

-- 2. Crear tabla de responsables (catálogo)
CREATE TABLE IF NOT EXISTS sales_responsables (
  codigo VARCHAR(10) PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar responsables iniciales
INSERT INTO sales_responsables (codigo, nombre, email, activo) VALUES
  ('ON', 'Omar Navarro', 'omar@orsega.com', true),
  ('EDV', 'Emilio del Valle', 'emilio@orsega.com', true),
  ('TR', 'Thalia Rodriguez', 'thalia@orsega.com', true),
  ('MR', 'Mario Reynoso', 'mario@orsega.com', true),
  ('AVM', '[Por confirmar]', null, true),
  ('MDK', '[Por confirmar]', null, true),
  ('AP', '[Por confirmar]', null, true)
ON CONFLICT (codigo) DO NOTHING;

-- 3. Crear tabla de acciones/tareas
CREATE TABLE IF NOT EXISTS sales_acciones (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clients(id),
  cliente_nombre VARCHAR(255) NOT NULL,
  submodulo VARCHAR(10) NOT NULL CHECK (submodulo IN ('DI', 'GO')),
  descripcion TEXT NOT NULL,
  prioridad VARCHAR(20) DEFAULT 'MEDIA' CHECK (prioridad IN ('CRITICA', 'ALTA', 'MEDIA', 'BAJA')),
  estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'CANCELADO')),
  responsables VARCHAR(50), -- Códigos separados por /, ej: "ON/EDV"
  diferencial DECIMAL(15, 2),
  kilos_2024 DECIMAL(15, 2),
  kilos_2025 DECIMAL(15, 2),
  usd_2025 DECIMAL(15, 2),
  utilidad DECIMAL(8, 2), -- Porcentaje
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_limite DATE,
  fecha_completado TIMESTAMP,
  notas TEXT,
  excel_origen_id INTEGER REFERENCES sales_uploads(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para sales_acciones
CREATE INDEX IF NOT EXISTS idx_sales_acciones_submodulo ON sales_acciones(submodulo);
CREATE INDEX IF NOT EXISTS idx_sales_acciones_estado ON sales_acciones(estado);
CREATE INDEX IF NOT EXISTS idx_sales_acciones_prioridad ON sales_acciones(prioridad);
CREATE INDEX IF NOT EXISTS idx_sales_acciones_responsables ON sales_acciones(responsables);
CREATE INDEX IF NOT EXISTS idx_sales_acciones_cliente_id ON sales_acciones(cliente_id);

-- 4. Crear tabla de historial de acciones
CREATE TABLE IF NOT EXISTS sales_acciones_historial (
  id SERIAL PRIMARY KEY,
  accion_id INTEGER NOT NULL REFERENCES sales_acciones(id) ON DELETE CASCADE,
  campo_modificado VARCHAR(50),
  valor_anterior TEXT,
  valor_nuevo TEXT,
  usuario_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para historial
CREATE INDEX IF NOT EXISTS idx_sales_acciones_historial_accion_id ON sales_acciones_historial(accion_id);

-- 5. Crear tabla de notificaciones
CREATE TABLE IF NOT EXISTS sales_notificaciones (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL, -- CLIENTE_CRITICO, ACCION_NUEVA, ACCION_VENCIDA, etc
  destinatario_codigo VARCHAR(10) NOT NULL REFERENCES sales_responsables(codigo),
  titulo VARCHAR(255) NOT NULL,
  mensaje TEXT,
  referencia_tipo VARCHAR(50), -- 'accion', 'cliente', 'alerta'
  referencia_id INTEGER,
  leida BOOLEAN DEFAULT false,
  enviada_email BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para notificaciones
CREATE INDEX IF NOT EXISTS idx_sales_notificaciones_destinatario ON sales_notificaciones(destinatario_codigo, leida);
CREATE INDEX IF NOT EXISTS idx_sales_notificaciones_created_at ON sales_notificaciones(created_at DESC);

-- 6. Agregar campo familia_producto a productos (para GO)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'familia_producto'
  ) THEN
    ALTER TABLE products ADD COLUMN familia_producto VARCHAR(100);
    RAISE NOTICE 'Campo familia_producto agregado a products';
  END IF;
END $$;

-- 7. Agregar más campos a sales_data para datos de GO
DO $$
BEGIN
  -- Tipo de cambio (para GO)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'tipo_cambio'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN tipo_cambio DECIMAL(10, 4);
  END IF;

  -- Importe en MN (para GO)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales_data' AND column_name = 'importe_mn'
  ) THEN
    ALTER TABLE sales_data ADD COLUMN importe_mn DECIMAL(15, 2);
  END IF;
END $$;

-- Mensaje final
DO $$
BEGIN
  RAISE NOTICE '✅ Migración 0008 completada: submodulo, responsables, acciones, notificaciones';
END $$;

-- ============================================
-- SCRIPT MAESTRO: Migración Completa de Proveedores
-- ============================================
-- Fecha: 2025-01-28
-- Descripción: Ejecutar todas las migraciones en orden correcto
-- 
-- ORDEN DE EJECUCIÓN:
-- 1. Crear tabla suppliers (proveedores de tesorería)
-- 2. Actualizar proveedores de logística
-- 3. Verificar y actualizar clientes
-- 4. Migrar datos existentes de supplierName

-- ============================================
-- PASO 1: Crear tabla suppliers (Proveedores de Tesorería - REP)
-- ============================================

-- Crear tabla suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL, -- Proveedor (ej: "Transportes Potosinos")
  short_name TEXT, -- Nombre Corto (ej: "Potosinos")
  email TEXT, -- Contacto (correo)
  location TEXT, -- Ubicación (NAC, EXT)
  requires_rep BOOLEAN DEFAULT FALSE, -- REP (SI/NO)
  rep_frequency INTEGER, -- Frecuencia de recordatorio de REP (días)
  company_id INTEGER, -- 1 = Dura, 2 = Orsega
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT, -- Notas adicionales
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_location ON suppliers(location);
CREATE INDEX IF NOT EXISTS idx_suppliers_requires_rep ON suppliers(requires_rep);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);

-- Agregar columna supplier_id a scheduled_payments (si no existe)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scheduled_payments' 
    AND column_name = 'supplier_id'
  ) THEN
    ALTER TABLE scheduled_payments 
    ADD COLUMN supplier_id INTEGER REFERENCES suppliers(id);
  END IF;
END $$;

-- ============================================
-- PASO 2: Actualizar Proveedores de Logística (Solo 2)
-- ============================================

-- Limpiar proveedores existentes (si los hay)
DELETE FROM provider WHERE company_id IN (1, 2);

-- Insertar los 2 proveedores de logística correctos
INSERT INTO provider (id, name, email, phone, contact_name, notes, rating, is_active, short_name, company_id, location, requires_rep, rep_frequency, reminder_email, created_at, updated_at) VALUES
-- Proveedor 1: Flete local Radiocamionetas
(gen_random_uuid(), 'Flete local Radiocamionetas', 'radiocamionetas@live.com.mx', NULL, NULL, 'Proveedor de flete local', 5.0, TRUE, 'Radiocamionetas', 1, 'NAC', FALSE, NULL, NULL, NOW(), NOW()),

-- Proveedor 2: Flete Potosinos  
(gen_random_uuid(), 'Flete Potosinos', 'nzepeda@potosinos.com.mx', NULL, 'Nancy Zepeda', 'Proveedor de flete Potosinos', 5.0, TRUE, 'Potosinos', 1, 'NAC', FALSE, NULL, NULL, NOW(), NOW());

-- ============================================
-- PASO 3: Verificar y Actualizar Clientes
-- ============================================

-- Si no hay clientes, insertar algunos de ejemplo
INSERT INTO clients (name, email, phone, contact_person, company, address, payment_terms, requires_receipt, reminder_frequency, is_active, company_id, client_code, secondary_email, city, state, postal_code, country, email_notifications, customer_type, requires_payment_complement, created_at, updated_at)
SELECT * FROM (
  VALUES 
  -- Clientes para Dura (company_id = 1)
  ('DIGO', 'ops@digo.mx', '+52 55 1234 5678', 'Juan Pérez', 'DIGO S.A.', 'Av. Insurgentes Sur 123, CDMX', 30, TRUE, 7, TRUE, 1, 'DIGO001', 'admin@digo.mx', 'Ciudad de México', 'CDMX', '03100', 'México', TRUE, 'distribuidor', FALSE, NOW(), NOW()),
  ('ACME Corp', 'logistics@acme.com', '+52 55 9876 5432', 'María García', 'ACME Corporation', 'Av. Reforma 456, CDMX', 15, TRUE, 3, TRUE, 1, 'ACME001', 'billing@acme.com', 'Ciudad de México', 'CDMX', '06600', 'México', TRUE, 'mayorista', FALSE, NOW(), NOW()),
  
  -- Clientes para Orsega (company_id = 2)
  ('Logística Integral', 'contacto@logisticaintegral.mx', '+52 55 1111 2222', 'Carlos López', 'Logística Integral S.A.', 'Av. Constituyentes 789, CDMX', 30, TRUE, 7, TRUE, 2, 'LI001', 'admin@logisticaintegral.mx', 'Ciudad de México', 'CDMX', '11850', 'México', TRUE, 'distribuidor', FALSE, NOW(), NOW()),
  ('Transportes del Norte', 'ventas@transportesnorte.com', '+52 55 3333 4444', 'Ana Martínez', 'Transportes del Norte', 'Av. Universidad 321, CDMX', 45, TRUE, 14, TRUE, 2, 'TN001', 'cobranza@transportesnorte.com', 'Ciudad de México', 'CDMX', '04510', 'México', TRUE, 'mayorista', FALSE, NOW(), NOW())
) AS new_clients(name, email, phone, contact_person, company, address, payment_terms, requires_receipt, reminder_frequency, is_active, company_id, client_code, secondary_email, city, state, postal_code, country, email_notifications, customer_type, requires_payment_complement, created_at, updated_at)
WHERE NOT EXISTS (
  SELECT 1 FROM clients WHERE clients.name = new_clients.name
);

-- ============================================
-- PASO 4: Insertar Suppliers (Proveedores de Tesorería)
-- ============================================

-- Insertar datos de ejemplo basados en el Excel "Directorio proveedores REP.xlsx"
-- DURA (company_id = 1)
INSERT INTO suppliers (name, short_name, email, location, requires_rep, rep_frequency, company_id) VALUES
('Transportes Potosinos', 'Potosinos', 'cyc_gdl@potosinos.com.mx', 'NAC', TRUE, 15, 1),
('Ma. Guadalupe de la Cruz', 'Miguel (Tarimas)', NULL, 'NAC', TRUE, 3, 1),
('Gerardo Torres Segura', 'Gerardo Torres', 'gera_8801@hotmail.com', 'NAC', TRUE, 5, 1),
('Román Melgarejo Hernández', 'Román Melgarejo', 'despachocastillo65@gmail.com', 'NAC', TRUE, 5, 1),
('Corporativo Internacional Especializado', 'CIE', 'cuentasporcobrar@cieagenciaaduanal.com', 'NAC', TRUE, 8, 1),
('Pedro Martínez Méndez', 'PMM', 'cobranza@imexfwd.com', 'NAC', TRUE, 8, 1),
('GS Corporación Aduanal', 'GS', 'cobranza@gscorporacion.com', 'NAC', TRUE, 8, 1),
('Pedro Torres Cordero', 'Pedro Torres', 'gera_8801@hotmail.com', 'NAC', TRUE, 5, 1),
('Miguel Angel Solis Arriaga', 'Radiocamionetas', 'radiocamionetasfacturacion@hotmail.com', 'NAC', TRUE, 5, 1),
('AXA Seguros', 'AXA', 'merobles@wolstein.com.mx', 'NAC', TRUE, 8, 1),
('Jesús Antonio García Rojas', 'Jesús García', 'facturacion@gmligisticaintegral.mx', 'NAC', TRUE, 5, 1),
('Dura Chemicals', 'Durachem', 'dgutierrez@durachem.com', 'EXT', FALSE, NULL, 1),
('Dura Europe', 'DESA', 'gsaez@durachem.com', 'EXT', FALSE, NULL, 1)
ON CONFLICT DO NOTHING;

-- ORSEGA (company_id = 2)
INSERT INTO suppliers (name, short_name, email, location, requires_rep, rep_frequency, company_id) VALUES
('Transportes Potosinos', 'Potosinos', 'cyc_gdl@potosinos.com.mx', 'NAC', TRUE, 15, 2),
('Gerardo Torres Segura', 'Gerardo Torres', 'gera_8801@hotmail.com', 'NAC', TRUE, 5, 2),
('Román Melgarejo Hernández', 'Román Melgarejo', 'despachocastillo65@gmail.com', 'NAC', TRUE, 5, 2),
('Corporativo Internacional Especializado', 'CIE', 'cuentasporcobrar@cieagenciaaduanal.com', 'NAC', TRUE, 8, 2),
('Pedro Martínez Méndez', 'PMM', 'cobranza@imexfwd.com', 'NAC', TRUE, 8, 2),
('GS Corporación Aduanal', 'GS', 'cobranza@gscorporacion.com', 'NAC', TRUE, 8, 2),
('LTP Adam Agencia Aduanal', 'LTP', 'facturacion7@ltpadam.com.mx', 'NAC', TRUE, 8, 2),
('DA Hinojosa Agencia Aduanal', 'Hinojosa', 'marcela.martinez@hinojosa.com.mx', 'NAC', TRUE, 8, 2),
('Pedro Torres Cordero', 'Pedro Torres', 'gera_8801@hotmail.com', 'NAC', TRUE, 5, 2),
('Miguel Angel Solis Arriaga', 'Radiocamionetas', 'radiocamionetasfacturacion@hotmail.com', 'NAC', TRUE, 5, 2),
('AXA Seguros', 'AXA', 'merobles@wolstein.com.mx', 'NAC', TRUE, 8, 2),
('Jesús Antonio García Rojas', 'Jesús García', 'facturacion@gmligisticaintegral.mx', 'NAC', TRUE, 5, 2),
('Garmal Soluciones Logísticas', 'Garmal', 'facturacion@gmligisticaintegral.mx', 'NAC', TRUE, 5, 2),
('Almacenamiento y Logística Portuaria', 'Alpasa', 'cobranza@alpasa.com.mx', 'NAC', TRUE, 8, 2),
('Lub y Rec de México', 'Lub y Rec', 'mparra@lubyrec.com', 'NAC', TRUE, 8, 2),
('Materia Hnos.', 'Materia', 'rodrigo_materia@materiaoleochemicals.com', 'EXT', FALSE, NULL, 2),
('Bulkhaul Limited', 'Bulkhaul', 'invoices@mgcomex.com.ar', 'EXT', FALSE, NULL, 2),
('Lioman Trading', 'Lioman', 'liomantrading@gmail.com', 'EXT', FALSE, NULL, 2),
('Evonik Catalysts India Private Limited', 'Evonik India', 'ketan.patil@evonik.com', 'EXT', FALSE, NULL, 2)
ON CONFLICT DO NOTHING;

-- ============================================
-- PASO 5: Migrar datos existentes de supplierName
-- ============================================

-- Crear suppliers únicos basados en supplier_name existente
INSERT INTO suppliers (name, short_name, email, location, requires_rep, rep_frequency, company_id, is_active)
SELECT DISTINCT
  sp.supplier_name as name,
  LEFT(sp.supplier_name, 20) as short_name, -- Usar primeros 20 caracteres como nombre corto
  NULL as email, -- No tenemos email en los datos existentes
  'NAC' as location, -- Asumir nacional por defecto
  TRUE as requires_rep, -- Asumir que requieren REP
  7 as rep_frequency, -- Frecuencia por defecto de 7 días
  sp.company_id,
  TRUE as is_active
FROM scheduled_payments sp
WHERE sp.supplier_name IS NOT NULL 
  AND sp.supplier_name != ''
  AND NOT EXISTS (
    SELECT 1 FROM suppliers s 
    WHERE s.name = sp.supplier_name 
    AND s.company_id = sp.company_id
  );

-- Actualizar scheduled_payments con supplier_id
UPDATE scheduled_payments 
SET supplier_id = s.id
FROM suppliers s
WHERE scheduled_payments.supplier_name = s.name
  AND scheduled_payments.company_id = s.company_id
  AND scheduled_payments.supplier_id IS NULL;

-- ============================================
-- RESUMEN FINAL
-- ============================================

-- Resumen de Providers (Logística)
SELECT 
  'PROVIDERS (Logística)' as tipo,
  COUNT(*) as total,
  COUNT(CASE WHEN is_active = TRUE THEN 1 END) as activos
FROM provider;

-- Resumen de Clients (Logística)
SELECT 
  'CLIENTS (Logística)' as tipo,
  COUNT(*) as total,
  COUNT(CASE WHEN is_active = TRUE THEN 1 END) as activos
FROM clients;

-- Resumen de Suppliers (Tesorería)
SELECT 
  'SUPPLIERS (Tesorería)' as tipo,
  COUNT(*) as total,
  COUNT(CASE WHEN is_active = TRUE THEN 1 END) as activos,
  COUNT(CASE WHEN requires_rep = TRUE THEN 1 END) as con_rep
FROM suppliers;

-- Resumen de Scheduled Payments
SELECT 
  'SCHEDULED PAYMENTS' as tipo,
  COUNT(*) as total,
  COUNT(CASE WHEN supplier_id IS NOT NULL THEN 1 END) as con_supplier_id,
  COUNT(CASE WHEN supplier_name IS NOT NULL AND supplier_name != '' THEN 1 END) as con_supplier_name
FROM scheduled_payments;

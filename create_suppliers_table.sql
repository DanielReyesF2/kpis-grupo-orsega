-- ============================================
-- MIGRACIÓN: Crear tabla suppliers (Proveedores de Tesorería - REP)
-- ============================================
-- Fecha: 2025-01-28
-- Descripción: Crear tabla para proveedores de tesorería que requieren comprobantes de pago
-- Diferencia con providers: suppliers = proveedores que reciben pagos, providers = transportistas

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

-- Comentarios para documentar la tabla
COMMENT ON TABLE suppliers IS 'Proveedores de Tesorería (REP - Recordatorios de Pago) - Empresas que reciben pagos y requieren comprobantes';
COMMENT ON COLUMN suppliers.name IS 'Nombre completo del proveedor';
COMMENT ON COLUMN suppliers.short_name IS 'Nombre corto o abreviado del proveedor';
COMMENT ON COLUMN suppliers.email IS 'Email de contacto para recordatorios';
COMMENT ON COLUMN suppliers.location IS 'Ubicación: NAC (Nacional) o EXT (Exterior)';
COMMENT ON COLUMN suppliers.requires_rep IS 'Si requiere Recordatorio de Pago (REP)';
COMMENT ON COLUMN suppliers.rep_frequency IS 'Frecuencia de recordatorios en días';
COMMENT ON COLUMN suppliers.company_id IS 'Empresa: 1=Dura, 2=Orsega';

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

-- Verificar que se crearon correctamente
SELECT 
  s.id,
  s.name,
  s.short_name,
  s.email,
  s.location,
  s.requires_rep,
  s.rep_frequency,
  c.name as company_name
FROM suppliers s
LEFT JOIN companies c ON s.company_id = c.id
ORDER BY s.company_id, s.name;

-- Mostrar resumen
SELECT 
  company_id,
  COUNT(*) as total_suppliers,
  COUNT(CASE WHEN requires_rep = TRUE THEN 1 END) as suppliers_with_rep,
  COUNT(CASE WHEN location = 'NAC' THEN 1 END) as national_suppliers,
  COUNT(CASE WHEN location = 'EXT' THEN 1 END) as international_suppliers
FROM suppliers
GROUP BY company_id
ORDER BY company_id;

-- ============================================
-- VERIFICACIÓN Y ACTUALIZACIÓN: Clientes de Logística
-- ============================================
-- Fecha: 2025-01-28
-- Descripción: Verificar si existen clientes y agregar algunos de ejemplo si es necesario

-- Verificar clientes existentes
SELECT 
  'Clientes existentes' as estado,
  COUNT(*) as total_clientes,
  COUNT(CASE WHEN is_active = TRUE THEN 1 END) as clientes_activos
FROM clients;

-- Mostrar clientes existentes (si los hay)
SELECT 
  c.id,
  c.name,
  c.email,
  c.phone,
  c.contact_person,
  c.company,
  c.is_active,
  comp.name as company_name
FROM clients c
LEFT JOIN companies comp ON c.company_id = comp.id
ORDER BY c.company_id, c.name;

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

-- Verificar clientes después de la inserción
SELECT 
  'Después de actualización' as estado,
  COUNT(*) as total_clientes,
  COUNT(CASE WHEN is_active = TRUE THEN 1 END) as clientes_activos
FROM clients;

-- Mostrar todos los clientes
SELECT 
  c.id,
  c.name,
  c.email,
  c.phone,
  c.contact_person,
  c.company,
  c.is_active,
  comp.name as company_name
FROM clients c
LEFT JOIN companies comp ON c.company_id = comp.id
ORDER BY c.company_id, c.name;

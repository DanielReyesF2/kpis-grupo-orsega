-- ============================================
-- ACTUALIZACIÓN: Proveedores de Logística
-- ============================================
-- Fecha: 2025-01-28
-- Descripción: Actualizar proveedores de logística con información correcta
-- Solo hay 2 proveedores de logística (transportistas)

-- Limpiar proveedores existentes (si los hay)
DELETE FROM provider WHERE company_id IN (1, 2);

-- Insertar los 2 proveedores de logística correctos
INSERT INTO provider (id, name, email, phone, contact_name, notes, rating, is_active, short_name, company_id, location, requires_rep, rep_frequency, reminder_email, created_at, updated_at) VALUES
-- Proveedor 1: Flete local Radiocamionetas
(gen_random_uuid(), 'Flete local Radiocamionetas', 'radiocamionetas@live.com.mx', NULL, NULL, 'Proveedor de flete local', 5.0, TRUE, 'Radiocamionetas', 1, 'NAC', FALSE, NULL, NULL, NOW(), NOW()),

-- Proveedor 2: Flete Potosinos  
(gen_random_uuid(), 'Flete Potosinos', 'nzepeda@potosinos.com.mx', NULL, 'Nancy Zepeda', 'Proveedor de flete Potosinos', 5.0, TRUE, 'Potosinos', 1, 'NAC', FALSE, NULL, NULL, NOW(), NOW());

-- Verificar que se insertaron correctamente
SELECT 
  p.id,
  p.name,
  p.short_name,
  p.email,
  p.contact_name,
  p.location,
  p.is_active,
  c.name as company_name
FROM provider p
LEFT JOIN companies c ON p.company_id = c.id
ORDER BY p.name;

-- Mostrar resumen
SELECT 
  COUNT(*) as total_providers,
  COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_providers,
  COUNT(CASE WHEN location = 'NAC' THEN 1 END) as national_providers
FROM provider;

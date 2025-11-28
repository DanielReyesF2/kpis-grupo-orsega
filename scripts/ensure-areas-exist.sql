-- Script para asegurar que todas las áreas estén creadas correctamente
-- Ejecutar en la base de datos

-- Verificar y crear áreas faltantes para Grupo Orsega (company_id: 2)
INSERT INTO areas (id, name, description, company_id) 
VALUES 
  (4, 'Ventas', 'Área de Ventas para Grupo Orsega', 2),
  (5, 'Logística', 'Área de Logística para Grupo Orsega', 2),
  (6, 'Contabilidad y Finanzas', 'Área de Contabilidad y Finanzas para Grupo Orsega', 2),
  (10, 'Compras', 'Área de Compras para Grupo Orsega', 2),
  (11, 'Almacén', 'Área de Almacén para Grupo Orsega', 2),
  (12, 'Tesorería', 'Área de Tesorería para Grupo Orsega', 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  company_id = EXCLUDED.company_id;

-- Verificar áreas creadas
SELECT 
    a.id,
    a.name,
    a.company_id,
    c.name as company_name
FROM areas a
LEFT JOIN companies c ON a.company_id = c.id
ORDER BY a.company_id, a.id;






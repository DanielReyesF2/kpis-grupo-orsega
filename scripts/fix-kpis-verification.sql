-- =====================================================
-- VERIFICAR Y CREAR KPIs DE LOGÍSTICA
-- =====================================================

-- Primero verificar si el usuario Thalia existe
SELECT id, name, email FROM "User" WHERE id = 7;

-- Verificar si ya existen KPIs de Logística (sin filtro de categoría primero)
SELECT id, name, category, "companyId", "userId" 
FROM "Kpi" 
WHERE "userId" = 7 
ORDER BY category, name;

-- Verificar todas las categorías disponibles
SELECT DISTINCT category FROM "Kpi" ORDER BY category;

-- Verificar estructura de la tabla Kpi
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Kpi' 
ORDER BY ordinal_position;



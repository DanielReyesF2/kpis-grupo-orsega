-- Script SQL para actualizar los valores de "goal" en las tablas kpis_dura y kpis_orsega
-- Basado en los targets definidos en server/storage.ts

-- ============================================
-- KPIs DE VENTAS
-- ============================================

-- Volumen de ventas alcanzado
UPDATE kpis_dura 
SET goal = '55,620 KG'
WHERE kpi_name ILIKE '%Volumen de ventas%' 
  AND area = 'Ventas'
  AND (goal IS NULL OR goal = '');

UPDATE kpis_orsega 
SET goal = '775,735 unidades'
WHERE kpi_name ILIKE '%Volumen de ventas%' 
  AND area = 'Ventas'
  AND (goal IS NULL OR goal = '');

-- Porcentaje de crecimiento en ventas
UPDATE kpis_dura 
SET goal = '+10% vs año anterior'
WHERE kpi_name ILIKE '%crecimiento%ventas%' 
  AND area = 'Ventas'
  AND (goal IS NULL OR goal = '');

UPDATE kpis_orsega 
SET goal = '+10% vs año anterior'
WHERE kpi_name ILIKE '%crecimiento%ventas%' 
  AND area = 'Ventas'
  AND (goal IS NULL OR goal = '');

-- Nuevos clientes adquiridos
UPDATE kpis_dura 
SET goal = '2 nuevos/mes'
WHERE kpi_name ILIKE '%Nuevos clientes%' 
  AND area = 'Ventas'
  AND (goal IS NULL OR goal = '');

UPDATE kpis_orsega 
SET goal = '2 nuevos/mes'
WHERE kpi_name ILIKE '%Nuevos clientes%' 
  AND area = 'Ventas'
  AND (goal IS NULL OR goal = '');

-- Tasa de retención de clientes
UPDATE kpis_dura 
SET goal = '90%'
WHERE kpi_name ILIKE '%retención%clientes%' 
  AND area = 'Ventas'
  AND (goal IS NULL OR goal = '');

UPDATE kpis_orsega 
SET goal = '90%'
WHERE kpi_name ILIKE '%retención%clientes%' 
  AND area = 'Ventas'
  AND (goal IS NULL OR goal = '');

-- Satisfacción interdepartamental
UPDATE kpis_dura 
SET goal = 'Retroalimentación continua'
WHERE kpi_name ILIKE '%Satisfacción interdepartamental%' 
  AND area = 'Ventas'
  AND (goal IS NULL OR goal = '');

UPDATE kpis_orsega 
SET goal = 'Retroalimentación continua'
WHERE kpi_name ILIKE '%Satisfacción interdepartamental%' 
  AND area = 'Ventas'
  AND (goal IS NULL OR goal = '');

-- ============================================
-- KPIs DE LOGÍSTICA
-- ============================================

-- Precisión de inventarios
UPDATE kpis_dura 
SET goal = '100%'
WHERE kpi_name ILIKE '%Precisión%inventarios%' 
  AND area = 'Logística'
  AND (goal IS NULL OR goal = '');

UPDATE kpis_orsega 
SET goal = '100%'
WHERE kpi_name ILIKE '%Precisión%inventarios%' 
  AND area = 'Logística'
  AND (goal IS NULL OR goal = '');

-- Cumplimiento de tiempos de entrega
UPDATE kpis_dura 
SET goal = '100%'
WHERE (kpi_name ILIKE '%Cumplimiento%tiempos%entrega%' OR kpi_name ILIKE '%Entregas%tiempo%')
  AND area = 'Logística'
  AND (goal IS NULL OR goal = '');

UPDATE kpis_orsega 
SET goal = '100%'
WHERE (kpi_name ILIKE '%Cumplimiento%tiempos%entrega%' OR kpi_name ILIKE '%Entregas%tiempo%')
  AND area = 'Logística'
  AND (goal IS NULL OR goal = '');

-- Costos de transporte
UPDATE kpis_dura 
SET goal = '< Inflación anual'
WHERE (kpi_name ILIKE '%Costos%transporte%' OR kpi_name ILIKE '%Costos logísticos%')
  AND area = 'Logística'
  AND (goal IS NULL OR goal = '');

UPDATE kpis_orsega 
SET goal = '< Inflación anual'
WHERE (kpi_name ILIKE '%Costos%transporte%' OR kpi_name ILIKE '%Costos logísticos%')
  AND area = 'Logística'
  AND (goal IS NULL OR goal = '');

-- Satisfacción de clientes internos (Logística)
UPDATE kpis_dura 
SET goal = '100%'
WHERE (kpi_name ILIKE '%Satisfacción%clientes%internos%' OR kpi_name ILIKE '%Satisfacción interdepartamental%')
  AND area = 'Logística'
  AND (goal IS NULL OR goal = '');

UPDATE kpis_orsega 
SET goal = '100%'
WHERE (kpi_name ILIKE '%Satisfacción%clientes%internos%' OR kpi_name ILIKE '%Satisfacción interdepartamental%')
  AND area = 'Logística'
  AND (goal IS NULL OR goal = '');

-- Tiempo de recuperación de evidencias
UPDATE kpis_dura 
SET goal = '< 24 horas'
WHERE kpi_name ILIKE '%Tiempo%recuperación%evidencias%' 
  AND area = 'Logística'
  AND (goal IS NULL OR goal = '');

UPDATE kpis_orsega 
SET goal = '< 24 horas'
WHERE kpi_name ILIKE '%Tiempo%recuperación%evidencias%' 
  AND area = 'Logística'
  AND (goal IS NULL OR goal = '');

-- ============================================
-- KPIs DE TESORERÍA (ya tienen goals, pero por si acaso)
-- ============================================

-- Tiempo promedio de procesamiento de pagos
UPDATE kpis_dura 
SET goal = '2 días'
WHERE kpi_name ILIKE '%Tiempo promedio%procesamiento%pagos%' 
  AND area = 'Tesorería'
  AND (goal IS NULL OR goal = '');

UPDATE kpis_orsega 
SET goal = '2 días'
WHERE kpi_name ILIKE '%Tiempo promedio%procesamiento%pagos%' 
  AND area = 'Tesorería'
  AND (goal IS NULL OR goal = '');

-- Precisión en el registro de tipos de cambio
UPDATE kpis_dura 
SET goal = '100%'
WHERE kpi_name ILIKE '%Precisión%registro%tipos%cambio%' 
  AND area = 'Tesorería'
  AND (goal IS NULL OR goal = '');

UPDATE kpis_orsega 
SET goal = '100%'
WHERE kpi_name ILIKE '%Precisión%registro%tipos%cambio%' 
  AND area = 'Tesorería'
  AND (goal IS NULL OR goal = '');

-- Cumplimiento en el envío de comprobantes
UPDATE kpis_dura 
SET goal = '100%'
WHERE kpi_name ILIKE '%Cumplimiento%envío%comprobantes%' 
  AND area = 'Tesorería'
  AND (goal IS NULL OR goal = '');

UPDATE kpis_orsega 
SET goal = '100%'
WHERE kpi_name ILIKE '%Cumplimiento%envío%comprobantes%' 
  AND area = 'Tesorería'
  AND (goal IS NULL OR goal = '');

-- Eficiencia en la gestión de complementos de pago
UPDATE kpis_dura 
SET goal = '3 días'
WHERE kpi_name ILIKE '%Eficiencia%gestión%complementos%' 
  AND area = 'Tesorería'
  AND (goal IS NULL OR goal = '');

UPDATE kpis_orsega 
SET goal = '3 días'
WHERE kpi_name ILIKE '%Eficiencia%gestión%complementos%' 
  AND area = 'Tesorería'
  AND (goal IS NULL OR goal = '');

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Ver KPIs de Ventas sin goal
SELECT 'VENTAS - DURA' as tabla, area, kpi_name, goal 
FROM kpis_dura 
WHERE area = 'Ventas' AND (goal IS NULL OR goal = '')
ORDER BY kpi_name;

SELECT 'VENTAS - ORSEGA' as tabla, area, kpi_name, goal 
FROM kpis_orsega 
WHERE area = 'Ventas' AND (goal IS NULL OR goal = '')
ORDER BY kpi_name;

-- Ver KPIs de Logística sin goal
SELECT 'LOGÍSTICA - DURA' as tabla, area, kpi_name, goal 
FROM kpis_dura 
WHERE area = 'Logística' AND (goal IS NULL OR goal = '')
ORDER BY kpi_name;

SELECT 'LOGÍSTICA - ORSEGA' as tabla, area, kpi_name, goal 
FROM kpis_orsega 
WHERE area = 'Logística' AND (goal IS NULL OR goal = '')
ORDER BY kpi_name;

-- Ver todos los KPIs actualizados
SELECT 'DURA' as empresa, area, kpi_name, goal 
FROM kpis_dura 
WHERE goal IS NOT NULL AND goal != ''
ORDER BY area, kpi_name;

SELECT 'ORSEGA' as empresa, area, kpi_name, goal 
FROM kpis_orsega 
WHERE goal IS NOT NULL AND goal != ''
ORDER BY area, kpi_name;


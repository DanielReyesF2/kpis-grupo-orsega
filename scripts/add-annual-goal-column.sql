-- Script para agregar la columna annual_goal a las tablas de KPIs
-- Este campo será usado para almacenar el objetivo anual de los KPIs de ventas

-- Agregar columna a kpis_dura
ALTER TABLE kpis_dura 
ADD COLUMN IF NOT EXISTS annual_goal TEXT;

-- Agregar columna a kpis_orsega
ALTER TABLE kpis_orsega 
ADD COLUMN IF NOT EXISTS annual_goal TEXT;

-- Comentario en las columnas para documentación
COMMENT ON COLUMN kpis_dura.annual_goal IS 'Objetivo anual del KPI (usado principalmente para KPIs de ventas)';
COMMENT ON COLUMN kpis_orsega.annual_goal IS 'Objetivo anual del KPI (usado principalmente para KPIs de ventas)';


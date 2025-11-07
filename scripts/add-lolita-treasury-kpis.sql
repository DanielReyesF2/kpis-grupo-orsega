-- Script para agregar KPIs de Tesorería para Lolita (Dolores Navarro)
-- Área Tesorería: ID 9 (Dura International), ID 12 (Grupo Orsega)

-- KPIs para Dura International (companyId: 1, areaId: 9)
INSERT INTO kpis (name, description, "areaId", "companyId", unit, target, frequency, "calculationMethod", responsible, "invertedMetric") VALUES
  (
    'Tiempo promedio de procesamiento de pagos',
    'Mide el tiempo promedio desde la recepción de un pago hasta su procesamiento completo. Objetivo: procesar pagos en menos de 2 días hábiles.',
    9,
    1,
    'días',
    '2 días',
    'weekly',
    'Promedio de días entre recepción y procesamiento de pagos',
    'Dolores Navarro',
    true
  ),
  (
    'Precisión en el registro de tipos de cambio',
    'Mide la exactitud en el registro diario de tipos de cambio. Objetivo: 100% de precisión en los registros.',
    9,
    1,
    '%',
    '100%',
    'daily',
    '(Registros correctos / Total de registros) x 100',
    'Dolores Navarro',
    false
  ),
  (
    'Cumplimiento en el envío de comprobantes',
    'Mide el porcentaje de comprobantes enviados a tiempo a proveedores. Objetivo: 100% de comprobantes enviados dentro de 24 horas.',
    9,
    1,
    '%',
    '100%',
    'weekly',
    '(Comprobantes enviados a tiempo / Total de comprobantes) x 100',
    'Dolores Navarro',
    false
  ),
  (
    'Eficiencia en la gestión de complementos de pago',
    'Mide el tiempo promedio para gestionar complementos de pago requeridos. Objetivo: procesar complementos en menos de 3 días hábiles.',
    9,
    1,
    'días',
    '3 días',
    'weekly',
    'Promedio de días para gestionar complementos de pago',
    'Dolores Navarro',
    true
  )
ON CONFLICT DO NOTHING;

-- KPIs para Grupo Orsega (companyId: 2, areaId: 12)
INSERT INTO kpis (name, description, "areaId", "companyId", unit, target, frequency, "calculationMethod", responsible, "invertedMetric") VALUES
  (
    'Tiempo promedio de procesamiento de pagos',
    'Mide el tiempo promedio desde la recepción de un pago hasta su procesamiento completo. Objetivo: procesar pagos en menos de 2 días hábiles.',
    12,
    2,
    'días',
    '2 días',
    'weekly',
    'Promedio de días entre recepción y procesamiento de pagos',
    'Dolores Navarro',
    true
  ),
  (
    'Precisión en el registro de tipos de cambio',
    'Mide la exactitud en el registro diario de tipos de cambio. Objetivo: 100% de precisión en los registros.',
    12,
    2,
    '%',
    '100%',
    'daily',
    '(Registros correctos / Total de registros) x 100',
    'Dolores Navarro',
    false
  ),
  (
    'Cumplimiento en el envío de comprobantes',
    'Mide el porcentaje de comprobantes enviados a tiempo a proveedores. Objetivo: 100% de comprobantes enviados dentro de 24 horas.',
    12,
    2,
    '%',
    '100%',
    'weekly',
    '(Comprobantes enviados a tiempo / Total de comprobantes) x 100',
    'Dolores Navarro',
    false
  ),
  (
    'Eficiencia en la gestión de complementos de pago',
    'Mide el tiempo promedio para gestionar complementos de pago requeridos. Objetivo: procesar complementos en menos de 3 días hábiles.',
    12,
    2,
    'días',
    '3 días',
    'weekly',
    'Promedio de días para gestionar complementos de pago',
    'Dolores Navarro',
    true
  )
ON CONFLICT DO NOTHING;

-- Verificar que se insertaron correctamente
SELECT 
  id,
  name,
  responsible,
  "areaId",
  "companyId"
FROM kpis 
WHERE responsible = 'Dolores Navarro'
ORDER BY "companyId", "areaId";


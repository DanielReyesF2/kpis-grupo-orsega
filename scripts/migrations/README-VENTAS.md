# Migración a Tabla Unificada `ventas`

## Resumen

Una sola tabla `ventas` para todas las empresas:
- `company_id = 1` → DURA
- `company_id = 2` → ORSEGA

## Pasos de Ejecución (en Neon)

### 1. Crear la tabla unificada
```sql
-- Ejecutar: create-unified-ventas.sql
```

### 2. Migrar datos de DURA
```sql
-- Ejecutar: migrate-ventas-dura-to-ventas.sql
```

### 3. Insertar datos de ORSEGA

**Opción A: Usando el script TypeScript**
```bash
# 1. Guardar datos del Excel en orsega-data.csv (tab-separated)
# 2. Ejecutar:
npx tsx scripts/migrations/insert-orsega-data.ts
# 3. Ejecutar el SQL generado (orsega-inserts.sql) en Neon
```

**Opción B: Insertar directamente**
Copia los INSERTs de `orsega-inserts.sql` y ejecútalos en la consola de Neon.

## Verificación

Después de ejecutar todo:
```sql
SELECT company_id,
       CASE company_id WHEN 1 THEN 'DURA' ELSE 'ORSEGA' END as empresa,
       COUNT(*) as registros,
       MIN(fecha) as desde,
       MAX(fecha) as hasta
FROM ventas
GROUP BY company_id;
```

## Estructura de la Tabla

| Columna | Tipo | Descripción |
|---------|------|-------------|
| company_id | INTEGER | 1=DURA, 2=ORSEGA |
| fecha | DATE | Fecha de la venta |
| folio | VARCHAR | Folio (DURA) |
| factura | VARCHAR | Factura (ORSEGA) |
| cliente | VARCHAR | Nombre del cliente |
| producto | VARCHAR | Nombre del producto |
| familia_producto | VARCHAR | Familia (ORSEGA) |
| cantidad | DECIMAL | Cantidad vendida |
| unidad | VARCHAR | KG, UNIDAD, etc. |
| usd | DECIMAL | Monto en USD |
| mn | DECIMAL | Monto en MN |
| tipo_cambio | DECIMAL | Tipo de cambio |
| importe_mn | DECIMAL | Importe en MN |
| anio | SMALLINT | Auto-calculado de fecha |
| mes | SMALLINT | Auto-calculado de fecha |

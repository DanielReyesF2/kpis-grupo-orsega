# 🚀 MIGRACIÓN: Agregar Columnas Completas del Excel a sales_data

## 📋 Resumen

Esta migración agrega todas las columnas del Excel de ventas a la tabla `sales_data` para guardar **toda la información completa** del archivo.

### Columnas que se agregan:
- `unit_price` (PRECIO UNITARIO)
- `total_amount` (IMPORTE)
- `quantity_2024` (VENTA 2024)
- `quantity_2025` (VENTA 2025)
- `folio` (Folio2)

---

## ⚡ Ejecutar en Neon (30 segundos)

### Opción 1: SQL Editor de Neon (Recomendado)

1. **Ir a Neon Dashboard**
   ```
   https://console.neon.tech/
   → Login
   → Selecciona tu proyecto
   ```

2. **Abrir SQL Editor**
   ```
   → Menú izquierdo: Click en "SQL Editor"
   → Se abre el editor
   ```

3. **Copiar y Pegar el SQL**
   
   Abre el archivo: `migrations/0004_add_sales_data_complete_columns.sql`
   
   O copia directamente este SQL:

```sql
-- ============================================
-- MIGRACIÓN: Agregar columnas completas del Excel a sales_data
-- ============================================
-- Fecha: 2025-01-XX
-- Descripción: Agregar todas las columnas del Excel de ventas para guardar información completa

BEGIN;

-- 1. Agregar unit_price (PRECIO UNITARIO del Excel)
ALTER TABLE sales_data
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(15, 2);

-- 2. Agregar total_amount (IMPORTE del Excel)
ALTER TABLE sales_data
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15, 2);

-- 3. Agregar quantity_2024 (VENTA 2024 del Excel)
ALTER TABLE sales_data
ADD COLUMN IF NOT EXISTS quantity_2024 DECIMAL(15, 2);

-- 4. Agregar quantity_2025 (VENTA 2025 del Excel)
ALTER TABLE sales_data
ADD COLUMN IF NOT EXISTS quantity_2025 DECIMAL(15, 2);

-- 5. Agregar folio (Folio2 del Excel)
ALTER TABLE sales_data
ADD COLUMN IF NOT EXISTS folio VARCHAR(100);

-- Crear índices para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_sales_data_quantity_2024 ON sales_data(quantity_2024) WHERE quantity_2024 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_data_quantity_2025 ON sales_data(quantity_2025) WHERE quantity_2025 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_data_total_amount ON sales_data(total_amount) WHERE total_amount IS NOT NULL;

COMMIT;
```

4. **Ejecutar**
   ```
   → Click en "Run" o presiona Ctrl+Enter
   → Deberías ver "Success" o "Query executed successfully"
   ```

---

### Opción 2: Desde Terminal (si tienes psql)

```bash
# Conectar a Neon
psql "postgresql://[tu-connection-string]"

# Ejecutar migración
\i migrations/0004_add_sales_data_complete_columns.sql
```

---

## ✅ Verificación

Después de ejecutar la migración, verifica que las columnas se agregaron correctamente:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'sales_data' 
AND column_name IN ('unit_price', 'total_amount', 'quantity_2024', 'quantity_2025', 'folio')
ORDER BY column_name;
```

Deberías ver 5 filas con las nuevas columnas.

---

## 📝 Notas Importantes

- ✅ **SAFE para producción**: Todas las columnas son NULLABLE, no afecta datos existentes
- ✅ **No destructivo**: No elimina ni modifica columnas existentes
- ✅ **Compatible**: Funciona con registros existentes (serán NULL las nuevas columnas)
- ✅ **Índices**: Se crean índices para mejorar performance en búsquedas por año

---

## 🎯 Después de la Migración

Una vez ejecutada la migración:

1. ✅ El sistema guardará **toda la información** del Excel
2. ✅ Podrás consultar precios unitarios, importes, y ventas por año
3. ✅ Los datos históricos existentes seguirán funcionando (nuevas columnas serán NULL)

---

## ❓ ¿Problemas?

Si encuentras algún error:
- Verifica que estás conectado a la base de datos correcta
- Asegúrate de tener permisos de ALTER TABLE
- Revisa los logs en Neon para ver el error específico













# Migración de Datos: ventas_dura → sales_data

## 📋 Descripción

Este proceso migra **todos los datos históricos de ventas de Dura International** (desde enero 2022 hasta octubre 2025, ~3,875 registros) desde la tabla `ventas_dura` a la tabla `sales_data` del sistema, creando automáticamente los clientes y productos que no existan.

## ⚠️ IMPORTANTE ANTES DE EJECUTAR

1. **Verifica el company_id**: El script asume que Dura International tiene `company_id = 1`. Si es diferente, edita el archivo `migrations/0005_migrate_ventas_dura_to_sales_data.sql` y cambia la línea:
   ```sql
   target_company_id INTEGER := 1; -- Cambia este valor si es necesario
   ```

2. **Backup**: Aunque el script usa transacciones, es **altamente recomendable** hacer un backup de la base de datos antes de ejecutar.

3. **Verifica que ventas_dura existe**: Asegúrate de que la tabla `ventas_dura` existe y tiene datos:
   ```sql
   SELECT COUNT(*) FROM ventas_dura;
   ```

4. **Datos existentes**: Si ya hay datos en `sales_data` para Dura International, el script detectará duplicados y los omitirá automáticamente.

## 🚀 Pasos para Ejecutar

### Paso 1: Ejecutar la Migración

#### Opción A: Neon SQL Editor (Recomendado)

1. Abre el **Neon SQL Editor** en tu dashboard de Neon
2. Copia todo el contenido del archivo `migrations/0005_migrate_ventas_dura_to_sales_data.sql`
3. Pega el SQL en el editor
4. **Revisa** que el `company_id` sea correcto (línea 12 del script)
5. Haz clic en **"Run"** o presiona `Ctrl+Enter` (o `Cmd+Enter` en Mac)
6. **Espera pacientemente**: Para ~3,875 registros, la migración puede tardar varios minutos
7. Revisa los mensajes en la consola para ver el progreso (se muestra cada 500 registros)

#### Opción B: Desde la línea de comandos

Si tienes `psql` configurado con tu conexión a Neon:

```bash
psql "tu-connection-string" -f migrations/0005_migrate_ventas_dura_to_sales_data.sql
```

### Paso 2: Verificar la Migración

Después de ejecutar la migración, ejecuta el script de verificación:

1. Abre el **Neon SQL Editor**
2. Copia todo el contenido del archivo `migrations/0006_verify_ventas_dura_migration.sql`
3. Pega y ejecuta el SQL
4. Revisa el reporte completo que se genera

El script de verificación te mostrará:
- Conteos comparativos entre `ventas_dura` y `sales_data`
- Clientes y productos creados
- Registros duplicados encontrados
- Registros inválidos que no se migraron
- Estadísticas por año
- Resumen final con recomendaciones

## 📊 Qué hace el script de migración

### Mejoras implementadas:

1. **Detección avanzada de duplicados**: 
   - Compara por: `company_id`, `cliente`, `producto`, `fecha`, `folio`, y `cantidad`
   - Más estricto que solo fecha y folio para evitar falsos positivos

2. **Validaciones de datos**:
   - Fechas válidas (entre 2020 y fecha futura razonable)
   - Cantidades > 0
   - Cliente y producto no vacíos
   - Omite registros inválidos automáticamente

3. **Reportes de progreso**:
   - Muestra progreso cada 500 registros
   - Contadores de clientes/productos creados
   - Resumen final con estadísticas

4. **Manejo de errores**:
   - Transacciones para rollback automático si falla
   - Captura errores individuales sin detener toda la migración
   - Reporta registros problemáticos

### Proceso paso a paso:

1. **Crea clientes**: Busca todos los clientes únicos en `ventas_dura` y los crea en la tabla `clients` si no existen
2. **Crea productos**: Busca todos los productos únicos en `ventas_dura` y los crea en la tabla `products` si no existen
3. **Migra ventas**: Inserta todos los registros válidos de `ventas_dura` en `sales_data`, evitando duplicados
4. **Calcula campos**: Calcula automáticamente la semana ISO (`sale_week`) basada en la fecha

## ✅ Verificación Post-Migración

### 1. Verificación en Base de Datos

Ejecuta el script de verificación (`0006_verify_ventas_dura_migration.sql`) que te dará un reporte completo.

También puedes ejecutar estas queries manualmente:

```sql
-- Conteo de registros
SELECT COUNT(*) as total_ventas_dura FROM ventas_dura;
SELECT COUNT(*) as total_sales_data FROM sales_data WHERE company_id = 1;

-- Rango de fechas
SELECT MIN(sale_date) as fecha_min, MAX(sale_date) as fecha_max 
FROM sales_data WHERE company_id = 1;

-- Clientes y productos
SELECT COUNT(*) as total_clientes FROM clients WHERE company_id = 1;
SELECT COUNT(*) as total_productos FROM products WHERE company_id = 1;

-- Estadísticas por año
SELECT 
    sale_year,
    COUNT(*) as registros,
    COUNT(DISTINCT client_name) as clientes,
    SUM(quantity) as cantidad_total_kg,
    SUM(total_amount) as importe_total
FROM sales_data
WHERE company_id = 1
GROUP BY sale_year
ORDER BY sale_year;
```

### 2. Verificación en el Frontend

Una vez migrados los datos, verifica en la aplicación:

1. **Accede a la página de Ventas de Dura**:
   - Navega a `/sales/dura` o selecciona "Dura International" en el selector de empresa
   - Los datos deberían aparecer automáticamente

2. **Verifica el rango de fechas**:
   - Los datos deberían mostrar ventas desde **2022-01-03** hasta **2025-10-31**
   - Verifica que el gráfico muestra el período completo

3. **Prueba los filtros**:
   - Filtra por año: 2022, 2023, 2024, 2025
   - Filtra por mes específico
   - Verifica que los totales coinciden con los datos originales

4. **Verifica estadísticas**:
   - Revisa que las estadísticas generales se calculan correctamente
   - Verifica que los gráficos muestran datos históricos
   - Compara totales con los datos en `ventas_dura`

5. **Verifica clientes y productos**:
   - Revisa que todos los clientes aparecen en la lista
   - Verifica que todos los productos están disponibles

### 3. Queries SQL para Verificar en el Frontend

Si necesitas verificar datos específicos desde SQL:

```sql
-- Ver algunos registros migrados recientes
SELECT 
    sale_date,
    client_name,
    product_name,
    quantity,
    unit_price,
    total_amount,
    folio
FROM sales_data
WHERE company_id = 1
ORDER BY sale_date DESC
LIMIT 20;

-- Verificar un cliente específico
SELECT 
    sale_date,
    product_name,
    quantity,
    total_amount
FROM sales_data
WHERE company_id = 1
  AND client_name ILIKE '%NOMBRE_CLIENTE%'
ORDER BY sale_date DESC;

-- Verificar un producto específico
SELECT 
    sale_date,
    client_name,
    quantity,
    unit_price
FROM sales_data
WHERE company_id = 1
  AND product_name ILIKE '%NOMBRE_PRODUCTO%'
ORDER BY sale_date DESC;
```

## 🔄 Después de la Migración

### Mantener ventas_dura como respaldo (Recomendado)

**Se recomienda mantener la tabla `ventas_dura` como respaldo** hasta que hayas verificado completamente que:

1. ✅ Todos los datos aparecen correctamente en el frontend
2. ✅ Las estadísticas se calculan correctamente
3. ✅ Los filtros funcionan como se espera
4. ✅ No hay discrepancias significativas entre los datos originales y migrados

### Eliminar ventas_dura (Opcional)

Solo después de verificar todo, puedes eliminar la tabla si lo deseas:

```sql
-- ⚠️ ADVERTENCIA: Esto elimina permanentemente la tabla
-- Solo ejecuta esto después de verificar que todo funciona correctamente
DROP TABLE IF EXISTS ventas_dura;
```

### Usar el sistema

Los datos ahora están disponibles en el sistema a través de:

- **Página de Ventas**: `/sales/dura` (para Dura International)
- **Endpoints de API**: 
  - `/api/sales-data?companyId=1` - Datos de ventas
  - `/api/sales-stats?companyId=1` - Estadísticas
  - `/api/sales-comparison?companyId=1` - Comparativos

## ❓ Solución de Problemas

### Error: "relation ventas_dura does not exist"
- **Causa**: La tabla `ventas_dura` no existe en la base de datos
- **Solución**: Verifica que ejecutaste el SQL que crea la tabla `ventas_dura` primero
- **Verificación**: `SELECT COUNT(*) FROM ventas_dura;`

### Error: "duplicate key value violates unique constraint"
- **Causa**: Puede haber un problema con índices únicos o datos duplicados
- **Solución**: 
  1. El script debería manejar esto automáticamente, pero si persiste:
  2. Revisa si hay datos duplicados en `ventas_dura` antes de ejecutar
  3. Verifica que no hay conflictos con datos existentes en `sales_data`

### Los datos no aparecen en el sistema
- **Causa 1**: El `company_id` no coincide
  - **Solución**: Verifica que el `company_id` en el script es `1` para Dura International
  - **Verificación**: `SELECT * FROM companies WHERE id = 1;`

- **Causa 2**: Los datos no se migraron correctamente
  - **Solución**: Ejecuta el script de verificación (`0006`) para ver qué pasó
  - **Verificación**: Compara conteos entre `ventas_dura` y `sales_data`

- **Causa 3**: Problemas de permisos o autenticación
  - **Solución**: Verifica que estás autenticado y tienes acceso a la empresa
  - **Verificación**: Revisa la consola del navegador para errores

### Diferencia significativa entre ventas_dura y sales_data

Si el script de verificación muestra una diferencia grande (>5%):

1. **Revisa los registros omitidos**:
   ```sql
   -- Ver registros que no se migraron
   SELECT v.* 
   FROM ventas_dura v
   WHERE NOT EXISTS (
       SELECT 1 FROM sales_data sd
       WHERE sd.company_id = 1
         AND LOWER(TRIM(sd.client_name)) = LOWER(TRIM(v.cliente))
         AND LOWER(TRIM(sd.product_name)) = LOWER(TRIM(v.producto))
         AND sd.sale_date = v.fecha
         AND (sd.folio = v.folio OR (sd.folio IS NULL AND v.folio IS NULL))
   )
   LIMIT 20;
   ```

2. **Verifica registros inválidos**:
   ```sql
   -- Ver registros con datos inválidos
   SELECT *
   FROM ventas_dura
   WHERE fecha IS NULL
      OR cliente IS NULL 
      OR TRIM(cliente) = ''
      OR producto IS NULL 
      OR TRIM(producto) = ''
      OR cantidad IS NULL 
      OR cantidad <= 0;
   ```

3. **Revisa duplicados en ventas_dura**:
   ```sql
   -- Ver duplicados en la tabla original
   SELECT fecha, cliente, producto, folio, COUNT(*) as duplicados
   FROM ventas_dura
   GROUP BY fecha, cliente, producto, folio
   HAVING COUNT(*) > 1;
   ```

### El script tarda mucho tiempo

- **Normal**: Para ~3,875 registros, puede tardar 5-15 minutos dependiendo del servidor
- **El script muestra progreso cada 500 registros**, así que verás actualizaciones
- **No canceles** la ejecución a menos que haya un error claro

### Registros duplicados encontrados

- **Es normal**: Si ya había datos en `sales_data`, el script omitirá duplicados
- **El script de verificación** te mostrará cuántos duplicados se encontraron
- **Si hay muchos duplicados**, revisa si necesitas limpiar datos existentes primero

## 📝 Notas Técnicas

- **Transacciones**: El script usa `BEGIN`/`COMMIT`, por lo que si hay un error crítico, todos los cambios se revierten automáticamente
- **Progreso**: Los mensajes `RAISE NOTICE` te mostrarán el progreso de la migración en la consola
- **Detección de duplicados**: El script compara múltiples campos para evitar falsos positivos:
  - `company_id`, `client_name`, `product_name`, `sale_date`, `folio`, `quantity`
- **Validaciones**: El script valida automáticamente:
  - Fechas válidas (2020-01-01 a fecha futura razonable)
  - Cantidades > 0
  - Cliente y producto no vacíos
- **Performance**: El script está optimizado para procesar ~3,875 registros de manera eficiente

## 🎯 Checklist Final

Antes de considerar la migración completa:

- [ ] Script de migración ejecutado sin errores críticos
- [ ] Script de verificación ejecutado y revisado
- [ ] Conteos entre `ventas_dura` y `sales_data` son razonables (>95% migrado)
- [ ] Datos aparecen en el frontend (`/sales/dura`)
- [ ] Filtros por año funcionan correctamente (2022-2025)
- [ ] Estadísticas se calculan correctamente
- [ ] Gráficos muestran datos históricos
- [ ] Clientes y productos aparecen correctamente
- [ ] No hay discrepancias significativas en totales

Una vez completado este checklist, puedes considerar la migración exitosa y mantener `ventas_dura` como respaldo o eliminarla si lo deseas.

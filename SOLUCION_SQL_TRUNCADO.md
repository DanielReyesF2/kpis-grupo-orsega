# Solución: SQL Truncado en Neon SQL Editor

## 🔍 Problema Identificado

Cuando intentaste ejecutar el SQL con todos los INSERT statements (~3,875 registros), Neon SQL Editor mostró:

```
Ready to connect
This query will still run OK, but the last 397,455 characters will be truncated from query history
```

**Resultado**: Solo se insertaron 50 registros en lugar de todos.

## 🎯 Soluciones Disponibles

### ✅ OPCIÓN 1: Subir el Excel Directamente (MÁS FÁCIL)

Ya tienes el endpoint `/api/sales/upload` que procesa archivos Excel. Esta es la opción más simple:

1. **Abre la aplicación** y ve a `/sales/dura`
2. **Haz clic en "Subir Archivo Excel"**
3. **Selecciona tu archivo Excel** con todos los datos
4. **El sistema procesará automáticamente** todos los registros

**Ventajas**:
- ✅ No hay límites de tamaño
- ✅ Validaciones automáticas
- ✅ Crea clientes y productos automáticamente
- ✅ Maneja duplicados
- ✅ Progreso en tiempo real

### ✅ OPCIÓN 2: Dividir el SQL en Chunks

Si prefieres usar SQL, puedes dividir el archivo original en chunks más pequeños:

1. **Usa el script de división**:
   ```bash
   node scripts/split-ventas-dura-sql.mjs tu_archivo_sql_completo.sql
   ```

2. **Esto creará archivos** en `migrations/ventas_dura_chunks/`:
   - `chunk_001.sql` (primeros 100 registros)
   - `chunk_002.sql` (siguientes 100 registros)
   - etc.

3. **Ejecuta cada chunk** en Neon SQL Editor en orden

### ✅ OPCIÓN 3: Usar psql desde Terminal

Si tienes `psql` instalado, puedes ejecutar el SQL completo sin límites:

```bash
# Conectar a Neon
psql "tu-connection-string-de-neon" -f tu_archivo_sql_completo.sql
```

**Obtener connection string de Neon**:
- Dashboard de Neon → Tu proyecto → Connection Details → Connection String

### ✅ OPCIÓN 4: Usar COPY FROM (PostgreSQL)

Si tienes los datos en CSV, puedes usar el comando COPY que es más eficiente:

```sql
COPY ventas_dura (fecha, folio, cliente, producto, cantidad, precio_unitario, importe, anio, mes, venta_2024, venta_2025)
FROM '/ruta/al/archivo.csv'
WITH (FORMAT csv, HEADER true, DELIMITER ',');
```

## 🚀 Recomendación

**Usa la OPCIÓN 1 (Subir Excel)** porque:
- Ya está implementada y probada
- No tiene límites de tamaño
- Procesa automáticamente todos los registros
- Maneja errores y duplicados
- Muestra progreso en tiempo real

## 📋 Pasos para Subir el Excel

1. Asegúrate de que el Excel tenga las columnas correctas:
   - Fecha
   - Folio2
   - CLIENTE
   - PRODUCTO
   - CANTIDAD
   - PRECIO UNITARIO
   - IMPORTE
   - AÑOS
   - MES
   - VENTA 2024
   - VENTA 2025

2. Ve a `/sales/dura` en la aplicación

3. Haz clic en "Subir Archivo Excel"

4. Selecciona tu archivo

5. Espera a que termine el procesamiento

6. Verifica los resultados en la página

## 🔧 Si Necesitas Usar SQL

Si por alguna razón necesitas usar SQL en lugar del Excel:

1. **Primero, limpia los 50 registros** que se insertaron incorrectamente:
   ```sql
   DELETE FROM ventas_dura;
   ```

2. **Usa el script de división** para crear chunks:
   ```bash
   node scripts/split-ventas-dura-sql.mjs tu_archivo_sql_completo.sql
   ```

3. **Ejecuta cada chunk** en orden en Neon SQL Editor

4. **Después ejecuta la migración** a `sales_data`:
   ```sql
   -- Ejecutar migrations/0005_migrate_ventas_dura_to_sales_data.sql
   ```

## ❓ Preguntas Frecuentes

### ¿Por qué Neon truncó el SQL?
Neon SQL Editor tiene un límite en el tamaño del query que puede mostrar en el historial. Esto es solo una limitación de la UI, no de PostgreSQL.

### ¿Puedo ejecutar el SQL completo de otra forma?
Sí, usando `psql` desde terminal o dividiéndolo en chunks más pequeños.

### ¿Qué pasa con los 50 registros que ya se insertaron?
Puedes eliminarlos con `DELETE FROM ventas_dura;` y empezar de nuevo, o simplemente ejecutar la migración que los moverá a `sales_data` y luego insertar el resto.

### ¿El endpoint de upload tiene límites?
El endpoint tiene un límite de 20MB por archivo, pero eso debería ser suficiente para miles de registros en Excel.
























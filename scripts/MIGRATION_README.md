# 🔄 Migración de Tablas de KPIs

## Objetivo
Consolidar 6 tablas de KPIs en 2 tablas unificadas:
- **Tablas viejas:** `kpis_dura`, `kpis_orsega`, `kpi_values_dura`, `kpi_values_orsega` (más tablas legacy)
- **Tablas nuevas:** `kpis`, `kpi_values` (con `company_id` para separar empresas)

## Estado Actual
- ✅ Tablas creadas: `kpis`, `kpi_values`, `kpi_migration_map`
- ⏳ Datos aún en tablas viejas separadas
- ⚠️ Código actual lee de tablas viejas con fallbacks

## Pasos de Migración

### Fase 1: Análisis
```bash
tsx scripts/01_analyze-kpi-tables.ts
```
Este script muestra:
- Conteos de registros en cada tabla
- Áreas y su mapeo a la tabla `areas`
- IDs duplicados
- Rangos de fechas
- Duplicados por nombre

**✅ Debe ejecutarse primero para entender el estado actual**

### Fase 2: Migrar Definiciones de KPIs
```bash
# Ejecutar con psql o tu cliente SQL favorito
psql $DATABASE_URL -f scripts/02_migrate-kpis.sql
```

**Nota:** Los scripts SQL tienen `BEGIN;` pero comentan `COMMIT;` por seguridad.
**Debes revisar los resultados y hacer `COMMIT;` manualmente si todo está bien.**

Este script:
- Migra `kpis_dura` → `kpis` (con `company_id = 1`)
- Migra `kpis_orsega` → `kpis` (con `company_id = 2`)
- Crea mapeos en `kpi_migration_map` para rastrear la migración

### Fase 3: Migrar Valores Históricos
```bash
psql $DATABASE_URL -f scripts/03_migrate-kpi-values.sql
```

Este script:
- Convierte formato `month/year` → `period`
- Migra `kpi_values_dura` → `kpi_values`
- Migra `kpi_values_orsega` → `kpi_values`
- Mantiene referencias correctas usando `kpi_migration_map`

### Fase 4: Verificación
```bash
tsx scripts/04_verify-migration.ts
```

Este script verifica:
- ✅ Todos los KPIs fueron mapeados
- ✅ Conteos coinciden
- ✅ No hay valores huérfanos
- ✅ Muestra muestra de datos migrados

**🚨 Si algún check falla, hacer ROLLBACK y revisar**

### Fase 5: Backup de Tablas Viejas
```bash
psql $DATABASE_URL -f scripts/05_backup-old-tables.sql
```

Este script:
- Renombra tablas viejas con timestamp
- NO las elimina (por seguridad)
- Puedes eliminarlas manualmente después de 1-2 semanas de monitoreo

**Solo ejecutar si la Fase 4 pasó exitosamente**

### Fase 6: Actualizar Código (Manual)
Después de la migración, necesitas actualizar:
- `server/routes.ts`: Cambiar queries de `kpis_dura/kpis_orsega` a `kpis WHERE company_id = X`
- `server/DatabaseStorage.ts`: Simplificar `getKPIHistory` para usar solo `kpis` y `kpi_values`
- `client/src/components/dashboard/SalesMetricsCards.tsx`: Usar `kpis` en lugar de fallbacks

## Orden de Ejecución Completo

```bash
# 1. Analizar estado actual
tsx scripts/01_analyze-kpi-tables.ts

# 2. Revisar resultados del análisis

# 3. Migrar definiciones de KPIs
psql $DATABASE_URL -f scripts/02_migrate-kpis.sql
# Revisar salida y hacer COMMIT; si todo está bien

# 4. Migrar valores históricos
psql $DATABASE_URL -f scripts/03_migrate-kpi-values.sql
# Revisar salida y hacer COMMIT; si todo está bien

# 5. Verificar migración
tsx scripts/04_verify-migration.ts

# 6. Si todo pasó, hacer backup de tablas viejas
psql $DATABASE_URL -f scripts/05_backup-old-tables.sql
# Revisar salida y hacer COMMIT; si todo está bien

# 7. Actualizar código de aplicación

# 8. Probar en desarrollo

# 9. Desplegar a producción

# 10. Monitorear por 1-2 semanas

# 11. Eliminar tablas de backup manualmente
```

## Rollback
Si algo sale mal en cualquier fase:
```sql
ROLLBACK;
```

## Precauciones
⚠️ **Ejecutar primero en base de datos de desarrollo/staging**
⚠️ **Hacer backup completo de la BD antes de migrar**
⚠️ **Verificar cada paso antes de hacer COMMIT**
⚠️ **Mantener tablas viejas como backup por al menos 1-2 semanas**

## Troubleshooting

### "Área no encontrada"
El script usa `LEFT JOIN` y hace fallback al `area_id` mínimo (1 o 2) si no encuentra el área.
Revisa si faltan áreas en la tabla `areas`.

### "IDs duplicados"
Si hay IDs duplicados entre `kpis_dura` y `kpis_orsega`, la migración creará nuevos IDs.
Los mapeos en `kpi_migration_map` mantienen la relación.

### "Conteos no coinciden"
Revisa:
1. Si hay KPIs duplicados por nombre
2. Si hay valores para KPIs que no existen
3. Logs de errores durante la migración

## Contacto
Si tienes problemas durante la migración, verifica:
1. Logs de la base de datos
2. Resultados de cada script
3. Tabla `kpi_migration_map` para debugging


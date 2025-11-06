# Migraciones Archivadas

Este directorio contiene scripts SQL de migración que ya han sido ejecutados en producción y se mantienen solo para referencia histórica.

## ⚠️ IMPORTANTE

**NO ejecutar estos scripts nuevamente en producción.**

Estos scripts fueron diseñados para migraciones únicas y ejecutarlos nuevamente podría causar:
- Duplicación de datos
- Errores de restricciones de base de datos
- Inconsistencias en el sistema

## Archivos

### Migraciones de datos
- `complete_migration_master.sql` - Migración maestra completa
- `clients-migration.sql` - Migración de clientes
- `production-migration.sql` - Migración de producción original
- `production-migration-fixed.sql` - Migración de producción corregida

### Migraciones de esquema
- `create_suppliers_table.sql` - Creación de tabla de proveedores
- `migrate_supplier_data.sql` - Migración de datos de proveedores

### Migraciones de KPIs
- `02_migrate-kpis.sql` - Migración de definiciones de KPIs
- `03_migrate-kpi-values.sql` - Migración de valores históricos de KPIs
- `05_backup-old-tables.sql` - Backup de tablas antiguas

### Actualizaciones de datos
- `import_fx_production.sql` - Importación de tipos de cambio
- `update_logistics_providers.sql` - Actualización de proveedores logísticos
- `update_product_names_production.sql` - Actualización de nombres de productos
- `verify_and_update_clients.sql` - Verificación y actualización de clientes

### Scripts de desarrollo (NO USAR EN PRODUCCIÓN)
- `insert_users.sql` - Script de inserción de usuarios (vacío)
- `update_passwords.sql` - Script de actualización de contraseñas (solo desarrollo)

## Uso recomendado

Si necesitas ejecutar una nueva migración:

1. Crear un nuevo archivo SQL en `scripts/migrations/` (no en archived)
2. Documentar claramente el propósito y los efectos de la migración
3. Probar en desarrollo primero
4. Ejecutar en producción con supervisión
5. Una vez ejecutado exitosamente, mover a `archived/`

## Seguridad

Algunos de estos archivos pueden contener:
- Emails de usuarios reales
- Estructuras de datos de producción
- Información sensible del negocio

**Mantener este directorio privado y no compartir estos archivos públicamente.**

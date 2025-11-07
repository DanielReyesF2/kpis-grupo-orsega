# 🔧 Fix: Error "column source_type does not exist"

**Fecha:** 2025-11-07
**Error:** `column "source_type" of relation "scheduled_payments" does not exist`
**Causa:** Schema de base de datos en Railway desincronizado con código
**Solución:** Aplicar migración 0001_add_scheduled_payments_columns.sql

---

## 📋 Resumen del Problema

### ❌ Error Reportado:
```
POST /api/payment-vouchers/upload → 500 Internal Server Error
Error: column "source_type" of relation "scheduled_payments" does not exist
```

### 🔍 Causa Raíz:
- **Railway DB:** Tiene 14 columnas (schema viejo de `0000_quick_gateway.sql`)
- **Código actual:** Espera 21 columnas (schema en `shared/schema.ts`)
- **Diferencia:** Faltan 7 columnas nuevas en Railway

### 🎯 Columnas Faltantes en Railway:
1. ❌ `supplier_id` - FK a tabla suppliers
2. ❌ `source_type` - Origen: 'idrall' | 'manual' **(LA QUE CAUSA EL ERROR)**
3. ❌ `hydral_file_url` - URL archivo Idrall
4. ❌ `hydral_file_name` - Nombre archivo Idrall
5. ❌ `approved_at` - Timestamp aprobación
6. ❌ `approved_by` - User ID aprobador
7. ❌ `payment_scheduled_at` - Fecha programada pago
8. ❌ `voucher_id` - FK a payment_vouchers

---

## 🚀 Soluciones Disponibles

Tienes **3 opciones** para aplicar la migración. Elige la que prefieras:

---

### ✅ OPCIÓN 1: Railway CLI (Recomendado)

**Ventajas:**
- ✅ Más fácil (no necesitas DATABASE_URL manualmente)
- ✅ Railway maneja las credenciales automáticamente
- ✅ Funciona desde cualquier directorio del proyecto

**Requisitos:**
```bash
# Instalar Railway CLI si no lo tienes:
npm install -g @railway/cli

# Login (si no lo has hecho):
railway login
```

**Pasos:**
```bash
# 1. Asegúrate de estar en el proyecto correcto:
railway status

# 2. Aplicar la migración:
railway run bash scripts/apply-migration-railway.sh

# 3. Verificar que funcionó:
railway run psql -c "SELECT column_name FROM information_schema.columns WHERE table_name='scheduled_payments' AND column_name='source_type';"
```

---

### ✅ OPCIÓN 2: psql con DATABASE_URL Manual

**Ventajas:**
- ✅ Control total sobre la conexión
- ✅ Útil si Railway CLI no funciona

**Requisitos:**
```bash
# Instalar psql:
# Ubuntu/Debian:
sudo apt-get install postgresql-client

# macOS:
brew install postgresql

# Windows:
# Descargar desde https://www.postgresql.org/download/windows/
```

**Pasos:**

1. **Obtener DATABASE_URL de Railway:**
   ```
   Railway Dashboard → Tu Proyecto → PostgreSQL → Variables → DATABASE_URL
   ```

   Formato: `postgresql://postgres:PASSWORD@REGION.railway.app:PORT/railway`

2. **Aplicar migración:**
   ```bash
   export DATABASE_URL='postgresql://postgres:PASSWORD@...'
   bash scripts/apply-migration-railway.sh
   ```

---

### ✅ OPCIÓN 3: pgAdmin (GUI)

**Ventajas:**
- ✅ Visual, fácil de usar
- ✅ No requiere terminal

**Requisitos:**
- pgAdmin instalado: https://www.pgadmin.org/download/

**Pasos:**

1. **Conectar a Railway DB:**
   - Abrir pgAdmin
   - Right click → "Register → Server"
   - **General Tab:**
     - Name: `Railway - KPIs`
   - **Connection Tab:**
     - Host: `REGION.railway.app` (de DATABASE_URL)
     - Port: `5432`
     - Database: `railway`
     - Username: `postgres`
     - Password: (de DATABASE_URL)

2. **Ejecutar migración:**
   - Click en tu servidor → Databases → railway
   - Tools → Query Tool
   - Abrir archivo: `migrations/0001_add_scheduled_payments_columns.sql`
   - Click ▶️ Execute

3. **Verificar:**
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'scheduled_payments'
   ORDER BY ordinal_position;
   ```
   Debe mostrar 21 columnas incluyendo `source_type`.

---

## 🔍 Verificación Post-Migración

Después de aplicar la migración, verifica que funciona:

### 1. Verificar columnas en Railway:
```bash
railway run psql -c "\d scheduled_payments"
```

Debe mostrar:
```
Column              | Type      | Modifiers
--------------------+-----------+---------------------------
...
supplier_id         | integer   |
source_type         | text      | default 'manual'
hydral_file_url     | text      |
hydral_file_name    | text      |
approved_at         | timestamp |
approved_by         | integer   |
payment_scheduled_at| timestamp |
voucher_id          | integer   |
```

### 2. Probar la funcionalidad:
- Ir a la app en Railway
- Navegar a Treasury → Upload Payment Voucher
- Subir un archivo PDF
- **✅ NO debe mostrar error 500**
- **✅ Debe subir exitosamente**

### 3. Ver logs en Railway:
```bash
railway logs
```
**NO debe mostrar:** `column "source_type" does not exist`

---

## 📂 Archivos Creados

```
migrations/
  └── 0001_add_scheduled_payments_columns.sql  ← SQL de migración

scripts/
  └── apply-migration-railway.sh              ← Script de aplicación

RAILWAY-DB-MIGRATION-FIX.md                   ← Este documento
```

---

## ⚠️ Notas Importantes

### ✅ Seguridad de la Migración:
- ✅ **NO elimina datos existentes**
- ✅ **NO modifica registros existentes**
- ✅ Todas las columnas nuevas son NULLABLE o tienen DEFAULT
- ✅ Compatible con registros previos (se les asigna `source_type='manual'`)
- ✅ Usa transacción (BEGIN/COMMIT) para rollback automático si falla

### 🔄 ¿Qué pasa con registros existentes?
- **source_type:** Se asigna `'manual'` por default
- **supplier_id:** Queda NULL (todavía usan supplier_name)
- **Otras columnas:** Quedan NULL hasta que se use la funcionalidad

### 🚫 ¿Qué NO hace la migración?
- ❌ NO borra datos
- ❌ NO cambia tipos de columnas existentes
- ❌ NO afecta otras tablas
- ❌ NO requiere downtime

---

## 🆘 Troubleshooting

### Error: "psql: command not found"
**Solución:** Instalar postgresql-client (ver Requisitos arriba)

### Error: "connection refused"
**Solución:** Verificar que DATABASE_URL es correcto y que Railway DB está activo

### Error: "permission denied"
**Solución:** El usuario de DATABASE_URL debe tener permisos de ALTER TABLE

### Error: "column already exists"
**Solución:** La migración ya fue aplicada. Verificar con:
```bash
railway run psql -c "\d scheduled_payments" | grep source_type
```

### La migración se aplicó pero sigue el error
**Solución:** Reiniciar el deployment en Railway:
```bash
# Opción 1: Railway CLI
railway up --detach

# Opción 2: Railway Dashboard
Deployments → Latest → Redeploy
```

---

## 📞 Soporte

Si ninguna opción funciona:
1. Compartir logs completos del error
2. Verificar versión de PostgreSQL: `railway run psql --version`
3. Verificar que tabla existe: `railway run psql -c "\dt" | grep scheduled`

---

## ✅ Checklist de Aplicación

- [ ] Elegí la opción de aplicación (CLI / psql / pgAdmin)
- [ ] Apliqué la migración exitosamente
- [ ] Verifiqué que las 7 columnas nuevas existen
- [ ] Probé subir un payment voucher en la app
- [ ] Ya no veo el error "column source_type does not exist"
- [ ] Committeé este documento al repo (opcional)

---

**¿Listo para aplicar?** Elige tu opción favorita arriba y sigue los pasos. 🚀

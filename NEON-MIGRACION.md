# 🎯 APLICAR MIGRACIÓN EN NEON (NO RAILWAY)

**⚡ Tiempo: 30 segundos | Interfaz web de Neon**

---

## 🚀 PASOS EXACTOS:

### 1️⃣ Ir a Neon Dashboard
```
https://console.neon.tech/
→ Login
→ Selecciona tu proyecto
```

### 2️⃣ Abrir SQL Editor
```
→ En el menú izquierdo: Click en "SQL Editor"
→ Se abre el editor
```

### 3️⃣ Copiar y Pegar el SQL

**📋 COPIA TODO ESTE SQL:**

```sql
-- ============================================
-- MIGRACIÓN: Agregar columnas faltantes a scheduled_payments
-- ============================================
-- Fecha: 2025-11-07
-- Ticket: Fix error "column source_type does not exist"

BEGIN;

-- 1. Agregar supplier_id (FK a suppliers)
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id);

-- 2. Agregar source_type (origen del pago: 'idrall' | 'manual')
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual';

-- 3. Agregar hydral_file_url (URL archivo Idrall)
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS hydral_file_url TEXT;

-- 4. Agregar hydral_file_name (nombre archivo Idrall)
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS hydral_file_name TEXT;

-- 5. Agregar approved_at (timestamp de aprobación)
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;

-- 6. Agregar approved_by (user_id que aprobó)
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS approved_by INTEGER;

-- 7. Agregar payment_scheduled_at (fecha programada de pago)
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS payment_scheduled_at TIMESTAMP;

-- 8. Agregar voucher_id (FK a payment_vouchers)
ALTER TABLE scheduled_payments
ADD COLUMN IF NOT EXISTS voucher_id INTEGER REFERENCES payment_vouchers(id);

-- 9. Actualizar default de status para nuevos registros
ALTER TABLE scheduled_payments
ALTER COLUMN status SET DEFAULT 'idrall_imported';

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_supplier_id ON scheduled_payments(supplier_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_source_type ON scheduled_payments(source_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_voucher_id ON scheduled_payments(voucher_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_status ON scheduled_payments(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_due_date ON scheduled_payments(due_date);

-- Comentarios para documentar los cambios
COMMENT ON COLUMN scheduled_payments.supplier_id IS 'FK a tabla suppliers';
COMMENT ON COLUMN scheduled_payments.source_type IS 'Origen: idrall o manual';
COMMENT ON COLUMN scheduled_payments.hydral_file_url IS 'URL del archivo original de Idrall';
COMMENT ON COLUMN scheduled_payments.hydral_file_name IS 'Nombre del archivo de Idrall';
COMMENT ON COLUMN scheduled_payments.approved_at IS 'Timestamp aprobación';
COMMENT ON COLUMN scheduled_payments.approved_by IS 'User ID aprobador';
COMMENT ON COLUMN scheduled_payments.payment_scheduled_at IS 'Fecha programada pago';
COMMENT ON COLUMN scheduled_payments.voucher_id IS 'FK a payment_vouchers';

COMMIT;

-- Verificar que funcionó
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'scheduled_payments'
  AND column_name IN ('supplier_id', 'source_type', 'hydral_file_url',
                      'hydral_file_name', 'approved_at', 'approved_by',
                      'payment_scheduled_at', 'voucher_id')
ORDER BY column_name;
```

### 4️⃣ Ejecutar
```
→ Click en botón "Run" (o presiona Cmd/Ctrl + Enter)
```

### 5️⃣ Verificar Resultado

Debes ver en la salida:
```
✅ BEGIN
✅ ALTER TABLE (8 veces)
✅ CREATE INDEX (5 veces)
✅ COMMENT (8 veces)
✅ COMMIT

Y luego una tabla con 8 filas mostrando las columnas nuevas
```

---

## ✅ ¿Cómo saber si funcionó?

### En Neon Console:
- ✅ La query dice "Query executed successfully"
- ✅ Ves la tabla con las 8 columnas nuevas

### En tu App Railway:
1. Ir a la app en Railway
2. Treasury → Upload Payment Voucher
3. Subir un archivo PDF
4. **✅ NO debe mostrar error 500**
5. **✅ Error "column source_type does not exist" desaparece**

---

## 🎯 RESUMEN

| Paso | Acción | Tiempo |
|------|--------|--------|
| 1 | https://console.neon.tech/ | 5 seg |
| 2 | SQL Editor | 5 seg |
| 3 | Copiar SQL de arriba | 5 seg |
| 4 | Pegar y Run | 5 seg |
| 5 | Ver "success" | 5 seg |
| **TOTAL** | | **25 segundos** |

---

## 🆘 Si algo sale mal:

### Error: "relation does not exist"
- Verifica que estás en la base de datos correcta (debe ser "neondb")

### Error: "permission denied"
- Verifica que estás logueado con la cuenta correcta
- El usuario "neondb_owner" debe tener permisos

### Error: "column already exists"
- ✅ Perfecto, significa que la migración ya fue aplicada
- No hay problema, prueba la app

### Todavía sale error 500
1. Ve a Railway Dashboard → Deployments
2. Click en "Redeploy" (NO solo Restart)
3. Espera el deployment completo
4. Prueba de nuevo

---

## 📸 Navegación en Neon:

1. **Login**: https://console.neon.tech/
2. **Projects**: Selecciona tu proyecto
3. **SQL Editor**: En menú izquierdo
4. **Pegar SQL**: Ctrl+V o Cmd+V
5. **Run**: Click botón verde "Run" o Cmd+Enter
6. **Ver resultado**: Scroll down para ver output

---

## 💡 Alternativa con psql (si prefieres terminal):

Si prefieres usar terminal en vez de UI:

```bash
# Usar la DATABASE_URL de tu .env
psql "postgresql://neondb_owner:npg_xG8D7eLNolUT@ep-lively-leaf-ae3nrrao-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require" -f migrations/0001_add_scheduled_payments_columns.sql
```

---

¿Listo? Solo abre https://console.neon.tech/ → SQL Editor → Pega el SQL → Run 🚀

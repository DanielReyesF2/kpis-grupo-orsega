# 🎯 MÉTODO MÁS FÁCIL - SIN RAILWAY CLI

**⚡ Tiempo: 1 minuto | Sin instalar nada | Sin terminal**

---

## 🚀 OPCIÓN ULTRA RÁPIDA: Railway Dashboard (Web)

Aplica la migración directamente desde el navegador, SIN instalar nada.

### Pasos (1 minuto):

#### 1️⃣ Ir a Railway Dashboard
```
https://railway.app/
→ Login
→ Selecciona tu proyecto "kpis-grupo-orsega"
→ Click en "PostgreSQL" (el servicio de base de datos)
```

#### 2️⃣ Abrir Query Tool
```
→ Click en pestaña "Data"
→ Click en "Query"
```

#### 3️⃣ Copiar y Pegar SQL

**📋 COPIA TODO ESTE SQL:**

```sql
-- ============================================
-- MIGRACIÓN: Agregar columnas faltantes a scheduled_payments
-- ============================================
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
COMMENT ON COLUMN scheduled_payments.supplier_id IS 'FK a tabla suppliers - permite asociar con proveedor estructurado';
COMMENT ON COLUMN scheduled_payments.source_type IS 'Origen del registro: idrall (importado) o manual (creado manualmente)';
COMMENT ON COLUMN scheduled_payments.hydral_file_url IS 'URL del archivo original de Idrall';
COMMENT ON COLUMN scheduled_payments.hydral_file_name IS 'Nombre del archivo de Idrall';
COMMENT ON COLUMN scheduled_payments.approved_at IS 'Timestamp cuando el pago fue aprobado';
COMMENT ON COLUMN scheduled_payments.approved_by IS 'User ID que aprobó el pago';
COMMENT ON COLUMN scheduled_payments.payment_scheduled_at IS 'Fecha programada para realizar el pago';
COMMENT ON COLUMN scheduled_payments.voucher_id IS 'FK a payment_vouchers - comprobante de pago asociado';

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

#### 4️⃣ Ejecutar
```
→ Click en botón "Run Query" o presiona Cmd/Ctrl + Enter
```

#### 5️⃣ Verificar Resultado

Debes ver:
```
✅ BEGIN
✅ ALTER TABLE (varias veces)
✅ CREATE INDEX (varias veces)
✅ COMMENT (varias veces)
✅ COMMIT

Y luego una tabla mostrando las 8 columnas nuevas
```

---

## ✅ ¿Cómo saber si funcionó?

### Inmediatamente después:
- ✅ La query debe decir "Query executed successfully"
- ✅ Debe mostrar una tabla con 8 filas (las columnas nuevas)

### En tu app:
1. Ir a la app en Railway
2. Treasury → Upload Payment Voucher
3. Subir un archivo PDF
4. **✅ NO debe mostrar error 500**
5. **✅ "column source_type does not exist" debe desaparecer**

---

## 🎯 RESUMEN

| Paso | Acción | Tiempo |
|------|--------|--------|
| 1 | Ir a Railway Dashboard | 10 seg |
| 2 | PostgreSQL → Data → Query | 5 seg |
| 3 | Copiar SQL de arriba | 5 seg |
| 4 | Pegar y Run Query | 5 seg |
| 5 | Ver "success" | 5 seg |
| **TOTAL** | | **30 segundos** |

---

## 🆘 Si algo sale mal:

### Error: "relation does not exist"
- Verifica que estás en la base de datos correcta (debe ser la de producción)

### Error: "permission denied"
- Tu usuario de Railway debe tener permisos de ALTER TABLE

### Error: "column already exists"
- ✅ Perfecto, la migración ya fue aplicada antes
- No hay problema, ignora y prueba la app

### Todavía sale error 500
1. Ve a Railway Dashboard → Deployments
2. Click en "Redeploy" (NO solo Restart)
3. Espera a que termine el deployment
4. Prueba de nuevo

---

## 💡 Por qué este método es mejor:

- ✅ **Cero instalaciones** (solo browser)
- ✅ **Visual** (ves exactamente qué pasa)
- ✅ **Seguro** (Railway maneja credenciales)
- ✅ **Rápido** (30 segundos)
- ✅ **Sin terminal** (todo en UI)

---

## 📸 Screenshots de Railway Dashboard

1. **Login**: https://railway.app/
2. **Projects**: Selecciona "kpis-grupo-orsega"
3. **PostgreSQL**: Click en el servicio de base de datos
4. **Data Tab**: Click en "Data" arriba
5. **Query**: Click en "Query"
6. **Pegar SQL**: Ctrl+V el SQL de arriba
7. **Run**: Click en "Run Query"

---

¿Listo? Solo copia el SQL de arriba y pégalo en Railway Dashboard → Query. 🚀

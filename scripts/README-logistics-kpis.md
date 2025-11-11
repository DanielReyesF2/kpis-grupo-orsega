# KPIs de Logística - Actualización Automática

## 📋 Resumen

Sistema de actualización automática de KPIs de Logística mediante el uso del Kanban de envíos. Cuando Thalia mueve tarjetas en el Kanban, los KPIs se actualizan automáticamente sin intervención manual.

## 🎯 KPIs Implementados

1. **Costo de Transporte** - Costo total mensual de envíos (MXN)
2. **Tiempo de Preparación** - Tiempo promedio desde creación hasta "En Ruta" (horas)
3. **Tiempo de Entrega** - Tiempo promedio desde "En Ruta" hasta "Entregado" (horas)

## ✅ Cambios Implementados

### 1. Base de Datos (schema.ts)

**Campos agregados a tabla `shipments`:**
- `transportCost` (real) - Costo de transporte en MXN
- `inRouteAt` (timestamp) - Capturado automáticamente al pasar a "in_transit"
- `deliveredAt` (timestamp) - Capturado automáticamente al pasar a "delivered"

### 2. Frontend (NewShipmentPage.tsx)

**Campo agregado al formulario:**
- "Costo de Transporte (MXN)" - Campo numérico obligatorio
- Ubicación: Paso 2, después de "Información del vehículo"
- Validación: Número >= 0

### 3. Backend (routes.ts)

**Endpoint modificado:** `PATCH /api/shipments/:id/status`

**Funcionalidades agregadas:**
1. **Captura automática de timestamps:**
   - Al cambiar a `in_transit` → Captura `inRouteAt`
   - Al cambiar a `delivered` → Captura `deliveredAt`

2. **Actualización automática de KPIs:**
   - Al marcar como `delivered` → Ejecuta `updateLogisticsKPIs()`
   - Calcula métricas del mes actual
   - Actualiza valores en tabla `KpiValue`

**Función nueva:** `updateLogisticsKPIs(companyId)`
- Obtiene todos los shipments entregados del mes
- Calcula costo total, tiempos promedio
- Actualiza o inserta en `KpiValue`
- Logging detallado para debug

## 📝 Pasos Pendientes

### 1. Crear KPIs en la Base de Datos

Ejecuta el script SQL:

```bash
# Edita el archivo primero para reemplazar [USER_ID_THALIA] y [COMPANY_ID]
nano scripts/create-logistics-kpis.sql

# Luego ejecútalo en Neon (reemplaza con tu connection string)
psql "postgresql://neondb_owner:npg_xxx@ep-xxx.aws.neon.tech/neondb?sslmode=require" < scripts/create-logistics-kpis.sql
```

**Información necesaria:**
- **[USER_ID_THALIA]**: ID del usuario de Thalia Rodríguez en tabla `User`
- **[COMPANY_ID]**: ID de la empresa (1=Digocel, 2=Orsega)

Para obtener estos IDs:
```sql
-- Ver usuarios
SELECT id, name, email FROM "User" WHERE name ILIKE '%thalia%';

-- Ver empresas
SELECT id, name FROM "Company";
```

### 2. Agregar Columnas a Tabla Shipments

Ejecuta esta migración en Neon:

```sql
-- Agregar columnas para KPIs de Logística
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS transport_cost REAL;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS in_route_at TIMESTAMP;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;

-- Verificar
\d shipments
```

### 3. Deploy a Producción

```bash
# 1. Commit cambios
git add .
git commit -m "feat: Implementar KPIs de Logística automatizados"

# 2. Push a GitHub
git push origin claude/app-audit-review-011CUyUxRrpPskEUWSVZ9AGM

# 3. Crear PR y mergear a main
# (desde GitHub UI)

# 4. Railway auto-deployará
```

### 4. Testing

Una vez en producción:

1. **Crear nuevo envío:**
   - Ir a "Nuevo Envío"
   - Llenar formulario incluyendo "Costo de Transporte"
   - Ejemplo: $1,500.00 MXN
   - Guardar

2. **Mover tarjeta a "En Ruta":**
   - Ir al Kanban de envíos
   - Mover la tarjeta a columna "En Ruta"
   - **Verificar en logs:** Debe aparecer mensaje `[KPI Logística] Capturando timestamp inRouteAt`

3. **Mover tarjeta a "Entregado":**
   - Mover la tarjeta a columna "Entregado"
   - **Verificar en logs:**
     - `[KPI Logística] Capturando timestamp deliveredAt`
     - `[KPI Logística] Actualizando KPIs para company X`
     - `[KPI Logística] ✅ KPI "Costo de Transporte" actualizado`
     - `[KPI Logística] ✅ KPI "Tiempo de Preparación" actualizado`
     - `[KPI Logística] ✅ KPI "Tiempo de Entrega" actualizado`

4. **Verificar KPIs en Dashboard:**
   - Ir a "Centro de Control de KPIs"
   - Buscar tarjeta de Thalia Rodríguez
   - Debería mostrar los 3 KPIs de Logística actualizados

## 🔧 Configuración de Metas

Las metas actuales son:
- Costo de Transporte: $50,000 MXN/mes
- Tiempo de Preparación: 24 horas
- Tiempo de Entrega: 48 horas

Para ajustarlas:
1. Ve a "Centro de Control de KPIs" → "Gestión del Equipo"
2. Busca a Thalia Rodríguez
3. Edita cada KPI y cambia el "Objetivo Mensual (goal)"

## 📊 Cómo Funcionan los Cálculos

### Costo de Transporte
```
Total = Suma de transportCost de todos los envíos entregados este mes
Compliance = (Goal / Total) * 100
Ejemplo: Goal $50,000, Total $35,000 → Compliance = 142% ✅
```

### Tiempo de Preparación
```
Tiempo = (inRouteAt - createdAt) en horas
Promedio = Suma de todos los tiempos / Cantidad de envíos
Compliance = (Goal / Promedio) * 100
Ejemplo: Goal 24h, Promedio 18h → Compliance = 133% ✅
```

### Tiempo de Entrega
```
Tiempo = (deliveredAt - inRouteAt) en horas
Promedio = Suma de todos los tiempos / Cantidad de envíos
Compliance = (Goal / Promedio) * 100
Ejemplo: Goal 48h, Promedio 36h → Compliance = 133% ✅
```

**Nota:** Para costos y tiempos, **menor es mejor**, por eso el compliance es Goal/Actual y no al revés.

## 🚨 Solución de Problemas

### Los KPIs no se actualizan

**Verifica:**
1. Los 3 KPIs existen en la tabla `Kpi` para la empresa correcta
2. Los nombres son exactamente: "Costo de Transporte", "Tiempo de Preparación", "Tiempo de Entrega"
3. Revisa los logs de Railway para ver mensajes de `[KPI Logística]`

**SQL para verificar:**
```sql
SELECT id, name, "companyId", "userId"
FROM "Kpi"
WHERE category = 'Logística';
```

### Timestamps no se capturan

**Verifica:**
1. Las columnas existen: `transport_cost`, `in_route_at`, `delivered_at`
2. El envío se está moviendo con el endpoint correcto: `PATCH /api/shipments/:id/status`
3. El status cambió realmente (no es el mismo que antes)

**SQL para verificar:**
```sql
SELECT id, tracking_code, status, in_route_at, delivered_at, transport_cost
FROM shipments
ORDER BY id DESC
LIMIT 5;
```

### Los cálculos parecen incorrectos

**Recuerda:**
- Los cálculos son **mensuales** (solo envíos entregados este mes)
- Si no hay envíos entregados este mes, los valores serán 0
- Los tiempos solo se calculan si ambos timestamps existen

**SQL para debug:**
```sql
-- Ver envíos del mes actual con timestamps
SELECT
  id,
  tracking_code,
  status,
  transport_cost,
  created_at,
  in_route_at,
  delivered_at,
  EXTRACT(EPOCH FROM (in_route_at - created_at))/3600 as prep_hours,
  EXTRACT(EPOCH FROM (delivered_at - in_route_at))/3600 as delivery_hours
FROM shipments
WHERE status = 'delivered'
AND delivered_at >= DATE_TRUNC('month', CURRENT_DATE)
ORDER BY delivered_at DESC;
```

## 📈 Mejoras Futuras

Posibles extensiones:
- KPI de "Envíos retrasados" (comparar estimatedDeliveryDate vs actualDeliveryDate)
- KPI de "Tasa de cumplimiento de fechas"
- Dashboard específico de Logística con gráficos de tendencias
- Alertas automáticas si los tiempos superan umbrales
- Comparativa mes a mes

## 🎉 Beneficios

✅ **Zero trabajo manual** - Thalia solo usa el Kanban
✅ **Datos en tiempo real** - KPIs actualizados inmediatamente
✅ **Histórico automático** - Se guarda registro mensual
✅ **Visibilidad completa** - Métricas accesibles en el dashboard
✅ **Escalable** - Fácil agregar más KPIs de logística

# 🔍 AUDITORÍA COMPLETA - MÓDULO DE VENTAS
**Fecha:** 2025-11-29
**Propósito:** Identificar problemas de escalabilidad, código hardcoded y mejoras necesarias

**NOTA IMPORTANTE:**
- Dura International = SIEMPRE KG (por diseño) ✅
- Grupo Orsega = SIEMPRE unidades (por diseño) ✅
- La separación en 2 empresas es justamente para manejar unidades diferentes

---

## ❌ PROBLEMAS CRÍTICOS ENCONTRADOS

### 1. **SIN PAGINACIÓN EN /api/sales-comparison** 🚨 **CRÍTICO**
**Ubicación:** `server/routes.ts:7387-7414`

```typescript
SELECT ... FROM sales_data current_year
LEFT JOIN sales_data previous_year ...
// ❌ NO HAY LIMIT ni OFFSET
```

**Problema:**
- Si hay 10,000 clientes, retorna TODOS los 10,000 registros
- El response puede ser de varios MB
- Timeout del navegador
- Lentitud extrema

**Escenario real:**
- Enero 2025: 100 clientes → funciona
- Diciembre 2025: 500 clientes → lento
- 2026: 2,000 clientes → **CRASH**

**Solución:**
```typescript
// Agregar paginación:
const { page = 1, limit = 50 } = req.query;
const offset = (page - 1) * limit;

query += ` LIMIT $5 OFFSET $6`;
params.push(limit, offset);

// Retornar también el total count:
res.json({
  data: comparison,
  pagination: {
    page,
    limit,
    total: totalCount,
    pages: Math.ceil(totalCount / limit)
  }
});
```

---

### 2. **SIN PAGINACIÓN EN /api/sales-data** ⚠️ **ALTA PRIORIDAD**
**Ubicación:** `server/routes.ts:7619`

```typescript
const { limit = '100' } = req.query;  // Default 100
// ❌ NO HAY OFFSET - no hay paginación real
```

**Problema:**
- Solo muestra los primeros 100 registros
- No hay forma de ver el resto
- No es paginación real (falta offset)

**Solución:**
```typescript
const { limit = '100', offset = '0' } = req.query;

query += ` ORDER BY sale_date DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
params.push(parseInt(limit as string), parseInt(offset as string));
```

---

### 3. **FECHAS HARDCODED EN MÚLTIPLES ENDPOINTS** ⚠️ **ALTA PRIORIDAD**

#### `/api/sales-monthly-trends` (línea 7500-7502):
```typescript
const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth() + 1;
// ❌ Usa la fecha actual, no el periodo seleccionado por el usuario
```

#### `/api/sales-top-clients` (línea 7557-7559):
```typescript
const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth() + 1;
// ❌ Usa la fecha actual, no el periodo seleccionado por el usuario
```

**Problema:**
- El usuario selecciona "Octubre 2024" pero estos endpoints siguen mostrando Noviembre 2025
- Inconsistencia entre KPIs y gráficas
- Confusión para el usuario

**Solución:**
```typescript
// Aceptar year/month como parámetros opcionales en todos los endpoints
const { year, month } = req.query;
let targetYear, targetMonth;

if (year && month) {
  targetYear = parseInt(year as string);
  targetMonth = parseInt(month as string);
} else {
  // Buscar el mes más reciente con datos (como en /api/sales-stats)
  const mostRecent = await sql`...`;
  targetYear = mostRecent[0].sale_year;
  targetMonth = mostRecent[0].sale_month;
}
```

---

### 4. **LÍMITES HARDCODED EN FRONTEND** ⚠️ **MEDIA PRIORIDAD**
**Ubicación:** `client/src/pages/SalesPage.tsx`

```typescript
// Línea 121: Hardcoded months=12
/api/sales-monthly-trends?companyId=${selectedCompany}&months=12

// Línea 132: Hardcoded limit=5
/api/sales-top-clients?companyId=${selectedCompany}&limit=5
```

**Problema:**
- El usuario no puede ver más de 12 meses de tendencia
- Solo ve top 5 clientes (¿qué pasa con el cliente #6?)

**Solución:**
```typescript
// Agregar controles configurables:
const [monthsToShow, setMonthsToShow] = useState(12);
const [topClientsLimit, setTopClientsLimit] = useState(10);

// UI con selector
<select value={monthsToShow} onChange={...}>
  <option value="6">6 meses</option>
  <option value="12">12 meses</option>
  <option value="24">24 meses</option>
</select>
```

---

### 5. **REFETCH INTERVALS HARDCODED** ⚠️ **BAJA PRIORIDAD**
**Ubicación:** `client/src/pages/SalesPage.tsx`

```typescript
refetchInterval: 30000  // 30 segundos
refetchInterval: 60000  // 60 segundos
```

**Problema:**
- Polling constante consume recursos
- 30 segundos es muy frecuente para datos de ventas (que cambian semanalmente)
- No es configurable

**Solución:**
```typescript
// Opción A: Aumentar intervalos (5-10 minutos)
refetchInterval: 300000  // 5 minutos

// Opción B: Usar WebSockets para updates en tiempo real
// Opción C: Botón manual de "Refrescar"
```

---

## 📊 PROBLEMAS DE ESCALABILIDAD

### 6. **FALTA ÍNDICE COMPUESTO EN QUERIES COMPLEJAS**
**Ubicación:** `server/sales-schema.ts`

**Query problemática:**
```sql
WHERE company_id = $1 AND sale_year = $2 AND sale_month = $3
```

**Índices actuales:**
```sql
CREATE INDEX idx_sales_data_company_id ON sales_data(company_id);
CREATE INDEX idx_sales_data_year_month ON sales_data(company_id, sale_year DESC, sale_month DESC);
```

**Problema:**
- El query usa 3 columnas pero el índice solo optimiza parcialmente
- Con 100K+ registros, la query será lenta

**Solución:**
```sql
-- Índice específico para las queries más comunes
CREATE INDEX idx_sales_data_period_lookup
  ON sales_data(company_id, sale_year, sale_month, client_id);

-- Índice para comparaciones year-over-year
CREATE INDEX idx_sales_data_client_comparison
  ON sales_data(company_id, client_id, sale_year, sale_month)
  INCLUDE (quantity, unit);
```

---

### 7. **SIN LÍMITE EN /api/sales-available-periods**
**Ubicación:** `server/routes.ts:7355-7360`

```typescript
SELECT DISTINCT sale_year, sale_month
FROM sales_data
WHERE company_id = $1
ORDER BY sale_year DESC, sale_month DESC
// ❌ NO HAY LIMIT
```

**Problema:**
- Si tienen 10 años de datos = 120 registros
- Si tienen 20 años = 240 registros
- Aunque es poco, es innecesario

**Solución:**
```typescript
// Limitar a últimos 5 años (60 meses)
LIMIT 60

// O agregar parámetro configurable
const { yearsBack = 5 } = req.query;
LIMIT ${yearsBack * 12}
```

---

## 🗑️ CÓDIGO NO UTILIZADO / INCOMPLETO

### 8. **VISTA DE "UPLOAD" NO FUNCIONAL**
**Ubicación:** `client/src/pages/SalesPage.tsx:744+`

```typescript
{viewMode === "upload" && (
  <div className="space-y-6">
    // ... UI de upload
  </div>
)}
```

**Problema:**
- Hay botón "Subir Excel Semanal" pero la funcionalidad no está implementada
- No hay endpoint `/api/sales-upload`
- Confunde al usuario (botón que no hace nada)

**Opciones:**
1. **Implementar la funcionalidad completa** (recomendado)
2. Ocultar el botón hasta que esté listo
3. Mostrar mensaje "Próximamente"

---

### 9. **TABLA `sales_uploads` SIN USO**
**Ubicación:** `server/sales-schema.ts:29-42`

**Problema:**
- Tabla creada pero nunca se insertan registros
- Campo `upload_id` en `sales_data` siempre NULL
- Espacio desperdiciado

**Solución:**
- Implementar sistema de uploads
- O eliminar la tabla si no se va a usar

---

## 🎯 RECOMENDACIONES POR PRIORIDAD

### 🔴 URGENTE (Implementar en próxima semana)

1. ✅ **Agregar paginación a `/api/sales-comparison`**
   - Sin esto, el sistema crasheará con 1000+ clientes

2. ✅ **Sincronizar fechas en `/api/sales-top-clients` y `/api/sales-monthly-trends`**
   - Actualmente muestran datos diferentes al periodo seleccionado

3. ✅ **Agregar paginación completa a `/api/sales-data`**

### 🟡 IMPORTANTE (Implementar en próximo mes)

4. ✅ **Agregar índices compuestos en PostgreSQL**

5. ✅ **Implementar funcionalidad de upload de Excel**

6. ✅ **Optimizar límites en /api/sales-available-periods**

### 🟢 MEJORAS (Implementar cuando haya tiempo)

7. ✅ **Hacer límites configurables en frontend**

8. ✅ **Optimizar refetch intervals**

9. ✅ **Agregar cache layer (Redis)**

---

## 📋 CHECKLIST DE ESCALABILIDAD

Para que el módulo soporte crecimiento sostenido:

- [ ] **Paginación** en todos los endpoints que retornan listas
- [ ] **Índices optimizados** para queries frecuentes
- [ ] **Configuración** en lugar de valores hardcoded
- [ ] **Validación** de límites máximos (ej: max 1000 registros por request)
- [ ] **Compresión** de responses grandes (gzip)
- [ ] **Cache** de queries costosas
- [ ] **Lazy loading** en frontend
- [ ] **Virtualización** de tablas largas
- [ ] **Agregaciones pre-calculadas** para reportes comunes
- [ ] **Archivado** de datos viejos (ej: >3 años)

---

## 🚀 PLAN DE ACCIÓN SUGERIDO

### Fase 1: Fixes Críticos (1 semana)
```
1. Agregar paginación a /api/sales-comparison
2. Sincronizar fechas en todos los endpoints
3. Agregar paginación completa a /api/sales-data
```

### Fase 2: Optimización (2 semanas)
```
4. Agregar índices compuestos en PostgreSQL
5. Hacer límites configurables en frontend
6. Optimizar /api/sales-available-periods
```

### Fase 3: Funcionalidad Completa (3 semanas)
```
7. Implementar upload de Excel
8. Sistema de alertas automáticas
9. Reportes exportables
```

### Fase 4: Optimización (ongoing)
```
10. Cache layer
11. Agregaciones pre-calculadas
12. Archivado de datos históricos
```

---

## 💡 CONCLUSIÓN

El módulo funciona **para volúmenes pequeños**, pero tiene **problemas críticos de escalabilidad**:

✅ **Lo que está bien:**
- Arquitectura base sólida
- Multi-tenant correcto
- Queries SQL bien estructuradas
- **Unidades por empresa correctamente diseñadas (Dura=KG, Orsega=unidades)**

❌ **Lo que DEBE arreglarse:**
- Falta de paginación en endpoints clave
- Inconsistencia de fechas entre endpoints
- Código incompleto (upload de Excel)
- Límites hardcoded en frontend

⚠️ **Estimación:** Sin fixes, el sistema fallará cuando:
- Haya >1,000 clientes (sin paginación)
- Haya >50,000 registros de ventas (queries lentos)
- Usuarios esperan más funcionalidad (upload, reportes)

**Tiempo estimado de fixes críticos:** 30-40 horas de desarrollo

---

**Generado por:** Claude Code
**Auditor:** Sistema automatizado
**Próxima revisión:** Después de implementar Fase 1

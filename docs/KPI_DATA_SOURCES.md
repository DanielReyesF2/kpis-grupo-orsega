# Documentación de Fuentes de Datos y Cálculos de KPIs

Este documento describe todas las fuentes de datos, endpoints API, funciones de cálculo y componentes relacionados con KPIs para identificar y resolver discrepancias.

## 1. Endpoints API

### 1.1 Obtener Overview/Resumen de KPIs

**Endpoint:** `GET /api/kpi-overview`

**Implementación:** `server/DatabaseStorage.ts::getKPIOverview()`

**Descripción:** Retorna un resumen de todos los KPIs con sus valores actuales, status y compliance.

**Lógica de obtención del último valor:**
- Crea un mapa `latestValueMap` que agrupa valores por `companyId-kpiId`
- Itera sobre todos los valores y mantiene el más reciente por fecha (`created_at`)
- Usa `getCompanyKpiValuesNormalized()` que obtiene TODOS los valores sin ordenar

**Cálculo de status:**
- Usa `parseNumericValue()` para convertir valores a números
- Determina si es "lower is better" con `isLowerBetterKPI()`
- Umbrales:
  - **Lower is better:** `<= target` = compliant, `<= target * 1.1` = alert
  - **Higher is better:** `>= target` = compliant, `>= target * 0.9` = alert
- Si no puede parsear valores, usa "alert" si hay valor, "non-compliant" si no

**Uso de target/goal:**
- Usa `kpi.target ?? kpi.goal ?? null`
- En `mapKpiRecord()`, `target` se mapea desde `goal` (línea 135)

**Compliance:**
- No calcula compliancePercentage en el overview
- Solo retorna el valor actual y el status calculado

---

### 1.2 Obtener Detalle de un KPI

**Endpoint:** `GET /api/kpis/:id`

**Implementación:** `server/DatabaseStorage.ts::getKpi()`

**Descripción:** Retorna la metadata de un KPI específico.

**Campos retornados:**
- `target`: Mapeado desde `goal` en `mapKpiRecord()`
- `goal`: Valor original de la BD
- Todos los demás campos del KPI

---

### 1.3 Obtener Valores Históricos de un KPI

**Endpoint:** `GET /api/kpi-values?kpiId=:kpiId`

**Implementación:** `server/DatabaseStorage.ts::getKpiValues()`

**Descripción:** Retorna los valores históricos de un KPI.

**Lógica de ordenamiento:**
- Usa `getCompanyKpiValuesByKpiNormalized()` que ordena por:
  - `desc(year)` primero
  - `desc(created_at)` segundo
  - Limita a 12 registros

**Mapeo de valores:**
- `mapKpiValueRecord()` convierte el registro de BD a formato normalizado
- `value` se convierte a string: `record.value?.toString() ?? "0"`
- `date` se toma de `created_at`
- `compliancePercentage` y `status` se toman directamente de la BD

---

### 1.4 Obtener Historial de KPI

**Endpoint:** `GET /api/kpi-history/:kpiId?months=:months&companyId=:companyId`

**Implementación:** `server/DatabaseStorage.ts::getKPIHistory()`

**Descripción:** Retorna el historial de valores de un KPI para un número específico de meses.

**Lógica:**
- Usa `getCompanyKpiValuesByKpiNormalized()` que ya ordena y limita
- Retorna los valores mapeados directamente

---

## 2. Funciones de Cálculo

### 2.1 Cálculo de Status

#### 2.1.1 `calculateKpiStatus()` (Frontend)

**Ubicación:** `client/src/lib/utils/kpi-status.ts`

**Parámetros:**
- `currentValue: string | number`
- `target: string | number`
- `isLowerBetter: boolean = false`

**Lógica:**
- Convierte valores a números usando `parseFloat(value.replace(/[^0-9.-]+/g, ''))`
- Si no puede convertir, retorna `'alert'`
- Umbral: `0.9` (90% del objetivo para alerta)
- **Lower is better:**
  - `<= target` → `'complies'`
  - `<= target * (1 + (1 - 0.9))` = `<= target * 1.1` → `'alert'`
  - `> target * 1.1` → `'not_compliant'`
- **Higher is better:**
  - `>= target` → `'complies'`
  - `>= target * 0.9` → `'alert'`
  - `< target * 0.9` → `'not_compliant'`

**Retorna:** `KpiStatus` ('complies' | 'alert' | 'not_compliant')

---

#### 2.1.2 Cálculo en `getKPIOverview()` (Backend)

**Ubicación:** `server/DatabaseStorage.ts::getKPIOverview()` (líneas 1334-1359)

**Lógica:**
- Usa `parseNumericValue()` que hace: `raw.replace(/[^\d.-]/g, "")`
- Determina "lower is better" con `isLowerBetterKPI()`
- Umbrales:
  - **Lower is better:**
    - `<= target` → `"compliant"`
    - `<= target * 1.1` → `"alert"`
    - `> target * 1.1` → `"non-compliant"`
  - **Higher is better:**
    - `>= target` → `"compliant"`
    - `>= target * 0.9` → `"alert"`
    - `< target * 0.9` → `"non-compliant"`

**Diferencias con `calculateKpiStatus()`:**
- Retorna strings diferentes: `"compliant"` vs `"complies"`, `"non-compliant"` vs `"not_compliant"`
- Misma lógica de umbrales pero con nombres diferentes

---

### 2.2 Cálculo de Compliance Percentage

#### 2.2.1 `calculateCompliance()` (Frontend)

**Ubicación:** `client/src/lib/utils/kpi-status.ts`

**Parámetros:**
- `currentValue: string | number`
- `target: string | number`
- `isLowerBetter: boolean = false`

**Lógica:**
- Convierte valores a números
- Si no puede convertir, retorna `"0.0%"`
- **Lower is better:**
  - Si `currentValue === 0`: `(target / 0)` → retorna `200` (valor excepcional)
  - Si no: `(target / currentValue) * 100` (no limitado a 100%)
- **Higher is better:**
  - Si `target === 0`: retorna `100` si hay valor, `0` si no
  - Si no: `(currentValue / target) * 100`

**Retorna:** String formateado como `"95.5%"`

---

#### 2.2.2 Cálculo en `collaborators-performance` (Backend)

**Ubicación:** `server/routes.ts` (líneas 1296-1314)

**Lógica:**
- Primero intenta usar `compliancePercentage` del valor en BD
- Si no existe o es 0, calcula desde valor y meta
- Usa `extractNumericValue()` para parsear
- **Lower is better:** `(target / value) * 100`, limitado a 100% con `Math.min()`
- **Higher is better:** `(value / target) * 100`, limitado a 100% con `Math.min()`

**Diferencias con `calculateCompliance()`:**
- Limita el resultado a 100% (frontend no limita para "lower is better")
- Maneja el caso de `currentValue === 0` de manera diferente

---

### 2.3 Determinación de "Lower is Better"

#### 2.3.1 `isLowerBetterKPI()` (Backend)

**Ubicación:** `server/DatabaseStorage.ts` (líneas 1386-1406)

**Lista de KPIs:**
- 'días de cobro'
- 'días de pago'
- 'tiempo de entrega'
- 'tiempo promedio'
- 'tiempo de respuesta'
- 'tiempo de ciclo'
- 'días de inventario'
- 'rotación de inventario'
- 'defectos'
- 'errores'
- 'quejas'
- 'devoluciones'
- 'huella de carbono'
- 'costos'
- 'gastos'

**Lógica:** Busca si el nombre del KPI contiene alguno de estos patrones (case-insensitive)

---

## 3. Componentes Frontend

### 3.1 KpiCard (Preview/Resumen)

**Ubicación:** `client/src/components/dashboard/KpiCard.tsx`

**Props recibidas:**
- `currentValue: string` - Valor actual del KPI
- `target: string` - Objetivo del KPI
- `status: KpiStatus` - Estado del KPI
- `compliancePercentage?: string` - Porcentaje de cumplimiento (opcional)

**Comportamiento:**
- **No calcula nada**, solo muestra los valores recibidos
- Si no recibe `compliancePercentage`, lo calcula desde `status`:
  - `'complies'` → `'100%'`
  - `'alert'` → `'85%'`
  - `'not_compliant'` → `'0%'` o el `currentValue` si contiene '%'

**Fuente de datos:** Recibe props desde el componente padre (probablemente `KPIOverview`)

---

### 3.2 KpiDetailDialog (Vista de Detalle)

**Ubicación:** `client/src/components/kpis/KpiDetailDialog.tsx`

**Queries:**
1. `GET /api/kpis/:kpiId` - Metadata del KPI
2. `GET /api/kpi-values?kpiId=:kpiId` - Valores históricos

**Obtención del último valor:**
- Ordena `kpiValues` por fecha descendente
- Toma el primer elemento: `kpiValues.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]`

**Cálculos:**
- No calcula status directamente (usa el que viene de la BD)
- Puede calcular compliance si es necesario para mostrar

**Diferencias con Overview:**
- Ordena en el frontend vs usar un mapa pre-calculado
- Puede tener diferentes valores si hay múltiples valores con la misma fecha

---

### 3.3 KPIOverview

**Ubicación:** `client/src/components/dashboard/KPIOverview.tsx`

**Query:** `GET /api/kpi-overview`

**Procesamiento:**
- Recibe el array completo del overview
- Filtra por empresa seleccionada
- Mapea los datos para mostrar en `KpiCard`

**Mapeo de status:**
- Convierte `"compliant"` → `'complies'`
- Convierte `"non-compliant"` → `'not_compliant'`
- Mantiene `"alert"` → `'alert'`

---

## 4. Puntos de Inconsistencia Identificados

### 4.1 Obtención del Último Valor

**Problema:** Diferentes métodos para obtener el último valor

1. **Overview:** Usa un mapa que itera sobre TODOS los valores y mantiene el más reciente
2. **Detalle:** Ordena y toma el primero (limitado a 12 en la query)

**Riesgo:** Si hay múltiples valores con la misma fecha, pueden seleccionar diferentes valores

---

### 4.2 Cálculo de Status

**Problema:** Dos funciones diferentes con nombres de retorno diferentes

1. **Backend (`getKPIOverview`):** Retorna `"compliant"`, `"alert"`, `"non-compliant"`
2. **Frontend (`calculateKpiStatus`):** Retorna `'complies'`, `'alert'`, `'not_compliant'`

**Riesgo:** Inconsistencias si el mapeo no se hace correctamente

---

### 4.3 Cálculo de Compliance

**Problema:** Diferentes fórmulas y límites

1. **Frontend (`calculateCompliance`):** No limita a 100% para "lower is better"
2. **Backend (`collaborators-performance`):** Limita a 100% siempre

**Riesgo:** Valores diferentes de compliance en diferentes partes de la aplicación

---

### 4.4 Uso de Target vs Goal

**Problema:** Confusión entre `target` y `goal`

- En la BD solo existe `goal`
- En el código se mapea `target = goal` en `mapKpiRecord()`
- Algunos lugares usan `target`, otros `goal`, otros `target ?? goal`

**Riesgo:** Inconsistencias si en el futuro se agrega un campo `target` real

---

## 5. Recomendaciones

1. **Unificar obtención del último valor:** Crear una función centralizada que use la misma lógica en todos lados
2. **Unificar cálculo de status:** Usar `calculateKpiStatus()` como fuente única, adaptando el backend para usar los mismos nombres
3. **Unificar cálculo de compliance:** Decidir si limitar a 100% o no, y aplicar consistentemente
4. **Estandarizar target/goal:** Decidir usar solo `goal` o solo `target`, y actualizar todo el código

---

## 6. Archivos Clave

- `server/DatabaseStorage.ts` - Lógica principal del backend
- `client/src/lib/utils/kpi-status.ts` - Funciones de cálculo del frontend
- `client/src/components/dashboard/KpiCard.tsx` - Componente de preview
- `client/src/components/kpis/KpiDetailDialog.tsx` - Componente de detalle
- `server/routes.ts` - Endpoints API
- `shared/schema.ts` - Definición de tablas y tipos





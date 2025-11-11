# 🔍 AUDITORÍA PROFUNDA: Problema del 1292%

## Problema Identificado

El dashboard muestra **1292%** de cumplimiento para Grupo Orsega cuando debería mostrar ~83%. Además, muestra **10 meses en verde** cuando antes mostraba solo **5 meses**.

## Causas Raíz Encontradas

### 1. ❌ **Valor Hardcodeado en `SalesSummary.tsx` (LÍNEA 98)**
```typescript
const monthlyTarget = currentCompanyId === 1 ? 55620 : 858373;
```
**Problema**: Este valor hardcodeado se usaba ANTES de calcular el `totalTarget` desde el `annualGoal`, causando que los meses se evaluaran con un objetivo mensual incorrecto.

**Solución**: ✅ Movido el cálculo de `monthlyTarget` para que se calcule DESPUÉS del `totalTarget` desde el `annualGoal`.

### 2. ❌ **Valor Hardcodeado en `server/routes.ts` (LÍNEA 2323)**
```typescript
const monthlyTarget = numericCompanyId === 1 ? 55620 : 858373;
```
**Problema**: Este valor se usa para calcular compliance cuando se actualiza un valor de ventas, pero no considera el `annualGoal` del KPI.

**Solución**: ⚠️ **PENDIENTE** - Necesita actualizarse para usar el `annualGoal` del KPI.

### 3. ⚠️ **Posible Problema con `goal` Mensual en Base de Datos**
Si el `goal` mensual del KPI es **55,000** (incorrecto) en lugar de **858,373**, y no hay `annualGoal`:
- Se calcula: `55,000 * 12 = 660,000` (objetivo anual incorrecto)
- Resultado: `8,527,860 / 660,000 = 1292%` ❌

**Solución**: ✅ Ya establecimos el `annualGoal` en la BD (10,300,476), pero necesitamos verificar que se esté cargando correctamente.

### 4. ⚠️ **Validación `isValidKpiTarget` Podría Estar Rechazando el `annualGoal`**
```typescript
const minReasonableTargetForKpi = companyId === 1 ? 500000 : 8000000;
const isValidKpiTarget = calculatedFromKpi && calculatedFromKpi >= minReasonableTargetForKpi;
```
**Problema**: Si el `annualGoal` es 10,300,476, debería pasar la validación (10,300,476 > 8,000,000), pero si hay un problema de parsing, podría fallar.

**Verificación**: ✅ El parsing funciona correctamente (probado).

## Cambios Aplicados

### ✅ `SalesSummary.tsx`
1. Movido el cálculo de `totalTarget` y `monthlyTarget` ANTES del `useEffect` que procesa los datos
2. `monthlyTarget` ahora se calcula desde `totalTarget / 12` en lugar de ser hardcodeado
3. Agregados logs de debugging para rastrear qué valores se están usando

### ✅ `SalesMetricsCards.tsx`
1. Ya tenía la lógica correcta para priorizar `annualGoal` del KPI
2. Agregada invalidación de queries para refrescar datos más frecuentemente
3. Mejorados los logs de debugging

## Verificaciones Necesarias

1. **Verificar que el `annualGoal` se esté cargando desde la BD**:
   ```sql
   SELECT id, kpi_name, goal, annual_goal 
   FROM kpis_orsega 
   WHERE LOWER(kpi_name) LIKE '%volumen%ventas%';
   ```
   Debería mostrar: `annual_goal = 10300476`

2. **Verificar en la consola del navegador**:
   - Buscar logs que digan: `[SalesMetricsCards] ✅ Usando annualGoal del KPI: 10300476`
   - Si no aparece, el `annualGoal` no se está cargando correctamente

3. **Verificar localStorage**:
   - Limpiar `localStorage` de `orsegaAnnualTarget` y `salesTargets` si existen valores incorrectos

## Próximos Pasos

1. ⚠️ **Actualizar `server/routes.ts` línea 2323** para usar `annualGoal` del KPI en lugar de valor hardcodeado
2. ✅ Verificar que el frontend esté cargando correctamente el `annualGoal` desde la API
3. ✅ Limpiar localStorage si tiene valores incorrectos
4. ✅ Recargar la página y verificar los logs en la consola

## Cálculo Esperado

- **Ventas YTD**: 8,527,860 unidades
- **Objetivo Anual**: 10,300,476 unidades (desde `annualGoal` del KPI)
- **Objetivo Mensual**: 10,300,476 / 12 = 858,373 unidades
- **Cumplimiento Anual**: 8,527,860 / 10,300,476 = **82.8%** ✅
- **Meses en Meta**: Debería mostrar los meses que realmente cumplieron con 858,373 unidades/mes


# 🔍 AUDITORÍA: Problemas de Actualización de Datos

## Problemas Reportados
1. **Objetivo anual no se actualiza en el frontend** después de guardar
2. **Historial de ventas no se actualiza** después de guardar cambios

## Causas Raíz Identificadas

### Problema 1: Query Keys Inconsistentes
- **Issue**: El query key `/api/kpis/${kpiId}` no incluye `companyId`
- **Impacto**: El cache puede no invalidarse correctamente cuando hay múltiples empresas
- **Ubicación**: `KpiUpdateModal.tsx` línea 70

### Problema 2: Invalidación de Queries Insuficiente
- **Issue**: Las invalidaciones no usan `exact: false` en todos los casos
- **Impacto**: Algunas variantes de query keys no se invalidan
- **Ubicación**: `KpiUpdateModal.tsx` líneas 462-467, `KpiHistoryBulkEditModal.tsx` líneas 182-185

### Problema 3: Refetch Condicionado
- **Issue**: `refetchKpi()` está condicionado a `isOpen && !!kpiId`
- **Impacto**: Si el modal se cierra antes del refetch, los datos no se actualizan
- **Ubicación**: `KpiUpdateModal.tsx` línea 83

### Problema 4: Cache del Backend
- **Issue**: El backend puede estar devolviendo datos cacheados
- **Impacto**: Los datos actualizados no se reflejan inmediatamente
- **Ubicación**: `routes.ts` GET `/api/kpis/:id`

### Problema 5: Invalidación Incompleta del Historial
- **Issue**: La invalidación del historial no cubre todas las variantes de query keys
- **Impacto**: El historial no se refresca después de actualizaciones bulk
- **Ubicación**: `KpiHistoryBulkEditModal.tsx` líneas 182-185

## Soluciones Implementadas

### Solución 1: Query Keys Consistentes
- Incluir `companyId` en todos los query keys relacionados con KPIs
- Usar `exact: false` en todas las invalidaciones

### Solución 2: Invalidación Agresiva
- Invalidar TODAS las queries relacionadas con `predicate`
- Forzar refetch inmediato después de actualizaciones

### Solución 3: Refetch Incondicional
- Refetch inmediatamente después de invalidar queries
- No condicionar el refetch al estado del modal

### Solución 4: Verificación del Backend
- Verificar que el backend devuelva los datos actualizados
- Agregar logs detallados para debugging

### Solución 5: Invalidación Completa del Historial
- Invalidar todas las variantes de `/api/kpi-history` con `exact: false`
- Incluir `companyId` en la invalidación

## Verificación
1. Actualizar objetivo anual → Verificar que se refleje en el frontend
2. Actualizar historial → Verificar que se refleje en todas las vistas
3. Verificar logs del servidor → Confirmar que los datos se guardan correctamente
4. Verificar cache del navegador → Limpiar cache si es necesario


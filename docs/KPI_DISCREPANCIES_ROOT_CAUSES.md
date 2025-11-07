# Causas Raíz de Discrepancias en KPIs

Este documento identifica las causas raíz de las discrepancias entre preview, detalle y base de datos.

## Resumen Ejecutivo

Se identificaron **4 causas raíz principales** que generan discrepancias:

1. **Obtención inconsistente del último valor**
2. **Cálculo duplicado de status con nombres diferentes**
3. **Cálculo inconsistente de compliance percentage**
4. **Confusión entre target y goal**

---

## 1. Obtención Inconsistente del Último Valor

### Problema

El "último valor" de un KPI se obtiene de diferentes maneras en diferentes partes del sistema:

#### En Overview (`getKPIOverview`)
- Crea un `latestValueMap` que itera sobre **TODOS** los valores de la empresa
- Mantiene el valor más reciente por `companyId-kpiId`
- Usa `getCompanyKpiValuesNormalized()` que retorna TODOS los valores sin ordenar
- Compara fechas usando `new Date(value.date)` vs `new Date(existing.date)`

#### En Detalle (`KpiDetailDialog`)
- Usa `getCompanyKpiValuesByKpiNormalized()` que:
  - Ordena por `desc(year), desc(created_at)`
  - Limita a 12 registros
- Luego ordena en el frontend: `kpiValues.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]`

### Causa Raíz

**Diferentes algoritmos de selección:**
- Overview: Itera sobre todos y mantiene el máximo
- Detalle: Ordena y toma el primero (limitado a 12)

**Riesgo:** Si hay múltiples valores con la misma fecha o si hay valores fuera del límite de 12, pueden seleccionar diferentes valores.

### Impacto

- **Alto:** Los usuarios ven valores diferentes en preview vs detalle
- **Frecuencia:** Cada vez que se consulta un KPI

### Solución Propuesta

Crear función centralizada `getLatestKpiValue(companyId, kpiId)` que:
1. Use la misma lógica de ordenamiento en todos lados
2. Ordene por `created_at DESC` (más reciente primero)
3. Tome el primer registro
4. No limite el número de registros para la selección (solo para performance si es necesario)

---

## 2. Cálculo Duplicado de Status con Nombres Diferentes

### Problema

Existen dos funciones que calculan el status del KPI con la misma lógica pero retornan nombres diferentes:

#### Backend: `getKPIOverview()`
```typescript
// Retorna: "compliant" | "alert" | "non-compliant"
if (currentNumber >= targetNumber) {
  status = "compliant";
} else if (currentNumber >= targetNumber * 0.9) {
  status = "alert";
} else {
  status = "non-compliant";
}
```

#### Frontend: `calculateKpiStatus()`
```typescript
// Retorna: 'complies' | 'alert' | 'not_compliant'
if (numericCurrentValue >= numericTarget) {
  return 'complies';
} else if (numericCurrentValue >= numericTarget * threshold) {
  return 'alert';
} else {
  return 'not_compliant';
}
```

### Causa Raíz

**Duplicación de lógica:**
- Misma lógica de umbrales (0.9, 1.0, 1.1)
- Misma lógica de "lower is better"
- Pero diferentes nombres de retorno

**Mapeo inconsistente:**
- `KPIOverview` mapea `"compliant"` → `'complies'` y `"non-compliant"` → `'not_compliant'`
- Pero si el mapeo falla o hay un lugar que no mapea, se muestran valores inconsistentes

### Impacto

- **Medio:** Puede causar confusión pero el mapeo generalmente funciona
- **Frecuencia:** Solo cuando hay errores en el mapeo o nuevos lugares que no mapean

### Solución Propuesta

1. **Usar `calculateKpiStatus()` como fuente única**
2. **Adaptar el backend** para usar los mismos nombres de retorno
3. **Eliminar el mapeo** en `KPIOverview` ya que no será necesario

---

## 3. Cálculo Inconsistente de Compliance Percentage

### Problema

El porcentaje de cumplimiento se calcula de diferentes maneras:

#### Frontend: `calculateCompliance()`
```typescript
// Lower is better: NO limita a 100%
percentage = (numericTarget / numericCurrentValue) * 100;

// Higher is better: NO limita
percentage = (numericCurrentValue / numericTarget) * 100;
```

#### Backend: `collaborators-performance`
```typescript
// Lower is better: LIMITA a 100%
compliance = Math.min((numericTarget / numericValue) * 100, 100);

// Higher is better: LIMITA a 100%
compliance = Math.min((numericValue / numericTarget) * 100, 100);
```

### Causa Raíz

**Diferentes filosofías:**
- Frontend: Permite valores > 100% para mostrar cuando se supera el objetivo
- Backend: Limita a 100% para mantener consistencia visual

**Manejo de casos especiales:**
- Frontend: Si `currentValue === 0` y es "lower is better", retorna 200%
- Backend: No tiene este caso especial

### Impacto

- **Alto:** Valores de compliance diferentes en diferentes partes
- **Frecuencia:** Cada vez que se calcula compliance

### Solución Propuesta

1. **Decidir una filosofía única:**
   - Opción A: Limitar a 100% siempre (más conservador)
   - Opción B: Permitir > 100% para mostrar superación (más informativo)
   
2. **Recomendación:** Opción B (permitir > 100%) porque:
   - Es más informativo
   - Muestra cuando se supera el objetivo
   - El frontend ya lo implementa así

3. **Unificar en una sola función** que todos usen

---

## 4. Confusión entre Target y Goal

### Problema

El sistema usa tanto `target` como `goal` de manera inconsistente:

#### En la Base de Datos
- Solo existe el campo `goal` en las tablas `kpis_dura` y `kpis_orsega`
- No existe campo `target`

#### En el Código
- `mapKpiRecord()` mapea: `target: record.goal ?? null`
- Algunos lugares usan `kpi.target`
- Otros usan `kpi.goal`
- Otros usan `kpi.target ?? kpi.goal`

### Causa Raíz

**Legacy/Compatibilidad:**
- Probablemente hubo un cambio de `target` a `goal` (o viceversa) en el pasado
- Se mantuvo el mapeo para compatibilidad
- Pero crea confusión sobre cuál usar

**Inconsistencia en uso:**
- `getKPIOverview()` usa: `kpi.target ?? kpi.goal ?? null`
- `mapKpiRecord()` siempre mapea `target = goal`
- Entonces `target` siempre existe si `goal` existe

### Impacto

- **Bajo:** Generalmente funciona porque `target` se mapea desde `goal`
- **Riesgo:** Si en el futuro se agrega un campo `target` real, habrá confusión

### Solución Propuesta

1. **Estandarizar en `goal`:**
   - Es el campo que existe en la BD
   - Es más semánticamente correcto (objetivo = goal)

2. **Actualizar todo el código** para usar solo `goal`

3. **Eliminar el mapeo** de `target` en `mapKpiRecord()` (o mantenerlo solo para compatibilidad temporal)

---

## Priorización de Soluciones

### Prioridad Alta (Impacto Alto + Frecuencia Alta)

1. **Unificar obtención del último valor** - Afecta directamente lo que ven los usuarios
2. **Unificar cálculo de compliance** - Valores diferentes en diferentes lugares

### Prioridad Media (Impacto Medio o Frecuencia Baja)

3. **Unificar cálculo de status** - Generalmente funciona pero puede fallar

### Prioridad Baja (Impacto Bajo)

4. **Estandarizar target/goal** - Funciona pero crea confusión conceptual

---

## Plan de Implementación

Ver plan principal en `an-lisis-de-discrepancias-kpis.plan.md` para los pasos detallados de implementación.


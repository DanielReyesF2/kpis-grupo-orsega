# Guía de Validación de Corrección de Discrepancias en KPIs

Este documento describe cómo validar que las discrepancias entre preview, detalle y base de datos se han resuelto.

## Validación Automática

### 1. Ejecutar Script de Auditoría

El script de auditoría compara valores entre diferentes fuentes y genera un reporte:

```bash
npm run audit:kpi-discrepancies
# o
tsx scripts/audit-kpi-discrepancies.ts
```

**Qué verifica:**
- Último valor en overview vs detalle vs BD
- Cálculo de status en diferentes lugares
- Uso consistente de target vs goal
- Cálculo de compliance percentage

**Salida esperada:**
- Si no hay discrepancias: "✅ No se encontraron discrepancias"
- Si hay discrepancias: Lista detallada de cada KPI con problemas

### 2. Ejecutar Tests

Los tests validan que las funciones centralizadas funcionan correctamente:

```bash
npm test shared/__tests__/kpi-utils.test.ts
```

**Qué verifica:**
- Funciones de cálculo retornan valores consistentes
- Lógica de "lower is better" funciona correctamente
- Normalización de status es consistente

## Validación Manual

### 1. Verificar Preview vs Detalle

**Pasos:**
1. Abrir el dashboard y ver el preview de un KPI
2. Anotar: valor actual, status, compliance percentage
3. Abrir el detalle del mismo KPI
4. Comparar los valores

**Valores esperados:**
- ✅ Mismo valor actual
- ✅ Mismo status (puede estar en formato diferente pero equivalente)
- ✅ Mismo compliance percentage (o muy cercano, ±0.1%)

### 2. Verificar con Base de Datos

**Pasos:**
1. Identificar un KPI específico
2. Consultar directamente en la BD:
   ```sql
   SELECT * FROM kpi_values_dura WHERE kpi_id = X ORDER BY created_at DESC LIMIT 1;
   -- o
   SELECT * FROM kpi_values_orsega WHERE kpi_id = X ORDER BY created_at DESC LIMIT 1;
   ```
3. Comparar el valor en BD con el mostrado en preview y detalle

**Valores esperados:**
- ✅ El valor en BD coincide con el mostrado en preview
- ✅ El valor en BD coincide con el mostrado en detalle
- ✅ El status calculado coincide con el status en BD (si existe)

### 3. Verificar Cálculo de Status

**Pasos:**
1. Seleccionar un KPI con valor conocido
2. Calcular manualmente el status usando la fórmula:
   - **Higher is better:** `>= target` = complies, `>= target * 0.9` = alert, `< target * 0.9` = not_compliant
   - **Lower is better:** `<= target` = complies, `<= target * 1.1` = alert, `> target * 1.1` = not_compliant
3. Comparar con el status mostrado

**Valores esperados:**
- ✅ El status calculado manualmente coincide con el mostrado

### 4. Verificar Cálculo de Compliance

**Pasos:**
1. Seleccionar un KPI con valor y target conocidos
2. Calcular manualmente el compliance:
   - **Higher is better:** `(value / target) * 100`
   - **Lower is better:** `(target / value) * 100`
3. Comparar con el compliance mostrado

**Valores esperados:**
- ✅ El compliance calculado manualmente coincide con el mostrado (o muy cercano, ±0.1%)

## Checklist de Validación

### Funcionalidad Básica
- [ ] Preview muestra valores correctos
- [ ] Detalle muestra valores correctos
- [ ] Preview y detalle muestran los mismos valores
- [ ] Los valores coinciden con la base de datos

### Cálculos
- [ ] Status se calcula correctamente
- [ ] Compliance percentage se calcula correctamente
- [ ] Los cálculos son consistentes entre preview y detalle

### Casos Especiales
- [ ] KPIs "lower is better" se calculan correctamente
- [ ] KPIs sin valores muestran estado apropiado
- [ ] KPIs sin target muestran estado apropiado
- [ ] Valores con formato especial (comas, símbolos) se parsean correctamente

### Rendimiento
- [ ] Preview carga rápidamente
- [ ] Detalle carga rápidamente
- [ ] No hay consultas duplicadas innecesarias

## Problemas Conocidos y Soluciones

### Problema: Valores diferentes en preview vs detalle

**Causa posible:** Diferentes métodos de obtención del último valor

**Solución:** Verificar que ambos usen `getLatestKpiValue()`

**Verificación:**
```typescript
// En getKPIOverview debería usar:
const latestValue = await this.getLatestKpiValue(companyId, kpi.id);

// En el endpoint de detalle debería usar:
const latestValue = await storage.getLatestKpiValue(companyId, kpiId);
```

### Problema: Status diferente en preview vs detalle

**Causa posible:** Diferentes funciones de cálculo

**Solución:** Verificar que ambos usen `calculateKpiStatus()` de `shared/kpi-utils.ts`

**Verificación:**
```typescript
// Debería importar desde shared/kpi-utils.ts
import { calculateKpiStatus } from '@shared/kpi-utils';
```

### Problema: Compliance diferente en preview vs detalle

**Causa posible:** Diferentes fórmulas o límites

**Solución:** Verificar que ambos usen `calculateCompliance()` de `shared/kpi-utils.ts`

## Reporte de Validación

Después de completar la validación, documentar:

1. **Fecha de validación:** [fecha]
2. **KPIs validados:** [número] de [total]
3. **Discrepancias encontradas:** [número]
4. **Discrepancias resueltas:** [número]
5. **Problemas pendientes:** [lista]

## Próximos Pasos

Si se encuentran discrepancias después de la implementación:

1. Ejecutar el script de auditoría para identificar todas las discrepancias
2. Revisar el código en los lugares identificados
3. Verificar que se estén usando las funciones centralizadas
4. Actualizar el código si es necesario
5. Re-ejecutar la validación





# Fix: Corregir Porcentaje de Ventas Orsega (1292%)

## Problema Identificado

La tarjeta de ventas de Orsega muestra **1292%** porque el **goal mensual del KPI está mal configurado** en la base de datos:

- **Ventas YTD actual**: 8,527,860 unidades
- **Goal mensual en DB**: 55,000 unidades ❌
- **Objetivo anual calculado**: 660,000 unidades (55,000 × 12) ❌
- **Resultado**: 8,527,860 ÷ 660,000 = **1292%** ❌

## Solución

El goal mensual debe ser **858,373 unidades** (objetivo anual 10,300,476):

- **Goal mensual correcto**: 858,373 unidades ✓
- **Objetivo anual correcto**: 10,300,476 unidades ✓
- **Resultado esperado**: 8,527,860 ÷ 10,300,476 = **~83%** ✓

## Instrucciones

### Opción 1: Ejecutar desde Consola de Neon (Recomendado)

1. Abre tu dashboard de Neon: https://console.neon.tech
2. Selecciona tu proyecto `kpis-grupo-orsega`
3. Ve a la pestaña **SQL Editor**
4. Copia y pega el contenido del archivo `fix-orsega-sales-goal.sql`
5. Ejecuta el script
6. Verifica que el goal cambió de `55000` a `858373`

### Opción 2: Ejecutar desde Railway

1. Abre Railway: https://railway.app
2. Selecciona tu proyecto
3. Ve al servicio de base de datos
4. Abre la terminal PostgreSQL
5. Ejecuta el script SQL

### Opción 3: Actualizar desde la Interfaz (Manual)

1. Entra al sistema como administrador
2. Ve a **Centro de Control de KPIs**
3. Busca el KPI **"Volumen de Ventas"** de Orsega (Company 2)
4. Edita el campo **"Goal"** y cámbialo de `55000` a `858373`
5. Guarda los cambios

## Verificación

Después de ejecutar el script:

1. Recarga el Dashboard
2. La tarjeta de Orsega debería mostrar **~83%** en lugar de 1292%
3. Verifica en la consola del navegador que el log muestre:
   ```
   [SalesMetricsCards] Objetivo anual - Company 2:
   {
     monthlyGoalFromDb: 858373,
     calculatedFromKpi: 10300476,
     finalTarget: 10300476,
     percentage: 83
   }
   ```

## Causa Raíz

El KPI fue creado o actualizado con un goal mensual incorrecto (55,000) que es ~15.6 veces menor al valor correcto. Esto puede haber sido:
- Un error de entrada de datos
- Una migración incorrecta
- Un valor de prueba que nunca se actualizó

## Archivos Relacionados

- `scripts/fix-orsega-sales-goal.sql` - Script SQL de corrección
- `client/src/components/dashboard/SalesMetricsCards.tsx:16` - Valor fallback correcto (10,300,476)
- `server/routes.ts` - Endpoint que sirve los datos de KPIs

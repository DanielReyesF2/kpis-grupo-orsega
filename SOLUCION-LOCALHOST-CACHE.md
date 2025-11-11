# 🔧 Solución: Los cambios no se ven en localhost

## Problema

Los cambios de código están aplicados, los datos están en la base de datos, pero **no se ven en localhost** porque el navegador tiene caché.

## ✅ Solución Rápida

### Opción 1: Limpiar localStorage (Recomendado)

1. Abre las **DevTools** del navegador (F12 o Cmd+Option+I en Mac)
2. Ve a la pestaña **"Application"** (o "Aplicación" en español)
3. En el menú izquierdo, expande **"Storage"** > **"Local Storage"** > **"http://localhost:8080"**
4. Busca y **elimina** estas claves:
   - `orsegaAnnualTarget`
   - `duraAnnualTarget`
   - `salesTargets`
5. **Recarga la página** con **Ctrl+Shift+R** (Windows/Linux) o **Cmd+Shift+R** (Mac) para hacer un hard refresh

### Opción 2: Hard Refresh

Simplemente recarga la página con:
- **Windows/Linux**: `Ctrl + Shift + R` o `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

Esto fuerza al navegador a descargar todos los recursos nuevamente.

### Opción 3: Limpiar todo el caché del navegador

1. Abre las **DevTools** (F12)
2. **Click derecho** en el botón de recargar
3. Selecciona **"Vaciar caché y volver a cargar de forma forzada"** (o "Empty Cache and Hard Reload")

## 🔍 Verificar que funciona

Después de limpiar el caché, abre la **consola del navegador** (F12 > Console) y busca estos mensajes:

```
[SalesMetricsCards] ✅ Usando annualGoal del KPI: 10300476
[SalesSummary] ✅ Usando annualGoal del KPI: 10300476
```

Si ves estos mensajes, significa que está usando el `annualGoal` correcto.

## 📊 Verificar los datos en la BD

Ejecuta este comando para verificar que los datos están correctos:

```bash
npx tsx scripts/verify-annual-goals.mjs
```

Debería mostrar:
- ✅ Dura: `annual_goal = 667449`
- ✅ Orsega: `annual_goal = 10300476`

## 🚨 Si aún no funciona

1. **Reinicia el servidor de desarrollo**:
   ```bash
   # Detén el servidor (Ctrl+C) y vuelve a iniciarlo
   npm run dev
   ```

2. **Verifica que el servidor esté usando la BD correcta**:
   - El `.env` debe tener `DATABASE_URL` apuntando a Neon
   - Verifica con: `echo $DATABASE_URL` (debe mostrar la URL de Neon)

3. **Verifica en la consola del navegador**:
   - Busca errores en rojo
   - Busca los logs de `[SalesMetricsCards]` y `[SalesSummary]`
   - Si no aparecen, el componente no se está montando correctamente

## 💡 Nota Importante

**Localhost y producción usan la MISMA base de datos** (según tu `.env`). Por lo tanto:
- ✅ Los datos están disponibles en ambos
- ✅ Los cambios en la BD se reflejan en ambos
- ⚠️  Pero el **caché del navegador** puede estar mostrando datos viejos

La solución es siempre **limpiar el caché del navegador** cuando cambias datos en la BD.


# 🔍 Diagnóstico: Datos no se muestran en Localhost

## ✅ Estado Actual

Según el diagnóstico realizado:
- ✅ **Conexión a BD**: Funciona correctamente
- ✅ **Base de datos**: Hay datos (14 usuarios, 2 compañías, 16 KPIs, 73 valores)
- ✅ **DATABASE_URL**: Configurada correctamente apuntando a Neon (producción/cloud)
- ✅ **NODE_ENV**: `development`

## 🔧 Posibles Causas

### 1. **Usuario no está autenticado**
El frontend solo carga datos si el usuario está logueado.

**Solución:**
- Asegúrate de estar logueado en la aplicación
- Verifica que el token JWT esté en `localStorage`
- Abre DevTools (F12) → Console → Ejecuta: `localStorage.getItem('authToken')`
- Debe devolver un token (string largo)

### 2. **Errores de CORS o Red**
Las peticiones pueden estar fallando silenciosamente.

**Solución:**
1. Abre DevTools (F12) → Network
2. Recarga la página
3. Busca peticiones a `/api/kpis`, `/api/companies`, `/api/kpi-values`
4. Verifica si tienen código de estado:
   - ✅ **200**: Todo bien
   - ❌ **401**: No autenticado (necesitas login)
   - ❌ **500**: Error del servidor
   - ❌ **Failed/CORS**: Error de conexión

### 3. **Servidor no está corriendo**
El servidor debe estar en ejecución para que funcione.

**Solución:**
```bash
# Verifica que el servidor esté corriendo
npm run dev

# Debe mostrar:
# ✅ Server listening on port 8080
# 🗄️ DATABASE_URL exists: true
```

### 4. **Filtros activos**
Puede que haya filtros activos que ocultan los datos.

**Solución:**
- Verifica que no haya filtros de compañía/área activos
- Asegúrate de que la compañía seleccionada tenga datos

## 🛠️ Pasos para Diagnosticar

### Paso 1: Verificar autenticación
```javascript
// En la consola del navegador (F12)
console.log('Token:', localStorage.getItem('authToken'));
console.log('Usuario:', JSON.parse(sessionStorage.getItem('user') || '{}'));
```

### Paso 2: Verificar peticiones API
1. Abre DevTools → Network
2. Filtra por "XHR" o "Fetch"
3. Recarga la página
4. Busca peticiones a:
   - `/api/companies`
   - `/api/kpis`
   - `/api/kpi-values`
5. Haz clic en cada una y verifica:
   - Status code
   - Response (debe tener datos JSON)

### Paso 3: Verificar errores en consola
Abre DevTools → Console y busca:
- ❌ Errores en rojo
- ⚠️ Warnings en amarillo
- Mensajes como "Failed to fetch", "401", "CORS"

### Paso 4: Verificar servidor
En la terminal donde corre `npm run dev`, busca:
- ✅ "Server listening on port..."
- ✅ "DATABASE_URL exists: true"
- ❌ Errores de conexión a BD

## 🔄 Solución Rápida

1. **Cierra sesión y vuelve a iniciar sesión**
   - Esto regenera el token JWT

2. **Reinicia el servidor**
   ```bash
   # Detén el servidor (Ctrl+C)
   # Luego reinicia:
   npm run dev
   ```

3. **Limpia el caché del navegador**
   - Ctrl+Shift+Delete (Chrome/Edge)
   - O abre en modo incógnito

4. **Verifica la consola del navegador**
   - Abre DevTools (F12)
   - Ve a la pestaña Console
   - Busca errores relacionados con:
     - `apiRequest`
     - `QueryClient`
     - `401 Unauthorized`
     - `CORS`

## 📊 Verificación de Datos

Ejecuta este script para verificar que hay datos en la BD:

```bash
npx tsx server/test-db-connection.ts
```

Este script mostrará:
- ✅ Número de usuarios
- ✅ Número de compañías
- ✅ Número de KPIs
- ✅ Número de valores de KPI

## 🆘 Si Nada Funciona

1. **Revisa los logs del servidor** en la terminal
2. **Revisa la consola del navegador** (F12 → Console)
3. **Revisa la pestaña Network** (F12 → Network)
4. **Comparte los errores** que veas

## 💡 Nota Importante

La base de datos está en Neon (cloud), **no es el problema**. El problema probablemente es:
- ❌ No estás autenticado
- ❌ Hay errores de CORS/red
- ❌ El servidor no está corriendo
- ❌ Hay filtros activos que ocultan datos





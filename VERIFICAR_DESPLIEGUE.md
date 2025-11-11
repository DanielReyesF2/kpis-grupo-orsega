# Verificar y Forzar Despliegue en Railway

## 🔍 Verificar Estado del Despliegue

### 1. Verificar en Railway Dashboard

1. Ve a [Railway Dashboard](https://railway.app/dashboard)
2. Selecciona tu proyecto "kpis-grupo-orsega"
3. Ve a la pestaña **"Deployments"** o **"Deploys"**
4. Verifica si hay un despliegue reciente después del commit `1590309d`
5. Si hay un despliegue, verifica su estado:
   - ✅ **Success**: El despliegue fue exitoso
   - ⏳ **Building/Deploying**: Aún está en proceso
   - ❌ **Failed**: El despliegue falló (revisa los logs)

### 2. Verificar Logs de Railway

1. En Railway Dashboard, ve a la pestaña **"Logs"**
2. Busca errores recientes, especialmente:
   - Errores de build
   - Errores de healthcheck
   - Errores de inicio del servidor

### 3. Verificar Healthcheck

1. Verifica que el endpoint `/health` responda:
   ```bash
   curl https://tu-app.railway.app/health
   ```
2. Debe responder con `{"status":"healthy","service":"kpis-grupo-orsega"}`

## 🚀 Forzar un Nuevo Despliegue

### Opción 1: Usando Railway Dashboard (Más fácil)

1. Ve a Railway Dashboard
2. Selecciona tu proyecto
3. Ve a la pestaña **"Settings"**
4. Busca la sección **"Source"** o **"Git"**
5. Haz clic en **"Redeploy"** o **"Trigger Deploy"**
6. Selecciona la rama `main` y confirma

### Opción 2: Usando Railway CLI

```bash
# Instalar Railway CLI si no lo tienes
npm install -g @railway/cli

# Login en Railway
railway login

# Link al proyecto (si no está linkeado)
railway link

# Forzar un nuevo despliegue
railway up
```

### Opción 3: Hacer un Commit Vacío (Forzar Webhook)

```bash
# Crear un commit vacío para forzar el despliegue
git commit --allow-empty -m "chore: Trigger Railway deployment"
git push origin main
```

## 🔧 Solucionar Problemas Comunes

### Problema: Healthcheck Falla

Si el healthcheck está fallando, Railway no completará el despliegue:

1. Verifica los logs de Railway
2. Verifica que el endpoint `/health` responda correctamente
3. Verifica que el servidor esté escuchando en el puerto correcto

### Problema: Build Falla

Si el build falla:

1. Verifica los logs de build en Railway
2. Verifica que todas las dependencias estén correctas en `package.json`
3. Verifica que el Dockerfile esté correcto

### Problema: Cambios No Aparecen

Si los cambios no aparecen después de un despliegue exitoso:

1. Limpia la caché del navegador (Ctrl+Shift+R o Cmd+Shift+R)
2. Verifica que estés accediendo a la URL correcta de producción
3. Verifica que el commit correcto esté desplegado en Railway

## 📝 Verificar que los Cambios Están Desplegados

### 1. Verificar Versión del Build

En los logs de Railway, busca la línea:
```
VITE_BUILD_VERSION=1590309d
```

Esto confirma que el commit correcto fue desplegado.

### 2. Verificar Endpoint de Health

```bash
curl https://tu-app.railway.app/health
```

Debe responder con:
```json
{
  "status": "healthy",
  "service": "kpis-grupo-orsega",
  "timestamp": "2025-11-07T..."
}
```

### 3. Verificar Cambios Específicos

Si hiciste cambios en el código, verifica que esos cambios estén presentes en producción accediendo a la funcionalidad específica que cambiaste.





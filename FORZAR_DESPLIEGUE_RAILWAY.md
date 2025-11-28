# 🚀 Forzar Despliegue en Railway - Guía Rápida

## ⚠️ Problema: Railway No Detecta Cambios Automáticamente

Si Railway no está iniciando el build automáticamente después de hacer push, sigue estos pasos:

## 🔧 Solución 1: Verificar Configuración en Railway Dashboard (RECOMENDADO)

### Paso 1: Verificar Conexión con GitHub

1. Ve a [Railway Dashboard](https://railway.app/dashboard)
2. Selecciona tu proyecto **"kpis-grupo-orsega"**
3. Ve a **Settings** → **Service**
4. Verifica la sección **"Source"** o **"Git Repository"**
5. Debe mostrar: `DanielReyesF2/kpis-grupo-orsega`
6. Si no está conectado:
   - Haz clic en **"Connect Repository"** o **"Link GitHub Repository"**
   - Selecciona `DanielReyesF2/kpis-grupo-orsega`
   - Selecciona la rama `main`
   - Guarda los cambios

### Paso 2: Verificar Auto-Deploy

1. En **Settings** → **Service**
2. Busca **"Auto-Deploy"** o **"Auto Deploy"**
3. Asegúrate de que esté **HABILITADO** (toggle ON)
4. Verifica que esté configurado para la rama `main`

### Paso 3: Forzar Despliegue Manual

1. En Railway Dashboard, ve a la pestaña **"Deployments"**
2. Haz clic en el botón **"Deploy"** o **"New Deployment"**
3. O ve a **Settings** → **Service** → **"Redeploy"**
4. Selecciona la rama `main`
5. Haz clic en **"Deploy"**

## 🛠️ Solución 2: Usar Railway CLI (Alternativa)

### Instalación y Configuración

```bash
# Instalar Railway CLI globalmente
npm install -g @railway/cli

# O usar npx (sin instalar)
npx @railway/cli login
```

### Login y Link

```bash
# Login en Railway
railway login

# Link al proyecto (si no está linkeado)
# Te pedirá seleccionar el proyecto
railway link

# Verificar que estás en el proyecto correcto
railway status
```

### Forzar Despliegue

```bash
# Opción 1: Desplegar desde el código actual
railway up

# Opción 2: Desplegar desde GitHub
railway up --detach

# Ver logs en tiempo real
railway logs
```

## 🔍 Solución 3: Verificar Webhook de GitHub

Si Railway no detecta cambios, el webhook puede estar mal configurado:

1. Ve a tu repositorio en GitHub: `https://github.com/DanielReyesF2/kpis-grupo-orsega`
2. Ve a **Settings** → **Webhooks**
3. Busca un webhook de Railway (debe tener URL de `railway.app`)
4. Si no existe:
   - Railway debería crearlo automáticamente cuando conectas el repo
   - Si no, reconecta el repositorio en Railway Dashboard

## 🎯 Solución 4: Despliegue Manual con Commit

Si nada funciona, puedes forzar un despliegue creando un cambio mínimo:

```bash
# Agregar un comentario en un archivo
echo "# Build trigger $(date)" >> .build-trigger
git add .build-trigger
git commit -m "chore: Trigger Railway deployment"
git push origin main
```

## 📊 Verificar que el Build Está Corriendo

### En Railway Dashboard:

1. Ve a **"Deployments"** o **"Deploys"**
2. Deberías ver un nuevo despliegue con estado:
   - 🔵 **Queued**: En cola
   - 🟡 **Building**: Construyendo
   - 🟢 **Deploying**: Desplegando
   - ✅ **Active**: Activo y funcionando

### Ver Logs en Tiempo Real:

```bash
# Con Railway CLI
railway logs --follow

# O en Railway Dashboard → Logs
```

## ⚡ Solución Rápida: Clear Cache y Redeploy

Si el build está fallando o no inicia:

1. En Railway Dashboard → **Settings** → **Service**
2. Busca **"Clear Build Cache"** o **"Clear Cache"**
3. Haz clic en **"Clear Cache"**
4. Luego ve a **"Deployments"** y haz clic en **"Redeploy"**

## 🆘 Si Nada Funciona

### Opción de Último Recurso:

1. Desconecta el repositorio de GitHub en Railway
2. Elimina el servicio (si es necesario)
3. Crea un nuevo servicio
4. Conecta el repositorio de GitHub nuevamente
5. Configura las variables de entorno
6. Habilita Auto-Deploy

## 📝 Checklist de Verificación

- [ ] Repositorio conectado en Railway Dashboard
- [ ] Auto-Deploy habilitado para rama `main`
- [ ] Webhook de GitHub configurado correctamente
- [ ] Variables de entorno configuradas
- [ ] Build cache limpiado (si hay problemas)
- [ ] Último commit pusheado a `main`

## 🔗 Enlaces Útiles

- [Railway Dashboard](https://railway.app/dashboard)
- [Railway Docs - GitHub Integration](https://docs.railway.app/guides/github)
- [Railway Docs - Deployments](https://docs.railway.app/deploy/deployments)








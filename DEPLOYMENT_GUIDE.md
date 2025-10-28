# 🚀 KPIs Grupo Orsega - Guía de Deployment

## 📊 Estado Actual de la Aplicación

✅ **Base de datos**: Configurada con Neon PostgreSQL, esquema completo aplicado  
✅ **Compilación**: La aplicación compila correctamente sin errores críticos  
✅ **Configuración**: Dockerfile, Railway.json y Procfile configurados  
✅ **Migraciones**: Base de datos lista con todas las tablas necesarias  

## 🔧 Preparación para Deployment

### 1. Variables de Entorno Requeridas

Crea un archivo `.env` basado en `.env.example` con las siguientes variables:

```bash
# Base de datos (REQUERIDO)
DATABASE_URL=postgresql://username:password@host:port/database

# Seguridad (REQUERIDO)
JWT_SECRET=tu-clave-secreta-super-segura-aqui
SESSION_SECRET=tu-clave-de-sesion-secreta

# Email (REQUERIDO para notificaciones)
SENDGRID_API_KEY=tu-clave-de-sendgrid
FROM_EMAIL=noreply@tudominio.com

# OpenAI (OPCIONAL - para análisis de documentos)
OPENAI_API_KEY=tu-clave-de-openai

# Configuración de la aplicación
NODE_ENV=production
PORT=3000
```

### 2. Base de Datos

La aplicación está configurada para usar **Neon PostgreSQL**. Asegúrate de:

- Tener una instancia de PostgreSQL funcionando
- Configurar la variable `DATABASE_URL` correctamente
- Las migraciones se aplicarán automáticamente al iniciar

## 🚀 Opciones de Deployment

### Opción 1: Railway (Recomendado)

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login y configurar
railway login
railway link

# Configurar variables de entorno
railway variables set DATABASE_URL="tu-database-url"
railway variables set JWT_SECRET="tu-jwt-secret"
railway variables set SENDGRID_API_KEY="tu-sendgrid-key"
railway variables set FROM_EMAIL="noreply@tudominio.com"

# Deployar
railway up
```

### Opción 2: Heroku

```bash
# Crear aplicación
heroku create tu-app-name

# Agregar base de datos PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Configurar variables de entorno
heroku config:set JWT_SECRET="tu-jwt-secret"
heroku config:set SENDGRID_API_KEY="tu-sendgrid-key"
heroku config:set FROM_EMAIL="noreply@tudominio.com"

# Deployar
git push heroku main
```

### Opción 3: Docker

```bash
# Construir imagen
docker build -t kpis-grupo-orsega .

# Ejecutar contenedor
docker run -p 3000:3000 \
  -e DATABASE_URL="tu-database-url" \
  -e JWT_SECRET="tu-jwt-secret" \
  -e SENDGRID_API_KEY="tu-sendgrid-key" \
  kpis-grupo-orsega
```

## 📋 Checklist de Deployment

- [ ] Variables de entorno configuradas
- [ ] Base de datos PostgreSQL disponible
- [ ] Claves de API configuradas (SendGrid, OpenAI)
- [ ] Dominio configurado (opcional)
- [ ] SSL/HTTPS habilitado
- [ ] Backup de base de datos configurado

## 🔍 Verificación Post-Deployment

1. **Health Check**: Visita `/api/health` para verificar que la API responde
2. **Base de datos**: Verifica que las tablas se crearon correctamente
3. **Login**: Prueba el login de administrador
4. **Funcionalidades**: Verifica KPIs, envíos, tesorería

## 🛠️ Comandos Útiles

```bash
# Compilar localmente
npm run build

# Ejecutar en modo producción
npm start

# Verificar tipos TypeScript
npm run check

# Ejecutar script de deployment
./deploy.sh
```

## 📞 Soporte

Si encuentras problemas durante el deployment:

1. Verifica los logs de la aplicación
2. Confirma que todas las variables de entorno están configuradas
3. Verifica la conectividad a la base de datos
4. Revisa los logs de la plataforma de deployment

## 🎯 Próximos Pasos

Una vez deployada la aplicación:

1. **Configurar usuarios**: Crear usuarios administradores
2. **Importar datos**: Migrar datos existentes si es necesario
3. **Configurar notificaciones**: Probar el sistema de emails
4. **Monitoreo**: Configurar alertas y monitoreo
5. **Backup**: Configurar respaldos automáticos

---

**¡La aplicación está lista para producción! 🎉**

# 🚀 Instrucciones para Ejecutar en Localhost

## 📋 Requisitos Previos

1. **Node.js**: Versión 18 o superior
   - Verificar: `node --version`
   - Descargar: [nodejs.org](https://nodejs.org/)

2. **npm**: Viene con Node.js
   - Verificar: `npm --version`

3. **Base de datos PostgreSQL**: 
   - Necesitas tener acceso a una base de datos PostgreSQL
   - Puede ser local o remota (Neon, Railway, etc.)

## 🔧 Configuración Inicial

### 1. Instalar Dependencias

```bash
# Desde la raíz del proyecto
npm install
```

### 2. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Base de datos
DATABASE_URL=postgresql://usuario:password@localhost:5432/nombre_db

# JWT Secret (genera uno aleatorio)
JWT_SECRET=tu_secret_jwt_aqui

# Puerto del servidor (opcional, por defecto 8080)
PORT=8080

# Otros servicios (si los usas)
SENDGRID_API_KEY=tu_api_key_si_usas_sendgrid
OPENAI_API_KEY=tu_api_key_si_usas_openai
```

**Nota**: Si usas una base de datos remota (Neon, Railway), usa la URL de conexión que te proporcionan.

### 3. Ejecutar Migraciones (si es necesario)

```bash
# Si usas Drizzle ORM
npm run db:push
```

## 🎯 Ejecutar el Proyecto

### Modo Desarrollo (Recomendado)

```bash
npm run dev
```

Este comando:
- Inicia el servidor Express en modo desarrollo
- Inicia Vite para el frontend con hot-reload
- El servidor estará disponible en: `http://localhost:8080`
- El frontend se recargará automáticamente cuando hagas cambios

### Verificar que Funciona

1. Abre tu navegador en: `http://localhost:8080`
2. Deberías ver la página de login o dashboard
3. Revisa la consola del terminal para ver si hay errores

## 🐛 Solución de Problemas Comunes

### Error: "Cannot find module"
```bash
# Elimina node_modules y reinstala
rm -rf node_modules package-lock.json
npm install
```

### Error de conexión a la base de datos
- Verifica que `DATABASE_URL` en `.env` sea correcta
- Asegúrate de que PostgreSQL esté corriendo (si es local)
- Verifica que la base de datos exista

### Puerto ya en uso
```bash
# Cambia el puerto en .env
PORT=3000
```

O mata el proceso que está usando el puerto:
```bash
# macOS/Linux
lsof -ti:8080 | xargs kill -9

# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

### Error de TypeScript
```bash
# Verifica tipos
npm run check
```

## 📝 Comandos Útiles

```bash
# Desarrollo
npm run dev              # Inicia servidor en modo desarrollo

# Build
npm run build            # Construye para producción
npm run build:clean         # Limpia y construye

# Base de datos
npm run db:push          # Aplica cambios de esquema

# Verificación
npm run check            # Verifica tipos TypeScript
npm run audit            # Auditoría del proyecto
```

## 🌐 URLs Importantes

- **Frontend/Backend**: `http://localhost:8080`
- **API**: `http://localhost:8080/api/*`
- **Health Check**: `http://localhost:8080/health`

## 💡 Tips

1. **Hot Reload**: Los cambios en el frontend se reflejan automáticamente
2. **Logs**: Revisa la consola del terminal para ver logs del servidor
3. **DevTools**: Usa las herramientas de desarrollo del navegador (F12)
4. **Variables de Entorno**: Nunca subas el archivo `.env` a Git

## 🔒 Seguridad

- No compartas tu archivo `.env`
- No subas credenciales a Git
- Usa variables de entorno diferentes para desarrollo y producción

## 📞 ¿Necesitas Ayuda?

1. Revisa los logs en la consola del terminal
2. Revisa la consola del navegador (F12)
3. Verifica que todas las dependencias estén instaladas
4. Verifica que la base de datos esté accesible

---

**Última actualización**: Noviembre 2024


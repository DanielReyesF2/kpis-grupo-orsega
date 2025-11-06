# 🖥️ Guía Rápida para Localhost

## ⚡ Inicio Rápido

### 1. Verificar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables mínimas:

```bash
# Base de datos (REQUERIDO)
DATABASE_URL=tu-url-de-postgresql

# Seguridad (REQUERIDO)
JWT_SECRET=tu-clave-secreta-super-segura-aqui
SESSION_SECRET=tu-clave-de-sesion-secreta

# Email (OPCIONAL para desarrollo local)
SENDGRID_API_KEY=tu-clave-de-sendgrid
FROM_EMAIL=noreply@grupoorsega.com

# OpenAI (OPCIONAL)
OPENAI_API_KEY=tu-clave-de-openai

# Configuración
NODE_ENV=development
PORT=8080
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Ejecutar el Servidor

```bash
npm run dev
```

El servidor se iniciará en: **http://localhost:8080**

### 4. Acceder a la Aplicación

Abre tu navegador en:
- **http://localhost:8080**
- **http://127.0.0.1:8080**

## 🔍 Verificación

Una vez que el servidor esté corriendo, deberías ver en la terminal:

```
✅ Server listening on port 8080
   - http://localhost:8080
   - http://127.0.0.1:8080
   - http://0.0.0.0:8080
📊 NODE_ENV: development
🗄️ DATABASE_URL exists: true
🔑 JWT_SECRET exists: true
🏥 Healthcheck available at: http://localhost:8080/health
✅ Server ready! Open http://localhost:8080 in your browser
```

## 🚨 Solución de Problemas

### Si el puerto 8080 está ocupado:

```bash
# Cambia el puerto en el archivo .env
PORT=3000
```

### Si no tienes DATABASE_URL:

El proyecto necesita una conexión a PostgreSQL. Puedes usar:
- Una base de datos local de PostgreSQL
- Una instancia de Neon PostgreSQL (cloud)
- Una base de datos en Railway

### Si no ves datos en el dashboard:

1. **Verifica que estés autenticado**: Necesitas hacer login primero
2. **Revisa la consola del navegador** (F12) para ver errores
3. **Revisa la terminal del servidor** para ver errores de conexión

## 📝 Notas Importantes

- El servidor incluye **Hot Module Replacement (HMR)** para desarrollo
- Los cambios en el código se reflejarán automáticamente
- El frontend se sirve a través del mismo servidor Express
- En producción, se usa `npm run build` y luego `npm start`

## 🛑 Detener el Servidor

Presiona `Ctrl + C` en la terminal donde está corriendo el servidor.



# 🔧 Solución: Problema de Conexión a Localhost

## Problema Identificado

El servidor estaba configurado para usar el puerto **8080** por defecto, pero estabas intentando acceder al puerto **5000**.

## Solución Aplicada

Se agregó `PORT=5000` al archivo `.env` para que el servidor use el puerto 5000.

## Cómo Iniciar el Servidor

1. **Iniciar el servidor:**
   ```bash
   npm run dev
   ```

2. **Acceder a la aplicación:**
   - Abrir: `http://localhost:5000`
   - El servidor ahora estará escuchando en el puerto 5000

## Verificación

Después de iniciar el servidor, deberías ver en la consola:
```
✅ Server listening on port 5000
🌐 Accessible on:
   - http://localhost:5000
   - http://127.0.0.1:5000
✅ Server ready! Open http://localhost:5000 in your browser
```

## Si el Puerto 5000 Está Ocupado

Si el puerto 5000 ya está en uso, puedes:

1. **Liberar el puerto:**
   ```bash
   lsof -ti:5000 | xargs kill -9
   ```

2. **O usar otro puerto:**
   - Editar `.env` y cambiar `PORT=5000` a otro puerto (ej: `PORT=3000`)
   - Acceder a `http://localhost:3000`

## Notas

- El servidor aplicará automáticamente las migraciones de la base de datos al iniciar
- Verás el mensaje: `✅ Treasury schema migrations applied`
- El servidor está listo para usar la nueva funcionalidad de fecha de pago en facturas



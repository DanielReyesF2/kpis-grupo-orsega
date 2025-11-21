# 🚀 Instrucciones para Iniciar el Servidor

## Puerto Configurado
El servidor está configurado para usar el puerto **8080** por defecto.

## Cómo Iniciar

1. **Iniciar el servidor:**
   ```bash
   npm run dev
   ```

2. **Acceder a la aplicación:**
   ```
   http://localhost:8080
   ```

## Verificación

Después de iniciar, deberías ver en la consola:
```
✅ Server listening on port 8080
🌐 Accessible on:
   - http://localhost:8080
   - http://127.0.0.1:8080
✅ Server ready! Open http://localhost:8080 in your browser
✅ Treasury schema migrations applied
```

## Funcionalidades Implementadas

- ✅ Campo `payment_date` agregado a la base de datos
- ✅ Modal de verificación de facturas con fecha de pago obligatoria
- ✅ Endpoint `/api/scheduled-payments/confirm` para confirmar cuentas por pagar
- ✅ Migraciones automáticas al iniciar el servidor

## Notas

- El servidor aplica automáticamente las migraciones de la base de datos
- Si el puerto 8080 está ocupado, el servidor mostrará un error
- Para liberar el puerto: `lsof -ti:8080 | xargs kill -9`



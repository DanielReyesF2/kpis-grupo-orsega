# 🔍 Pasos de Debugging para el Error 400

## Problema
El upload de facturas sigue fallando con error 400 después de 3 intentos de solución.

## Pasos para Diagnosticar

### 1. Verificar que el servidor está recibiendo la petición

**En la consola del servidor, busca estos logs:**
```
📤 [Upload] ========== INICIO DE UPLOAD ==========
📤 [Upload] Petición recibida en /api/payment-vouchers/upload
```

**Si NO ves estos logs:**
- El servidor no está recibiendo la petición
- Posibles causas:
  - El servidor no está corriendo
  - Problema de CORS
  - El endpoint no está registrado
  - Problema de red

### 2. Verificar el Content-Type

**Busca en los logs:**
```
📤 [Upload] Content-Type: multipart/form-data; boundary=...
```

**Si el Content-Type NO es `multipart/form-data`:**
- El frontend no está enviando FormData correctamente
- Revisa el código del frontend en `TreasuryPage.tsx:40-58`

### 3. Verificar que multer está procesando el archivo

**Busca en los logs:**
```
✅ [Multer] Archivo procesado exitosamente
📤 [Upload] req.file: { originalname: ..., mimetype: ..., size: ... }
```

**Si NO ves estos logs:**
- Multer está rechazando el archivo
- Busca errores como:
  ```
  ❌ [Multer] Error: Solo se permiten archivos PDF, XML, PNG, JPG, JPEG
  ```

### 4. Verificar que req.body tiene los campos

**Busca en los logs:**
```
📤 [Upload] req.body DESPUÉS de multer: { payerCompanyId: '2', ... }
📤 [Upload] req.body keys DESPUÉS de multer: [ 'payerCompanyId' ]
```

**Si req.body está vacío:**
- Multer no está parseando los campos de FormData
- Posible causa: `express.json()` o `express.urlencoded()` están interfiriendo

### 5. Verificar el análisis del documento

**Busca en los logs:**
```
✅ [Upload] Análisis completado: { documentType: 'invoice', ... }
```

**Si el análisis falla:**
- El documento no se puede leer
- OpenAI no puede analizar el documento
- Revisa los logs de OpenAI

### 6. Verificar la validación de datos

**Busca en los logs:**
```
✅ [Upload] Datos parseados: { payerCompanyId: 2, ... }
```

**Si payerCompanyId es undefined:**
- El campo no está llegando en req.body
- Revisa el código del frontend que envía el FormData

### 7. Verificar errores en el catch block

**Busca en los logs:**
```
❌ [Upload] Error completo: ...
❌ [Upload] Stack trace: ...
```

**Esto te dirá exactamente dónde está fallando**

---

## Comandos Útiles

### Ver logs del servidor en tiempo real:
```bash
tail -f logs/info.log | grep -i "upload\|multer\|error"
```

### Ver todos los logs recientes:
```bash
tail -200 logs/info.log
```

### Verificar que el servidor está corriendo:
```bash
curl http://localhost:8080/api/health
```

---

## Soluciones Rápidas a Probar

### 1. Reiniciar el servidor
```bash
# Detener el servidor y volver a iniciarlo
npm run dev
```

### 2. Limpiar la caché del navegador
- Abre las herramientas de desarrollador
- Click derecho en el botón de recargar
- Selecciona "Vaciar caché y recargar de forma forzada"

### 3. Verificar que el archivo no está corrupto
- Intenta subir un archivo PDF diferente
- Verifica que el archivo no esté vacío
- Verifica que el archivo no exceda 10MB

### 4. Verificar el token de autenticación
- Abre la consola del navegador
- Ejecuta: `localStorage.getItem("authToken")`
- Verifica que el token existe y no está expirado

---

## Información a Recopilar

Si el problema persiste, recopila esta información:

1. **Logs del servidor** (últimas 50 líneas relacionadas con upload)
2. **Logs del navegador** (consola del navegador, especialmente los que empiezan con 📤, 📥, ❌, ✅)
3. **Tipo de archivo** que estás intentando subir (PDF, XML, etc.)
4. **Tamaño del archivo**
5. **Mensaje de error exacto** que aparece en la UI
6. **Screenshot** de la consola del navegador con el error

---

## Próximos Pasos

Una vez que tengas los logs, compártelos para poder identificar exactamente dónde está fallando el proceso.




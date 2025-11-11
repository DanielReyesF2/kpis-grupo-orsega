# Pasos para Revocar y Rotar OpenAI API Key

## ⚠️ ACCIÓN INMEDIATA REQUERIDA

### Paso 1: Revocar la clave en OpenAI (URGENTE)

1. Ve a https://platform.openai.com/api-keys
2. Inicia sesión con tu cuenta de OpenAI
3. Busca la clave que comienza con `sk-proj-...` (revisa tus claves activas en OpenAI)
4. Haz clic en "Revoke" o "Delete" para revocar la clave
5. **IMPORTANTE**: Anota el nombre/descripción de la clave antes de revocarla (si la tienes) para identificar dónde se usa

### Paso 2: Generar nueva clave en OpenAI

1. En la misma página de API Keys, haz clic en "Create new secret key"
2. Dale un nombre descriptivo (ej: "KPIs Grupo Orsega - Production")
3. Copia la nueva clave inmediatamente (solo se muestra una vez)
4. **NO la compartas ni la subas a Git**

### Paso 3: Actualizar la clave en Railway (Producción)

1. Ve a tu proyecto en Railway: https://railway.app
2. Ve a la sección de Variables de Entorno
3. Busca `OPENAI_API_KEY`
4. Reemplaza el valor con la nueva clave
5. Guarda los cambios
6. Railway reiniciará automáticamente la aplicación

### Paso 4: Actualizar la clave localmente (si es necesario)

1. Abre el archivo `.env` en tu máquina local
2. Actualiza `OPENAI_API_KEY` con la nueva clave
3. **NO hagas commit de este archivo** (ya está en .gitignore)

### Paso 5: Cerrar la alerta en GitHub

1. Ve a la alerta de seguridad en GitHub:
   - https://github.com/DanielReyesF2/kpis-grupo-orsega/security/secret-scanning
2. Haz clic en la alerta de "OpenAI API Key"
3. Selecciona "Mark as revoked" o "Close as revoked"
4. GitHub marcará la alerta como resuelta

## ✅ Verificación

Después de completar estos pasos:

1. ✅ La clave antigua está revocada en OpenAI
2. ✅ La nueva clave está configurada en Railway
3. ✅ La nueva clave está en tu `.env` local
4. ✅ La alerta está cerrada en GitHub
5. ✅ El archivo `.env` está en `.gitignore` (ya verificado)

## 📝 Notas Importantes

- **La clave antigua seguirá existiendo en el historial de Git**, pero será inútil porque está revocada
- Si necesitas limpiar el historial completamente (Opción B), será más complejo y puede afectar a otros colaboradores
- Para proyectos futuros, considera usar GitHub Secrets o un servicio de gestión de secretos como AWS Secrets Manager, HashiCorp Vault, etc.

## 🔒 Prevención Futura

1. **NUNCA** subas archivos `.env` a Git
2. **SIEMPRE** verifica que `.env` esté en `.gitignore` antes de hacer commit
3. Usa `.env.example` como plantilla sin valores reales
4. Considera usar variables de entorno del sistema o servicios de gestión de secretos para producción



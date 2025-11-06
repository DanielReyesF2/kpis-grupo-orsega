# 🚨 ROTACIÓN DE CREDENCIALES - ACCIÓN REQUERIDA

## ⚠️ SITUACIÓN CRÍTICA

El archivo `.env.backup2` que contenía credenciales sensibles fue encontrado siendo trackeado en el repositorio Git. **Aunque ha sido removido**, las credenciales estuvieron expuestas en el historial de Git y deben ser rotadas inmediatamente.

## 📋 Credenciales Comprometidas

Las siguientes credenciales estaban en `.env.backup2` y **DEBEN SER ROTADAS**:

### 1. Base de Datos Neon
```
DATABASE_URL=postgresql://neondb_owner:npg_xG8D7eLNolUT@ep-lively-leaf-ae3nrrao-pooler...
```
- ✅ Credencial actual: `npg_xG8D7eLNolUT`
- ❌ **ACCIÓN REQUERIDA:** Cambiar contraseña en Neon Console

### 2. Resend API Key
```
RESEND_API_KEY=re_3sVCjjkK_K4oPVDP6qPZZCJMegHFTKypy
```
- ✅ Key actual: `re_3sVCjjkK_K4oPVDP6qPZZCJMegHFTKypy`
- ❌ **ACCIÓN REQUERIDA:** Regenerar en Resend Dashboard

### 3. OpenAI API Key
```
OPENAI_API_KEY=sk-proj-LfnS0EW8ffPrwIQsvHao7YlyHcy_dvEeL0wtW5J...
```
- ✅ Key actual: `sk-proj-LfnS0EW8...`
- ❌ **ACCIÓN REQUERIDA:** Regenerar en OpenAI Dashboard

### 4. JWT Secret
```
JWT_SECRET=daniel-super-secret-jwt-key-2024-econova
```
- ✅ Secret actual: `daniel-super-secret-jwt-key-2024-econova`
- ❌ **ACCIÓN REQUERIDA:** Generar nuevo secret aleatorio

## 🔧 GUÍA DE ROTACIÓN PASO A PASO

### Paso 1: Generar Nuevo JWT Secret

```bash
# En tu terminal, genera un secret fuerte
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Paso 2: Actualizar Base de Datos Neon

1. Ir a [Neon Console](https://console.neon.tech/)
2. Seleccionar el proyecto `kpis-grupo-orsega`
3. Ir a Settings → Database
4. Resetear la contraseña del usuario `neondb_owner`
5. Copiar el nuevo `DATABASE_URL`

### Paso 3: Regenerar Resend API Key

1. Ir a [Resend Dashboard](https://resend.com/api-keys)
2. Revocar la key `re_3sVCjjkK_K4oPVDP6qPZZCJMegHFTKypy`
3. Crear una nueva API key
4. Copiar la nueva key

### Paso 4: Regenerar OpenAI API Key

1. Ir a [OpenAI Platform](https://platform.openai.com/api-keys)
2. Revocar la key `sk-proj-LfnS0EW8ffPrwIQsvHao7YlyHcy_dvEeL0wtW5J...`
3. Crear una nueva API key
4. Copiar la nueva key

### Paso 5: Actualizar Variables de Entorno en Railway

```bash
# Conectar a Railway CLI
railway login

# Seleccionar el proyecto
railway link

# Actualizar variables una por una
railway variables set DATABASE_URL="postgresql://..."
railway variables set JWT_SECRET="<nuevo-secret-generado>"
railway variables set RESEND_API_KEY="<nueva-key>"
railway variables set OPENAI_API_KEY="<nueva-key>"

# Verificar que se actualizaron correctamente
railway variables

# Re-deploy la aplicación con las nuevas credenciales
railway up
```

### Paso 6: Actualizar .env Local (Desarrollo)

```bash
# Crear nuevo archivo .env (NUNCA commitearlo)
cat > .env << 'EOF'
DATABASE_URL=<nuevo-database-url>
JWT_SECRET=<nuevo-jwt-secret>
RESEND_API_KEY=<nueva-resend-key>
OPENAI_API_KEY=<nueva-openai-key>
SENDGRID_API_KEY=<si-aplica>
NODE_ENV=development
PORT=3000
EOF

# Asegurarse de que está en .gitignore
echo ".env" >> .gitignore
```

## ✅ CHECKLIST DE VERIFICACIÓN

- [ ] Nuevo JWT Secret generado
- [ ] Contraseña de Neon Database rotada
- [ ] Resend API Key regenerada (antigua revocada)
- [ ] OpenAI API Key regenerada (antigua revocada)
- [ ] Variables de entorno actualizadas en Railway
- [ ] Archivo `.env` local actualizado (NO COMMITEAR)
- [ ] Aplicación re-deployada y funcionando
- [ ] Login funciona con nuevo JWT Secret
- [ ] Base de datos conecta correctamente
- [ ] Emails se envían correctamente (Resend)
- [ ] Funcionalidad OpenAI funciona (si aplica)

## 🔐 MEDIDAS PREVENTIVAS IMPLEMENTADAS

### 1. `.gitignore` Actualizado
```gitignore
.env
.env.*
.env.local
.env.development.local
.env.test.local
.env.production.local
*.env.backup*
```

### 2. Logs Removidos
- `logs/info.log` removido del tracking

### 3. Archivos SQL con Datos Sensibles
- Movidos a `scripts/migrations/archived/`
- `update_passwords.sql` contiene emails de usuarios (revisar)

## 📝 NOTAS IMPORTANTES

1. **NO COMMITEAR** el archivo `.env` nunca
2. **NO COMPARTIR** credenciales por email, Slack, etc.
3. Usar variables de entorno de Railway para producción
4. Usar `.env.example` como plantilla (sin valores reales)
5. Rotar credenciales cada 90 días como buena práctica

## 🚀 DESPUÉS DE LA ROTACIÓN

Una vez rotadas todas las credenciales:

```bash
# Hacer commit de los cambios de seguridad
git add .gitignore
git commit -m "security: Update .gitignore to prevent credential leaks"
git push
```

## 📞 SOPORTE

Si encuentras problemas durante la rotación:
- Revisar logs de Railway: `railway logs`
- Verificar variables de entorno: `railway variables`
- Contactar a soporte de Neon/Resend/OpenAI si es necesario

## ⏰ TIMELINE RECOMENDADO

| Tiempo | Acción |
|--------|--------|
| **HOY** | Rotar JWT Secret y DATABASE_URL |
| **HOY** | Rotar RESEND_API_KEY y OPENAI_API_KEY |
| **HOY** | Actualizar Railway y verificar deployment |
| **Esta semana** | Monitorear logs para errores de autenticación |
| **Cada 90 días** | Rotar credenciales como mantenimiento preventivo |

---

**Fecha de creación:** 2025-11-06
**Estado:** 🔴 **ACCIÓN REQUERIDA INMEDIATA**
**Prioridad:** 🚨 **CRÍTICA**

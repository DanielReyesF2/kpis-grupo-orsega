# Reporte de Auditoría de Seguridad - ECONOVA KPI Dashboard
**Fecha:** 13 de Octubre, 2025  
**Auditor:** Análisis Automático de Seguridad  
**Sistema:** ECONOVA KPI Dashboard (Dura International & Grupo Orsega)

---

## 📋 Resumen Ejecutivo

Se identificaron **vulnerabilidades críticas** de seguridad que comprometen la integridad de los datos multi-tenant del sistema. Los hallazgos más graves permiten que usuarios de una empresa accedan a datos confidenciales de otras empresas.

### Estado General de Seguridad: 🔴 **CRÍTICO**

**Hallazgos por Severidad:**
- 🔴 **Crítico:** 2 vulnerabilidades
- 🟠 **Alto:** 3 vulnerabilidades  
- 🟡 **Medio:** 2 vulnerabilidades
- 🟢 **Bajo:** 1 vulnerabilidad

---

## 🔴 VULNERABILIDADES CRÍTICAS (Acción Inmediata Requerida)

### 1. **Fuga de Datos Multi-Tenant (Cross-Company Data Leakage)**
**Severidad:** 🔴 CRÍTICO  
**Impacto:** Alto - Exposición total de datos entre empresas  
**Probabilidad:** Alta - Explotable por cualquier usuario autenticado

#### Descripción:
Múltiples endpoints permiten que usuarios autenticados accedan a datos de TODAS las empresas sin validar que pertenezcan a la empresa solicitada. **No existe validación de `user.companyId` contra el `companyId` en los requests.**

#### Endpoints Vulnerables:

1. **`GET /api/kpis`** - KPIs de todas las empresas
   ```typescript
   // ❌ VULNERABLE: Sin validación de empresa del usuario
   if (companyId) {
     kpis = await storage.getKpisByCompany(companyId);
   } else {
     kpis = await storage.getKpis(); // Devuelve TODOS los KPIs
   }
   ```

2. **`GET /api/clients-db`** - Clientes de todas las empresas
   ```typescript
   // ❌ VULNERABLE: Comentario confirma acceso universal
   // ✅ ACCESO UNIVERSAL: Todos los usuarios ven todos los clientes
   WHERE is_active = true  // Sin filtro por empresa
   ```

3. **`GET /api/shipments/products`** - Productos de todas las empresas
   ```typescript
   // ❌ VULNERABLE: Query sin restricción de empresa
   SELECT DISTINCT product FROM shipments 
   WHERE product IS NOT NULL  // Sin WHERE company_id
   ```

4. **`GET /api/areas`** - Áreas de todas las empresas
5. **`GET /api/shipments`** - Envíos de todas las empresas (si no se especifica companyId)
6. **`GET /api/payment-vouchers`** - Comprobantes de todas las empresas

#### Escenario de Explotación:
```bash
# Usuario de Dura International (companyId=1) puede ver datos de Grupo Orsega (companyId=2)
curl -H "Authorization: Bearer <token_dura>" \
  https://api.econova.com/api/kpis?companyId=2

# ✅ Respuesta: KPIs confidenciales de Grupo Orsega expuestos
```

#### **Recomendación (Urgente):**
```typescript
// ✅ SOLUCIÓN: Validar companyId del usuario en TODOS los endpoints
app.get("/api/kpis", jwtAuthMiddleware, async (req, res) => {
  const user = getAuthUser(req as AuthRequest);
  const requestedCompanyId = req.query.companyId ? parseInt(req.query.companyId as string) : null;
  
  // Validar que el usuario solo acceda a datos de su empresa
  // (excepto admins que tienen acceso multi-empresa)
  if (user.role !== 'admin' && user.companyId && requestedCompanyId !== user.companyId) {
    return res.status(403).json({ 
      message: "Forbidden: No puedes acceder a datos de otra empresa" 
    });
  }
  
  // Si es admin o executive, permitir acceso multi-empresa
  const companyId = requestedCompanyId || user.companyId;
  const kpis = companyId 
    ? await storage.getKpisByCompany(companyId)
    : await storage.getKpis();
  
  res.json(kpis);
});
```

**Aplicar este patrón a TODOS los endpoints que manejan datos por empresa.**

---

### 2. **JWT Secret Predecible (Hardcoded Fallback)**
**Severidad:** 🔴 CRÍTICO  
**Impacto:** Muy Alto - Compromiso total de autenticación  
**Probabilidad:** Media - Depende de configuración de entorno

#### Descripción:
El sistema usa un JWT_SECRET hardcodeado como fallback cuando la variable de entorno no está configurada.

#### Código Vulnerable:
```typescript
// server/auth.ts línea 7
const JWT_SECRET = process.env.JWT_SECRET || "econova-kpi-jwt-secret-key";
```

#### Riesgo:
- Si `JWT_SECRET` no está en variables de entorno, usa el valor predecible
- Un atacante puede **forjar tokens JWT válidos** con este secret conocido
- **Compromiso completo de la autenticación** del sistema
- Acceso a cualquier cuenta incluyendo admin

#### Verificación en Producción:
```bash
# ✅ Verificado: JWT_SECRET está configurado en producción (3378 chars)
# ⚠️ Pero el fallback sigue siendo un riesgo en caso de error de despliegue
```

#### **Recomendación (Urgente):**
```typescript
// ✅ SOLUCIÓN: Hacer JWT_SECRET obligatorio
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "FATAL: JWT_SECRET must be set in environment variables. " +
    "This is a critical security requirement. Application cannot start."
  );
}

// Si se detecta uso del secret por defecto en producción, regenerar TODOS los tokens:
// 1. Rotar JWT_SECRET inmediatamente
// 2. Invalidar todas las sesiones activas
// 3. Forzar re-login de todos los usuarios
```

---

## 🟠 VULNERABILIDADES DE ALTO RIESGO

### 3. **Endpoints de Diagnóstico Sin Autenticación**
**Severidad:** 🟠 ALTO  
**Impacto:** Medio - Exposición de información del sistema  
**Probabilidad:** Alta - Acceso público

#### Endpoints Expuestos:
1. **`GET /health`** - Estado del servidor, memoria, uptime
2. **`GET /env-check`** - Variables de entorno (nombres y longitudes)
3. **`GET /api/healthz`** - Estado de API
4. **`GET /api/spa-check`** - Rutas del sistema de archivos

#### Información Expuesta:
```json
{
  "environment": {
    "NODE_ENV": "production",
    "is_production": true
  },
  "env_variables": {
    "DATABASE_URL": { "exists": true, "length": 114 },
    "JWT_SECRET": { "exists": true, "length": 3378 },
    "SENDGRID_API_KEY": { "exists": true, "length": 69 }
  },
  "paths": {
    "cwd": "/home/runner/workspace",
    "dist_public_index": "/home/runner/workspace/server/public/index.html"
  }
}
```

#### Riesgo:
- Enumera secrets configurados (nombres y longitudes)
- Expone estructura del sistema de archivos
- Facilita ataques de reconocimiento
- Información útil para atacantes

#### **Recomendación:**
```typescript
// Opción 1: Proteger con autenticación
app.get('/health', jwtAuthMiddleware, jwtAdminMiddleware, (req, res) => { ... });

// Opción 2: Versión pública limitada
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
    // Sin información sensible
  });
});

// Opción 3: Eliminar endpoints en producción
if (process.env.NODE_ENV !== 'production') {
  app.get('/env-check', ...);
}
```

---

### 4. **Registro Público Sin Validación de Empresa**
**Severidad:** 🟠 ALTO  
**Impacto:** Medio - Creación no autorizada de cuentas  
**Probabilidad:** Media

#### Descripción:
El endpoint `POST /api/register` permite registro público sin verificar que el usuario pertenezca realmente a la empresa que selecciona.

#### Código Actual:
```typescript
app.post("/api/register", async (req, res) => {
  // Sin verificación de dominio de email
  // Sin validación de pertenencia a empresa
  const companyId = userData.companyId != null ? Number(userData.companyId) : undefined;
  
  // Cualquiera puede registrarse con cualquier companyId
  await storage.createUser({...userData, companyId, ...});
});
```

#### Riesgo:
- Usuario malintencionado se registra con `companyId=1` (Dura)
- Accede a datos confidenciales de esa empresa
- Sin verificación de dominio de email corporativo

#### **Recomendación:**
```typescript
// ✅ SOLUCIÓN: Validar dominio de email
const allowedDomains = {
  1: ['@dura.com', '@duraint.com'],  // Dura International
  2: ['@orsega.com', '@grupoorsega.com']  // Grupo Orsega
};

const emailDomain = email.substring(email.lastIndexOf('@'));
if (!allowedDomains[companyId]?.includes(emailDomain)) {
  return res.status(403).json({ 
    message: "Email no autorizado para esta empresa" 
  });
}

// O deshabilitar registro público y usar solo invitaciones
```

---

### 5. **Falta de Rate Limiting en Endpoints Críticos**
**Severidad:** 🟠 ALTO  
**Impacto:** Medio - Ataques de fuerza bruta  
**Probabilidad:** Alta

#### Endpoints Sin Rate Limiting:
- `POST /api/login` - Permite fuerza bruta de contraseñas
- `POST /api/register` - Permite spam de registros
- `POST /api/payment-vouchers/upload` - Permite abusar de OpenAI API

#### **Recomendación:**
```typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por IP
  message: 'Demasiados intentos de login, intenta en 15 minutos'
});

app.post("/api/login", loginLimiter, async (req, res) => { ... });
```

---

## 🟡 VULNERABILIDADES DE RIESGO MEDIO

### 6. **Contraseñas Sin Hash en Comparación Fallback**
**Severidad:** 🟡 MEDIO  
**Impacto:** Alto (si se usa)  
**Probabilidad:** Baja (solo en migración)

#### Código:
```typescript
// server/auth.ts línea 98-99
// Para contraseñas sin hashear (fallback)
return supplied === stored;
```

#### Riesgo:
- Permite contraseñas en texto plano en la BD
- Solo para compatibilidad con datos antiguos
- Debe eliminarse después de migración completa

#### **Recomendación:**
```typescript
// ✅ Eliminar fallback después de migrar todas las contraseñas
async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  // Solo bcrypt, sin fallback
  if (!stored.startsWith('$2b$')) {
    console.error('[SECURITY] Password not hashed - migration incomplete');
    return false;
  }
  return await bcrypt.compare(supplied, stored);
}
```

---

### 7. **Archivos Subidos Sin Validación de Contenido**
**Severidad:** 🟡 MEDIO  
**Impacto:** Medio - Carga de archivos maliciosos  
**Probabilidad:** Baja

#### Descripción:
Multer valida `mimetype` pero no el contenido real del archivo. Un atacante puede renombrar un archivo malicioso.

#### Código Actual:
```typescript
fileFilter: (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);  // Solo valida mimetype, no contenido
  }
}
```

#### **Recomendación:**
```typescript
import fileType from 'file-type';

// Validar contenido real del archivo
const buffer = await fs.readFile(file.path);
const type = await fileType.fromBuffer(buffer);

if (!type || !['pdf', 'png', 'jpg', 'jpeg'].includes(type.ext)) {
  throw new Error('Tipo de archivo no válido');
}
```

---

## 🟢 HALLAZGOS DE BAJO RIESGO

### 8. **Logging Excesivo de Información Sensible**
**Severidad:** 🟢 BAJO  
**Impacto:** Bajo - Exposición en logs  
**Probabilidad:** Baja

#### Descripción:
Los logs contienen información del usuario (IDs, roles) que podría filtrarse.

```typescript
console.log(`[JWT Auth] Authenticated user: ID=${payload.id}, Role=${payload.role}`);
```

#### **Recomendación:**
- Usar niveles de log (debug, info, error)
- Redactar información sensible en producción
- No loggear payloads completos de requests

---

## ✅ ASPECTOS POSITIVOS DE SEGURIDAD

### Implementaciones Correctas:

1. **✅ SQL Injection Protegido:**
   - Todas las queries usan parámetros (tagged templates)
   - No hay concatenación de strings en SQL

2. **✅ Secrets Management:**
   - API keys en variables de entorno
   - No hay secrets hardcodeados (excepto JWT fallback)
   - `OPENAI_API_KEY`, `BANXICO_TOKEN`, `SENDGRID_API_KEY` correctos

3. **✅ Password Hashing:**
   - Bcrypt implementado correctamente
   - Salt automático
   - Comparación segura

4. **✅ Redacción de Datos Sensibles:**
   - Helper `redactSensitiveData()` funcional
   - Passwords no se exponen en logs

5. **✅ Base de Datos:**
   - Una sola `DATABASE_URL` (correcto para Replit)
   - Conexión segura a PostgreSQL (Neon)
   - No hay mezcla dev/prod

6. **✅ Validación de Archivos:**
   - Límite de 10MB
   - Validación de tipos MIME
   - Directorio de uploads segregado

---

## 📊 PRIORIZACIÓN DE CORRECCIONES

### 🔥 Inmediato (Esta Semana):
1. ✅ **Implementar validación de `companyId` en TODOS los endpoints multi-tenant**
2. ✅ **Hacer `JWT_SECRET` obligatorio (eliminar fallback)**
3. ✅ **Proteger o eliminar endpoints de diagnóstico**

### 📅 Corto Plazo (2-4 Semanas):
4. ✅ **Implementar rate limiting en login y registro**
5. ✅ **Validar dominio de email en registro público**
6. ✅ **Eliminar fallback de contraseñas sin hash**

### 📌 Mediano Plazo (1-2 Meses):
7. ✅ **Validar contenido real de archivos subidos**
8. ✅ **Mejorar logging (niveles, redacción en prod)**
9. ✅ **Implementar auditoría de accesos a datos sensibles**

---

## 🔧 PLAN DE ACCIÓN RECOMENDADO

### Fase 1: Mitigación de Riesgos Críticos (Semana 1)
```bash
# Día 1-2: Segregación de datos multi-tenant
- Implementar middleware de validación de companyId
- Aplicar a todos los endpoints vulnerables
- Testing exhaustivo de control de acceso

# Día 3: JWT Secret
- Verificar JWT_SECRET en todos los ambientes
- Eliminar fallback hardcoded
- Regenerar tokens si es necesario

# Día 4-5: Endpoints de diagnóstico
- Proteger con autenticación admin
- Crear versión pública mínima
- Documentar cambios
```

### Fase 2: Fortalecimiento (Semana 2-4)
```bash
# Semana 2: Rate Limiting
- Instalar express-rate-limit
- Configurar límites por endpoint
- Monitorear intentos bloqueados

# Semana 3: Validación de Registro
- Implementar whitelist de dominios
- O deshabilitar registro público
- Sistema de invitaciones

# Semana 4: Testing y Auditoría
- Pentesting manual
- Revisión de logs de seguridad
- Documentación de cambios
```

---

## 📝 CONCLUSIONES

El sistema tiene **vulnerabilidades críticas de seguridad** que deben corregirse inmediatamente:

1. **Fuga de datos multi-tenant** - La más grave, permite acceso cruzado entre empresas
2. **JWT Secret predecible** - Compromete toda la autenticación
3. **Endpoints sin protección** - Exponen información del sistema

**Aspectos positivos:**
- No hay SQL injection
- Secrets bien manejados (excepto JWT)
- Password hashing implementado correctamente

**Recomendación General:**  
Implementar las correcciones de **Fase 1** INMEDIATAMENTE antes de continuar con nuevas funcionalidades. El sistema NO debe considerarse seguro para producción hasta corregir las vulnerabilidades críticas.

---

**Nota:** Este reporte debe tratarse como **CONFIDENCIAL** y compartirse solo con el equipo de desarrollo autorizado.

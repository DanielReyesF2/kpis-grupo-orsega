# Análisis de Seguridad Revisado - ECONOVA KPI Dashboard
**Fecha:** 13 de Octubre, 2025  
**Revisión:** Basada en arquitectura confirmada (acceso cross-company intencional)

---

## 📋 Arquitectura Confirmada

### **Reglas de Negocio:**
- ✅ **Colaboradores**: Pueden VER datos de AMBAS empresas (lectura universal)
- ✅ **Managers**: Acceso cross-company completo
- ✅ **Admins**: Acceso cross-company completo

### **Modelo de Datos:**
- Usuarios tienen `area_id` (determina empresa indirectamente)
- NO tienen `company_id` directo (todos = NULL)
- Frontend permite seleccionar empresa dinámicamente
- Acceso universal de LECTURA es **intencional**

---

## 🔴 VULNERABILIDADES REALES IDENTIFICADAS

### 1. **JWT Secret con Fallback Hardcoded** ⚠️ CRÍTICO
**Severidad:** 🔴 CRÍTICO  
**Archivo:** `server/auth.ts` línea 7

```typescript
const JWT_SECRET = process.env.JWT_SECRET || "econova-kpi-jwt-secret-key";
```

**Riesgo:**
- Si `JWT_SECRET` no está configurado, usa valor predecible
- Permite forjar tokens JWT válidos
- Compromiso total de autenticación

**Estado Actual:** 
- ✅ `JWT_SECRET` configurado en producción (3378 chars)
- ⚠️ Fallback sigue siendo un riesgo latente

**Solución:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET must be set. Application cannot start.");
}
```

---

### 2. **Endpoints de Diagnóstico Sin Autenticación** ⚠️ ALTO
**Severidad:** 🟠 ALTO

**Endpoints Expuestos:**
- `GET /health` - Estado del servidor, memoria, configuración
- `GET /env-check` - Variables de entorno (nombres y longitudes)
- `GET /api/healthz` - Estado de API
- `GET /api/spa-check` - Rutas del sistema

**Información Expuesta:**
```json
{
  "env_variables": {
    "DATABASE_URL": {"exists": true, "length": 114},
    "JWT_SECRET": {"exists": true, "length": 3378},
    "SENDGRID_API_KEY": {"exists": true, "length": 69}
  },
  "paths": {
    "cwd": "/home/runner/workspace",
    "dist_public_index": "/home/runner/..."
  }
}
```

**Riesgo:**
- Enumera secrets configurados
- Expone estructura de archivos
- Facilita reconocimiento para ataques

**Solución:**
```typescript
// Opción 1: Proteger con admin auth
app.get('/health', jwtAuthMiddleware, jwtAdminMiddleware, (req, res) => { ... });

// Opción 2: Versión pública mínima
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Opción 3: Solo en desarrollo
if (process.env.NODE_ENV !== 'production') {
  app.get('/env-check', ...);
}
```

---

### 3. **Falta de Validación de Escritura por Empresa** ⚠️ MEDIO
**Severidad:** 🟡 MEDIO

**Endpoints Afectados:**

#### a) **POST /api/shipments** (línea 1476)
```typescript
app.post("/api/shipments", jwtAuthMiddleware, async (req, res) => {
  const validatedData = insertShipmentSchema.parse(transformedData);
  const shipment = await storage.createShipment(validatedData);
  // ❌ No valida si user.areaId corresponde a companyId del shipment
});
```

**Pregunta:** ¿Puede un colaborador de Dura (area_id=1) crear shipments para Orsega (company_id=2)?

#### b) **POST /api/clients** (línea 2314)
```typescript
app.post("/api/clients", jwtAuthMiddleware, async (req, res) => {
  const validatedData = insertClientSchema.parse(req.body);
  // Crea cliente con companyId del request body
  // ❌ No valida si usuario tiene permiso para esa empresa
});
```

**Pregunta:** ¿Puede un colaborador de Orsega (area_id=5) crear clientes para Dura (company_id=1)?

#### c) **POST /api/kpi-values** (línea 836)
```typescript
app.post("/api/kpi-values", jwtAuthMiddleware, async (req, res) => {
  const validatedData = insertKpiValueSchema.parse({
    ...req.body,
    userId: user.id // ✅ CORRECTO: Asigna automáticamente
  });
});
```

**Estado:** ✅ Seguro - Usuario solo puede crear valores para sí mismo

---

### 4. **Registro Público Sin Validación de Dominio** ⚠️ MEDIO
**Severidad:** 🟡 MEDIO  
**Archivo:** `server/routes.ts` línea 286

```typescript
app.post("/api/register", async (req, res) => {
  // Sin validación de dominio de email
  // Cualquiera puede registrarse con cualquier companyId
  const companyId = Number(req.body.companyId);
  await storage.createUser({...userData, companyId});
});
```

**Riesgo:**
- Usuario malintencionado se registra con companyId de otra empresa
- Sin verificación de email corporativo

**Solución:**
```typescript
// Opción 1: Validar dominio
const allowedDomains = {
  1: ['@dura.com', '@duraint.com'],
  2: ['@orsega.com', '@grupoorsega.com']
};

const emailDomain = email.substring(email.lastIndexOf('@'));
if (!allowedDomains[companyId]?.includes(emailDomain)) {
  return res.status(403).json({ message: "Email no autorizado" });
}

// Opción 2: Deshabilitar registro público
// Solo permitir creación de usuarios por admin
```

---

### 5. **Falta de Rate Limiting** ⚠️ MEDIO
**Severidad:** 🟡 MEDIO

**Endpoints Sin Rate Limiting:**
- `POST /api/login` - Permite fuerza bruta
- `POST /api/register` - Permite spam de registros
- `POST /api/payment-vouchers/upload` - Abuso de OpenAI API

**Solución:**
```typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 5, // 5 intentos
  message: 'Demasiados intentos, intenta en 15 minutos'
});

app.post("/api/login", loginLimiter, async (req, res) => { ... });
```

---

### 6. **Archivos Sin Validación de Contenido Real** ⚠️ BAJO
**Severidad:** 🟢 BAJO

**Multer valida solo `mimetype`**, no contenido:
```typescript
fileFilter: (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // ❌ Confía en header mimetype
  }
}
```

**Solución:**
```typescript
import fileType from 'file-type';

const buffer = await fs.readFile(file.path);
const type = await fileType.fromBuffer(buffer);

if (!type || !['pdf', 'png', 'jpg'].includes(type.ext)) {
  throw new Error('Tipo de archivo no válido');
}
```

---

## ✅ ASPECTOS POSITIVOS

**Implementaciones Correctas:**
- ✅ **SQL Injection protegido** - Parámetros en todas las queries
- ✅ **Password hashing** - Bcrypt implementado
- ✅ **Secrets en env vars** - OpenAI, Banxico, SendGrid
- ✅ **KPI Values** - Auto-asigna userId, no permite suplantación
- ✅ **Role-based KPI management** - Solo admin/manager crean KPIs
- ✅ **Acceso universal de lectura** - Feature intencional, no bug

---

## 📊 RESUMEN DE VULNERABILIDADES

| Severidad | Cantidad | Descripción |
|-----------|----------|-------------|
| 🔴 Crítico | 1 | JWT Secret fallback |
| 🟠 Alto | 1 | Endpoints diagnóstico sin auth |
| 🟡 Medio | 3 | Validación escritura, registro, rate limiting |
| 🟢 Bajo | 1 | Validación contenido archivos |

---

## 🔧 PLAN DE ACCIÓN RECOMENDADO

### **Fase 1: Crítico (Esta semana)**

1. **Eliminar JWT fallback** ✅
   ```typescript
   if (!process.env.JWT_SECRET) {
     throw new Error("JWT_SECRET is required");
   }
   ```

2. **Proteger endpoints de diagnóstico** ✅
   - Opción A: Requiere admin auth
   - Opción B: Versión pública mínima
   - Opción C: Solo en desarrollo

### **Fase 2: Alto Riesgo (2 semanas)**

3. **Aclarar reglas de escritura por empresa** ❓
   - ¿Colaboradores pueden crear datos de cualquier empresa?
   - ¿O solo de su área/empresa?
   - Implementar validación correspondiente

4. **Rate limiting** ✅
   - Login: 5 intentos / 15 min
   - Registro: 3 intentos / hora
   - Upload: 10 archivos / hora

### **Fase 3: Medio Plazo (1 mes)**

5. **Validar dominio en registro** ✅
6. **Validar contenido de archivos** ✅

---

## 🤔 PREGUNTAS PARA ACLARAR

**Antes de implementar correcciones, necesito confirmar:**

1. ¿Los colaboradores PUEDEN crear shipments/clientes para cualquier empresa?
2. ¿O solo para la empresa de su área?
3. ¿Los managers pueden crear/modificar datos de ambas empresas?

**Ejemplo:**
- Omar (Dura, área ventas) crea un shipment
- ¿Puede seleccionar `companyId=2` (Orsega)?
- ¿O debe ser automáticamente `companyId=1` (Dura)?

---

## ✅ CONCLUSIÓN

**Vulnerabilidades críticas confirmadas:**
1. 🔴 JWT Secret fallback (riesgo latente)
2. 🟠 Endpoints diagnóstico expuestos

**NO son vulnerabilidades:**
- ❌ Acceso universal de lectura (feature intencional)
- ❌ GET endpoints sin filtro company (diseño correcto)

**Requiere aclaración:**
- ❓ Reglas de escritura por empresa (crear/modificar datos)

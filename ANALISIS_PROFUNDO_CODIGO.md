# Análisis Profundo de Código - KPIs Grupo Orsega

**Fecha:** 2025-11-10
**Tipo:** Análisis Estático Profundo (Sin Ejecución Runtime)
**Metodología:** Simulación de Flujos Completos + Análisis de Vulnerabilidades + Detección de Race Conditions

---

## 📊 RESUMEN EJECUTIVO

Este análisis profundo identifica **11 problemas reales** en el código mediante análisis estático:

- ✅ **5 Bugs Reales** - Problemas que causarán errores en producción
- 🔴 **3 Vulnerabilidades Críticas** - Problemas de seguridad que requieren atención inmediata
- ⚠️ **3 Problemas Potenciales** - Áreas de mejora para robustez

**Tiempo estimado de corrección:**
- P0 (Crítico): ~1 hora
- P1 (Alto): ~3 horas
- P2 (Medio): ~10 horas

---

## 🐛 BUGS REALES ENCONTRADOS

### BUG #1: Race Condition en Activación de Tokens
**Severidad:** 🔴 Alta
**Archivo:** `server/routes.ts` (líneas 3630-3693)
**Prioridad:** P0

**Problema:**
```typescript
// 1. Primero se consulta el token
const token = await db.getActivationToken(tokenStr);

// 2. Luego se valida
if (!token || token.expiresAt < new Date() || token.usedAt) {
  return res.status(400).json({ message: "Token inválido o expirado" });
}

// 3. Después se activa el usuario (delay potencial)
await db.query(sql`
  UPDATE users SET is_active = true WHERE email = ${token.email}
`);

// 4. Finalmente se marca el token como usado
await db.markActivationTokenAsUsed(tokenStr);
```

**Escenario de Falla:**
1. Usuario A hace clic en el link de activación
2. Usuario A hace clic nuevamente (impaciencia/doble clic)
3. Ambas requests pasan la validación porque el token aún no está marcado como usado
4. El usuario se activa dos veces (puede causar logs duplicados, eventos duplicados, etc.)

**Solución:**
```typescript
// Marcar token como usado ATÓMICAMENTE antes de hacer cambios
const result = await db.query(sql`
  UPDATE activation_tokens
  SET used_at = NOW()
  WHERE token = ${tokenStr}
    AND used_at IS NULL
    AND expires_at > NOW()
  RETURNING *
`);

if (result.rowCount === 0) {
  return res.status(400).json({ message: "Token inválido o expirado" });
}

// Ahora sí activar el usuario
await db.query(sql`UPDATE users SET is_active = true WHERE email = ${result.rows[0].email}`);
```

---

### BUG #2: Race Condition en Registro de Usuarios
**Severidad:** 🟡 Media
**Archivo:** `server/routes.ts` (líneas 443-557)
**Prioridad:** P1

**Problema:**
```typescript
// 1. Primero se valida que el email no existe
const existingUser = await db.getUserByEmail(email);
if (existingUser) {
  return res.status(400).json({ message: "El usuario ya existe" });
}

// 2. Luego se crea el usuario (delay potencial)
const newUser = await db.createUser({ email, password, ... });
```

**Escenario de Falla:**
1. Usuario envía formulario de registro
2. Red lenta, usuario hace clic en "Registrar" nuevamente
3. Ambas requests pasan la validación del email
4. Se crean 2 usuarios con el mismo email (viola constraint UNIQUE)
5. La segunda request falla con error 500 en lugar de un mensaje amigable

**Solución:**
```typescript
try {
  // Dejar que la base de datos maneje la constraint UNIQUE
  const newUser = await db.createUser({ email, password, ... });
} catch (error) {
  if (error.code === '23505' && error.constraint === 'users_email_unique') {
    return res.status(400).json({ message: "El usuario ya existe" });
  }
  throw error;
}
```

---

### BUG #3: Race Condition en Actualización de Valores KPI
**Severidad:** 🔴 Alta
**Archivo:** `server/DatabaseStorage.ts` (líneas 245-337)
**Prioridad:** P0

**Problema:**
```typescript
async upsertCompanyKpiValueNormalized(...) {
  // 1. Buscar valor existente
  const existing = await db.query(
    sql`SELECT * FROM company_kpi_values WHERE kpi_id = ${kpiId} AND period = ${period}`
  );

  // 2. Decidir UPDATE o INSERT
  if (existing.rows.length > 0) {
    // UPDATE
    await db.query(sql`UPDATE company_kpi_values SET actual_value = ${value} ...`);
  } else {
    // INSERT
    await db.query(sql`INSERT INTO company_kpi_values ...`);
  }
}
```

**Escenario de Falla:**
1. Usuario A actualiza KPI de Enero desde la interfaz
2. Proceso automático también actualiza el mismo KPI de Enero (ej: importación de Banxico)
3. Ambas transacciones leen "no existe registro"
4. Ambas intentan INSERT
5. Una falla con constraint violation

**Solución:**
```typescript
// Usar INSERT ... ON CONFLICT DO UPDATE (PostgreSQL upsert nativo)
await db.query(sql`
  INSERT INTO company_kpi_values (kpi_id, period, actual_value, ...)
  VALUES (${kpiId}, ${period}, ${value}, ...)
  ON CONFLICT (kpi_id, period)
  DO UPDATE SET
    actual_value = EXCLUDED.actual_value,
    updated_at = NOW()
`);
```

---

### BUG #4: División por Cero en Cálculo de Compliance
**Severidad:** 🟡 Media
**Archivo:** `server/routes.ts` (líneas 1572-1597)
**Prioridad:** P1

**Problema:**
```typescript
app.get('/api/kpi-values', async (req, res) => {
  // ...
  const compliance = (value.actualValue / kpi.goal) * 100;
  // ...
});
```

**Escenario de Falla:**
1. Admin crea un KPI nuevo pero aún no define el objetivo (goal = 0)
2. Alguien actualiza el valor actual a 100
3. Cálculo: `(100 / 0) * 100 = Infinity`
4. El frontend recibe `compliance: Infinity` y puede romper gráficas

**Solución:**
```typescript
const compliance = kpi.goal && kpi.goal > 0
  ? Math.round((value.actualValue / kpi.goal) * 100)
  : null; // O 0, dependiendo de la lógica de negocio
```

---

### BUG #5: Archivos Temporales No Se Limpian en Errores
**Severidad:** 🟡 Media
**Archivo:** `server/routes.ts` (líneas 5430-5900)
**Prioridad:** P2

**Problema:**
```typescript
app.post('/api/documents/analyze', upload.single('file'), async (req, res) => {
  const filePath = req.file!.path;

  try {
    // Procesar con OpenAI
    const analysis = await analyzeDocument(filePath);

    // Eliminar archivo
    await fs.unlink(filePath);

    return res.json(analysis);
  } catch (error) {
    // ❌ El archivo NO se elimina si hay error aquí
    return res.status(500).json({ error: 'Error al analizar documento' });
  }
});
```

**Escenario de Falla:**
1. Usuario sube documento de 10MB
2. OpenAI API falla (rate limit, timeout, etc.)
3. El archivo queda en disco para siempre
4. Después de 100 errores → 1GB de archivos basura

**Solución:**
```typescript
app.post('/api/documents/analyze', upload.single('file'), async (req, res) => {
  const filePath = req.file!.path;

  try {
    const analysis = await analyzeDocument(filePath);
    return res.json(analysis);
  } catch (error) {
    return res.status(500).json({ error: 'Error al analizar documento' });
  } finally {
    // ✅ Siempre limpiar el archivo
    try {
      await fs.unlink(filePath);
    } catch (unlinkError) {
      console.error('Error eliminando archivo temporal:', unlinkError);
    }
  }
});
```

---

## 🔐 VULNERABILIDADES CRÍTICAS

### VULN #1: Tokens de Activación Predecibles
**Severidad:** 🔴 Crítica
**Archivo:** `server/DatabaseStorage.ts` (líneas 1813-1815)
**Prioridad:** P0

**Problema:**
```typescript
async createActivationToken(email: string) {
  // ❌ Math.random() NO es criptográficamente seguro
  const token = Math.random().toString(36).substring(2, 15) +
                Math.random().toString(36).substring(2, 15);

  await this.query(sql`
    INSERT INTO activation_tokens (email, token, expires_at)
    VALUES (${email}, ${token}, ${expiresAt})
  `);

  return token;
}
```

**Riesgo:**
- Math.random() puede generar tokens predecibles
- Un atacante podría:
  1. Registrar una cuenta con cualquier email (ej: admin@empresa.com)
  2. Generar millones de tokens posibles
  3. Probar cada token en `/api/auth/activate?token=...`
  4. Activar cuentas de otros usuarios

**Solución:**
```typescript
import crypto from 'crypto';

async createActivationToken(email: string) {
  // ✅ crypto.randomBytes es criptográficamente seguro
  const token = crypto.randomBytes(32).toString('hex'); // 64 caracteres hexadecimales

  await this.query(sql`
    INSERT INTO activation_tokens (email, token, expires_at)
    VALUES (${email}, ${token}, ${expiresAt})
  `);

  return token;
}
```

---

### VULN #2: No Validación de Tipo de Archivo Real
**Severidad:** 🔴 Alta
**Archivo:** `server/routes.ts` (líneas 5430-5460)
**Prioridad:** P0

**Problema:**
```typescript
const upload = multer({
  storage: multer.diskStorage({ ... }),
  fileFilter: (req, file, cb) => {
    // ❌ Solo valida la extensión del nombre de archivo
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});
```

**Riesgo:**
- El `mimetype` viene del cliente y puede ser falsificado
- Un atacante puede:
  1. Crear un archivo malicioso (ej: `virus.exe`)
  2. Renombrar a `invoice.pdf`
  3. Modificar el header HTTP para enviar `Content-Type: application/pdf`
  4. El archivo pasa la validación y se guarda en el servidor

**Solución:**
```typescript
import FileType from 'file-type'; // npm install file-type

app.post('/api/documents/analyze', upload.single('file'), async (req, res) => {
  const filePath = req.file!.path;

  try {
    // ✅ Leer los "magic bytes" del archivo para determinar el tipo real
    const fileTypeResult = await FileType.fromFile(filePath);

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!fileTypeResult || !allowedTypes.includes(fileTypeResult.mime)) {
      await fs.unlink(filePath);
      return res.status(400).json({ error: 'Tipo de archivo no permitido' });
    }

    // Continuar con el procesamiento...
  } finally {
    await fs.unlink(filePath);
  }
});
```

---

### VULN #3: No Verificación de Cuenta Activa en Login
**Severidad:** 🟡 Media
**Archivo:** `server/auth.ts` (líneas 117-154)
**Prioridad:** P1

**Problema:**
```typescript
app.post('/api/auth/login', async (req, res) => {
  const user = await db.getUserByEmail(email);

  if (!user) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  // ❌ No se valida si user.is_active === true

  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  return res.json({ token });
});
```

**Riesgo:**
- Un usuario puede registrarse pero no activar su cuenta
- Aún así puede hacer login y acceder a la aplicación
- Omite el flujo de activación por email
- Permite cuentas sin verificar

**Solución:**
```typescript
app.post('/api/auth/login', async (req, res) => {
  const user = await db.getUserByEmail(email);

  if (!user || !user.is_active) {
    // ✅ Validar que la cuenta esté activa
    return res.status(401).json({
      message: "Credenciales inválidas o cuenta no activada"
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET);
  return res.json({ token });
});
```

---

## ⚠️ PROBLEMAS POTENCIALES

### PROB #1: Sin Validación de Longitud Máxima en Strings
**Severidad:** 🟡 Media
**Archivos:** `shared/schema.ts` (múltiples esquemas)
**Prioridad:** P2

**Problema:**
```typescript
export const insertKpiSchema = z.object({
  name: z.string(),  // ❌ Sin max length
  description: z.string().optional(),  // ❌ Sin max length
  unit: z.string(),  // ❌ Sin max length
  // ...
});
```

**Riesgo:**
- Un usuario malicioso puede enviar strings gigantes (ej: 1MB de texto)
- Consume memoria innecesaria
- Puede ralentizar queries de base de datos
- Potencial DoS

**Solución:**
```typescript
export const insertKpiSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  unit: z.string().max(50),
  // ...
});
```

---

### PROB #2: Sin Paginación en Endpoints de Listado
**Severidad:** 🟡 Media
**Archivo:** `server/routes.ts` (endpoints `/api/kpis`, `/api/users`)
**Prioridad:** P2

**Problema:**
```typescript
app.get('/api/kpis', async (req, res) => {
  const kpis = await db.query(sql`SELECT * FROM kpis`);  // ❌ Sin LIMIT
  return res.json(kpis.rows);
});
```

**Riesgo:**
- Si hay 10,000 KPIs, se devuelven todos a la vez
- Consume mucha memoria
- El frontend puede congelarse al renderizar tantos elementos
- Red lenta → timeout

**Solución:**
```typescript
app.get('/api/kpis', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  const kpis = await db.query(sql`
    SELECT * FROM kpis
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const total = await db.query(sql`SELECT COUNT(*) FROM kpis`);

  return res.json({
    data: kpis.rows,
    pagination: {
      page,
      limit,
      total: total.rows[0].count,
      totalPages: Math.ceil(total.rows[0].count / limit)
    }
  });
});
```

---

### PROB #3: Datos Sensibles en Logs
**Severidad:** 🟡 Media
**Archivo:** `client/src/lib/queryClient.ts` (líneas 91, 156, 173)
**Prioridad:** P2

**Problema:**
```typescript
console.log(`🔵 [apiRequest] ${method} ${absoluteUrl}`);  // OK
console.log(`✅ [QueryClient] Respuesta recibida para ${finalRequestUrl}:`, jsonData);  // ❌ Podría loggear datos sensibles
```

**Riesgo:**
- Los logs del navegador pueden contener:
  - Información personal (emails, nombres, salarios)
  - Tokens de autenticación
  - Datos financieros
- Si un usuario comparte su pantalla o hace un screenshot, expone información sensible

**Solución:**
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log(`✅ [QueryClient] Respuesta recibida para ${finalRequestUrl}`);
  // Solo loggear estructura en desarrollo, no contenido completo
  if (Array.isArray(jsonData)) {
    console.log(`Array con ${jsonData.length} elementos`);
  } else {
    console.log(`Objeto con keys:`, Object.keys(jsonData));
  }
}
```

---

## 🔄 SIMULACIÓN DE FLUJOS COMPLETOS

### FLUJO 1: Registro → Activación → Login

**Paso 1: POST /api/auth/register**
```
Input: { email: "test@example.com", password: "Test123!", ... }
↓
Validación Zod ✅
↓
getUserByEmail("test@example.com") → null ✅
↓
bcrypt.hash("Test123!") → $2b$10$... ✅
↓
INSERT INTO users (...) ✅
↓
createActivationToken("test@example.com") ⚠️ VULN #1
↓
sendActivationEmail() ✅
↓
Output: { message: "Usuario registrado. Revisa tu email." }
```

**Paso 2: GET /api/auth/activate?token=abc123**
```
Input: token="abc123"
↓
getActivationToken("abc123") ✅
↓
Validar expiración y uso ✅
↓
UPDATE users SET is_active = true ⚠️ BUG #1 (race condition)
↓
markActivationTokenAsUsed("abc123") ⚠️ BUG #1
↓
Output: { message: "Cuenta activada" }
```

**Paso 3: POST /api/auth/login**
```
Input: { email: "test@example.com", password: "Test123!" }
↓
getUserByEmail("test@example.com") → user object ✅
↓
bcrypt.compare("Test123!", user.password) ✅
↓
❌ NO SE VALIDA user.is_active → VULN #3
↓
jwt.sign({ userId: user.id }, JWT_SECRET) ✅
↓
Output: { token: "eyJhbGc..." }
```

**Resultado:** El flujo funciona pero tiene 2 vulnerabilidades críticas.

---

### FLUJO 2: Crear KPI → Actualizar Valor → Notificación

**Paso 1: POST /api/kpis**
```
Input: { name: "Ventas Q1", unit: "MXN", goal: 1000000, ... }
↓
Validación Zod ✅
↓
Verificar permisos (isAdmin) ✅
↓
INSERT INTO kpis (...) ✅
↓
Output: { id: 42, name: "Ventas Q1", ... }
```

**Paso 2: POST /api/kpi-values**
```
Input: { kpiId: 42, period: "2025-01", actualValue: 850000 }
↓
Validación Zod ✅
↓
upsertCompanyKpiValueNormalized(...) ⚠️ BUG #3 (race condition)
↓
SELECT * FROM company_kpi_values WHERE kpi_id = 42 AND period = '2025-01'
↓
(Si no existe) INSERT INTO company_kpi_values (...)
(Si existe) UPDATE company_kpi_values SET actual_value = 850000
↓
Output: { success: true }
```

**Paso 3: GET /api/kpi-values?kpiId=42**
```
Input: kpiId=42
↓
SELECT * FROM company_kpi_values WHERE kpi_id = 42
↓
Cálculo de compliance: (850000 / 1000000) * 100 = 85% ✅
↓
(Si goal = 0) → Infinity ⚠️ BUG #4
↓
Output: [{ kpiId: 42, actualValue: 850000, compliance: 85 }]
```

**Resultado:** El flujo funciona pero tiene 2 bugs que pueden causar errores en producción.

---

### FLUJO 3: Subir Documento → Análisis IA → Crear Pago

**Paso 1: POST /api/documents/analyze**
```
Input: FormData con file="factura.pdf"
↓
Multer guarda archivo en /uploads/factura-123.pdf ✅
↓
Validación mimetype ⚠️ VULN #2 (puede ser falsificado)
↓
analyzeDocumentWithAI(filePath) → llama OpenAI ✅
↓
(Si OpenAI falla) → archivo no se elimina ⚠️ BUG #5
↓
fs.unlink(filePath) ✅
↓
Output: { provider: "CFE", amount: 1234.56, ... }
```

**Paso 2: POST /api/payments**
```
Input: { companyId: 1, amount: 1234.56, provider: "CFE", ... }
↓
Validación Zod ✅
↓
INSERT INTO payments (...) ✅
↓
Output: { id: 99, amount: 1234.56, ... }
```

**Resultado:** El flujo funciona pero tiene 2 vulnerabilidades de seguridad.

---

## 📋 PLAN DE ACCIÓN PRIORIZADO

### P0 - CRÍTICO (Implementar en las próximas horas)

**Tiempo estimado:** ~1 hora

1. **Cambiar generación de tokens a crypto.randomBytes** (VULN #1)
   - Archivo: `server/DatabaseStorage.ts`
   - Línea: 1813
   - Impacto: Previene ataques de adivinación de tokens

2. **Agregar validación de tipo de archivo real** (VULN #2)
   - Archivo: `server/routes.ts`
   - Líneas: 5430-5460
   - Impacto: Previene subida de archivos maliciosos

3. **Implementar operaciones atómicas para tokens** (BUG #1)
   - Archivo: `server/routes.ts`
   - Líneas: 3630-3693
   - Impacto: Previene doble activación de cuentas

---

### P1 - ALTO (Implementar esta semana)

**Tiempo estimado:** ~3 horas

1. **Validar is_active en login** (VULN #3)
   - Archivo: `server/auth.ts`
   - Línea: 117
   - Impacto: Fuerza el flujo de activación

2. **Manejar race condition en registro** (BUG #2)
   - Archivo: `server/routes.ts`
   - Líneas: 443-557
   - Impacto: Previene errores 500 en registros duplicados

3. **Proteger división por cero en compliance** (BUG #4)
   - Archivo: `server/routes.ts`
   - Líneas: 1572-1597
   - Impacto: Previene valores Infinity en frontend

---

### P2 - MEDIO (Implementar en las próximas 2 semanas)

**Tiempo estimado:** ~10 horas

1. **Usar upsert nativo para KPI values** (BUG #3)
   - Archivo: `server/DatabaseStorage.ts`
   - Líneas: 245-337
   - Impacto: Previene constraint violations

2. **Agregar finally block para limpieza de archivos** (BUG #5)
   - Archivo: `server/routes.ts`
   - Líneas: 5430-5900
   - Impacto: Previene acumulación de archivos basura

3. **Agregar validación de longitud máxima** (PROB #1)
   - Archivo: `shared/schema.ts`
   - Múltiples esquemas
   - Impacto: Previene ataques DoS

4. **Implementar paginación** (PROB #2)
   - Archivo: `server/routes.ts`
   - Endpoints de listado
   - Impacto: Mejora performance con datasets grandes

5. **Reducir logging de datos sensibles** (PROB #3)
   - Archivo: `client/src/lib/queryClient.ts`
   - Líneas: 91, 156, 173
   - Impacto: Mejora privacidad

---

## 🎯 CONCLUSIÓN

Este análisis profundo ha identificado **11 problemas reales** que pueden afectar la seguridad, estabilidad y rendimiento de la aplicación:

- **3 vulnerabilidades críticas** que exponen la aplicación a ataques
- **5 bugs reales** que causarán errores en producción
- **3 problemas potenciales** que afectarán la escalabilidad

**Recomendación:** Implementar los arreglos P0 antes de continuar con nuevas funcionalidades.

---

## 📚 APÉNDICE: METODOLOGÍA

Este análisis se realizó mediante:

1. **Lectura completa del código** - Todos los archivos críticos fueron analizados línea por línea
2. **Simulación de flujos** - Se siguieron 3 flujos completos de punta a punta
3. **Análisis de race conditions** - Se identificaron puntos donde múltiples requests concurrentes pueden causar problemas
4. **Revisión de seguridad** - Se buscaron vulnerabilidades OWASP Top 10
5. **Análisis de edge cases** - Se consideraron escenarios de falla (división por cero, valores nulos, etc.)

**Limitaciones:**
- No se ejecutó el código (análisis estático solamente)
- No se probaron flujos con datos reales
- No se validó el comportamiento con usuarios concurrentes reales

**Próximos pasos sugeridos:**
- Implementar los arreglos P0
- Configurar tests automatizados para prevenir regresiones
- Considerar un pentest profesional antes de lanzamiento en producción

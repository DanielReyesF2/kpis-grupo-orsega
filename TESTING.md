# 🧪 Guía de Testing y Auditoría

Esta guía documenta el proceso completo de testing y auditoría para el proyecto KPIs Grupo Orsega.

## 📋 Tabla de Contenidos

- [Infraestructura de Testing](#infraestructura-de-testing)
- [Tipos de Tests](#tipos-de-tests)
- [Ejecutar Tests](#ejecutar-tests)
- [Auditoría Completa](#auditoría-completa)
- [Checklist Pre-Deploy](#checklist-pre-deploy)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ Infraestructura de Testing

### Herramientas Instaladas

- **Jest**: Framework de testing unitario y de integración
- **Supertest**: Testing de APIs HTTP
- **Playwright**: Testing end-to-end (E2E)
- **ts-jest**: Soporte de TypeScript para Jest

### Estructura de Directorios

```
tests/
├── unit/                    # Tests unitarios (funciones individuales)
│   └── document-analyzer.test.ts
├── integration/             # Tests de integración (endpoints completos)
│   └── payment-vouchers-upload.test.ts
├── e2e/                     # Tests end-to-end (flujos de usuario)
│   └── (por implementar)
├── test-files/              # Archivos de prueba (PDFs, imágenes, etc.)
│   ├── factura-ejemplo.pdf
│   ├── comprobante-pago-ejemplo.pdf
│   └── rep-ejemplo.pdf
└── setup.ts                 # Configuración global de tests
```

---

## 🧪 Tipos de Tests

### 1. Tests Unitarios

**Propósito**: Verificar que funciones individuales funcionan correctamente en aislamiento.

**Ejemplo**:
```typescript
// tests/unit/document-analyzer.test.ts
it('debe extraer texto de un PDF válido', async () => {
  const pdfBuffer = readFileSync('test.pdf');
  const result = await analyzePaymentDocument(pdfBuffer, 'application/pdf');
  expect(result.documentType).toBe('invoice');
});
```

**Cuándo ejecutar**:
- Después de modificar funciones críticas
- Antes de cada commit
- Durante desarrollo de nuevas features

**Ejecutar**:
```bash
npm run test:unit
```

### 2. Tests de Integración

**Propósito**: Verificar que endpoints completos funcionan correctamente, incluyendo autenticación, base de datos y lógica de negocio.

**Ejemplo**:
```typescript
// tests/integration/payment-vouchers-upload.test.ts
it('debe subir y procesar un comprobante de pago', async () => {
  const response = await request(app)
    .post('/api/payment-vouchers/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('voucher', 'test.pdf');

  expect(response.status).toBe(201);
});
```

**Cuándo ejecutar**:
- Antes de pull requests
- Después de cambios en endpoints
- Antes de deploy a staging/producción

**Ejecutar**:
```bash
npm run test:integration
```

### 3. Tests End-to-End (E2E)

**Propósito**: Simular flujos completos de usuario desde el navegador.

**Ejemplo**:
```typescript
// tests/e2e/upload-invoice.test.ts
test('Usuario puede subir factura completa', async ({ page }) => {
  await page.goto('http://localhost:8080/login');
  await page.fill('input[name="username"]', 'admin');
  await page.click('button[type="submit"]');
  await page.goto('http://localhost:8080/treasury');
  await page.setInputFiles('input[type="file"]', 'factura.pdf');
  await page.click('button:has-text("Subir")');
  await expect(page.locator('.success-message')).toBeVisible();
});
```

**Cuándo ejecutar**:
- Antes de releases mayores
- Después de cambios en UI
- Testing de regresión

**Ejecutar**:
```bash
npm run test:e2e
```

### 4. Smoke Tests

**Propósito**: Verificación rápida de que lo básico funciona (servidor arranca, archivos críticos existen, dependencias instaladas).

**Cuándo ejecutar**:
- Antes de CADA deploy
- Después de `npm install`
- Después de cambios en configuración

**Ejecutar**:
```bash
npm run test:smoke
```

---

## 🚀 Ejecutar Tests

### Comandos Disponibles

```bash
# Todos los tests
npm test

# Tests unitarios solamente
npm run test:unit

# Tests de integración solamente
npm run test:integration

# Tests E2E solamente
npm run test:e2e

# Smoke tests (verificación rápida)
npm run test:smoke

# Tests con coverage report
npm run test:coverage

# Tests en modo watch (re-ejecuta al guardar)
npm run test:watch
```

### Interpretar Resultados

```bash
PASS  tests/unit/document-analyzer.test.ts
  ✓ debe analizar una factura PDF correctamente (2345ms)
  ✓ debe manejar errores cuando falta OPENAI_API_KEY (123ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Time:        3.456s
```

- **PASS**: Test pasó correctamente ✅
- **FAIL**: Test falló ❌
- **(Xms)**: Tiempo de ejecución

---

## 🔍 Auditoría Completa

### Checklist de Auditoría REAL

Esta es la auditoría completa que debemos hacer antes de considerar el código "production-ready".

#### ✅ 1. Auditoría de Código Estático

```bash
# Verificar que TypeScript compila sin errores
npm run check

# Ejecutar auditoría de seguridad
npm audit

# Ejecutar auditoría personalizada del proyecto
npm run audit
```

**Verificar**:
- [ ] No hay errores de TypeScript
- [ ] No hay vulnerabilidades críticas en dependencias
- [ ] No hay código duplicado
- [ ] No hay contraseñas en código
- [ ] No hay console.log olvidados en producción

#### ✅ 2. Tests Automatizados

```bash
# Ejecutar TODOS los tests
npm test

# Verificar coverage
npm run test:coverage
```

**Verificar**:
- [ ] Todos los tests unitarios pasan
- [ ] Todos los tests de integración pasan
- [ ] Coverage > 60% en código crítico
- [ ] Tests de document-analyzer.ts pasan (PDF parsing)
- [ ] Tests de subida de archivos pasan

#### ✅ 3. Testing Manual - Funcionalidades Críticas

**IMPORTANTE**: Ejecutar MANUALMENTE cada funcionalidad crítica.

##### 3.1. Autenticación
- [ ] Login con credenciales válidas funciona
- [ ] Login con credenciales inválidas muestra error
- [ ] Logout funciona
- [ ] JWT token se renueva correctamente
- [ ] Roles y permisos funcionan (admin, manager, user, viewer)

##### 3.2. Subida de Archivos (CRÍTICO)
- [ ] Subir PDF de factura funciona
- [ ] Subir PDF de comprobante de pago funciona
- [ ] Subir PDF de REP funciona
- [ ] Subir archivo inválido muestra error apropiado
- [ ] Subir archivo > 10MB muestra error
- [ ] Datos extraídos del PDF son correctos
- [ ] Se crea cuenta por pagar automáticamente para facturas

##### 3.3. KPIs
- [ ] Ver lista de KPIs funciona
- [ ] Editar valor de KPI funciona
- [ ] Guardar status de KPI funciona
- [ ] Historial de KPI muestra cambios
- [ ] Gráficas de KPI se renderizan correctamente

##### 3.4. Tesorería
- [ ] Ver cuentas por pagar funciona
- [ ] Crear cuenta por pagar manual funciona
- [ ] Subir archivo IDRALL funciona
- [ ] Ver tipos de cambio funciona
- [ ] Actualizar tipo de cambio funciona

#### ✅ 4. Testing de Casos Edge

**Probar casos extremos que rompen la app**:

- [ ] ¿Qué pasa si subo PDF de 100MB? (debe rechazar)
- [ ] ¿Qué pasa si subo 10 archivos simultáneos? (debe manejar)
- [ ] ¿Qué pasa si pierdo conexión a internet mientras subo? (debe mostrar error)
- [ ] ¿Qué pasa si la base de datos está caída? (debe mostrar error, no crash)
- [ ] ¿Qué pasa si OpenAI API falla? (debe manejar gracefully)
- [ ] ¿Qué pasa si dos usuarios editan el mismo KPI simultáneamente? (debe manejar)

#### ✅ 5. Performance Testing

```bash
# Verificar tiempos de carga
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:8080/api/kpis
```

**Verificar**:
- [ ] Página de login carga < 1 segundo
- [ ] Dashboard carga < 3 segundos
- [ ] Subida de PDF procesa < 10 segundos
- [ ] API endpoints responden < 500ms (promedio)

#### ✅ 6. Security Testing

**CRITICAL**: Verificar seguridad antes de production.

- [ ] No se pueden acceder recursos de otra empresa (multi-tenant)
- [ ] Endpoints requieren autenticación
- [ ] Tokens JWT expiran correctamente
- [ ] Passwords están hasheadas (NO plain text)
- [ ] SQL injection no es posible (usar Drizzle ORM correctamente)
- [ ] XSS no es posible (sanitizar inputs)
- [ ] Archivos subidos se validan correctamente
- [ ] Rate limiting funciona para prevenir abuse

#### ✅ 7. Cross-Browser Testing

- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

#### ✅ 8. Database Integrity

```sql
-- Verificar que datos críticos tienen constraints
SELECT * FROM users WHERE password IS NULL;  -- Debe ser 0
SELECT * FROM kpi_values_dura WHERE value IS NULL;  -- Verificar si hay nulls inesperados
```

**Verificar**:
- [ ] No hay registros huérfanos (foreign keys válidas)
- [ ] No hay duplicados inesperados
- [ ] Índices existen para queries frecuentes
- [ ] Migrations se ejecutaron correctamente

---

## 📝 Checklist Pre-Deploy

### Antes de CUALQUIER deploy a producción:

```bash
# 1. Ejecutar smoke tests
npm run test:smoke

# 2. Ejecutar todos los tests
npm test

# 3. Verificar que build funciona
npm run build

# 4. Verificar variables de entorno
cat .env | grep -E "DATABASE_URL|JWT_SECRET|OPENAI_API_KEY"

# 5. Verificar que no hay cambios uncommitted
git status
```

**Checklist manual**:
- [ ] Smoke tests pasan
- [ ] Todos los tests automatizados pasan
- [ ] Build completa sin errores
- [ ] Variables de entorno configuradas
- [ ] Cambios commiteados y pusheados
- [ ] PR revisado y aprobado
- [ ] Testing manual hecho en staging
- [ ] Backups de base de datos hechos
- [ ] Plan de rollback documentado

---

## 🐛 Troubleshooting

### Tests Fallan con "ENOENT: no such file or directory"

**Problema**: pdf-parse bug (archivo de test interno).

**Solución**: Ya migrado a pdfjs-dist. Si persiste:
```bash
npm uninstall pdf-parse
npm install pdfjs-dist@3.11.174
```

### Tests Fallan con "Cannot find module"

**Problema**: Dependencias no instaladas.

**Solución**:
```bash
npm install
```

### Tests Timeout

**Problema**: Operación tarda mucho (ej. procesando PDF grande).

**Solución**: Aumentar timeout en jest.config.js:
```javascript
testTimeout: 60000  // 60 segundos
```

### Smoke Tests Fallan - "Servidor no responde"

**Problema**: Servidor no está corriendo.

**Solución**:
```bash
npm run dev  # En otra terminal
# Luego ejecutar smoke tests
npm run test:smoke
```

---

## 📚 Recursos Adicionales

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

## 🎯 Próximos Pasos

### Para Completar la Infraestructura de Testing:

1. **Implementar tests E2E con Playwright**
   - Flujo de login completo
   - Flujo de subida de factura
   - Flujo de edición de KPI

2. **Agregar tests de integración faltantes**
   - POST /api/treasury/idrall/upload
   - PUT /api/kpis/:id
   - POST /api/treasury/exchange-rates

3. **Configurar CI/CD**
   - GitHub Actions para ejecutar tests en cada PR
   - Bloquear merge si tests fallan
   - Ejecutar smoke tests antes de deploy automático

4. **Aumentar coverage**
   - Objetivo: > 80% en código crítico
   - Prioridad: document-analyzer, routes, auth

5. **Documentar más casos edge**
   - Crear issues para cada caso edge encontrado
   - Agregar tests para prevenir regresiones

---

**Última actualización**: 2025-11-07
**Autor**: Claude Code
**Versión**: 1.0.0

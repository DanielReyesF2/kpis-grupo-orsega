# Plan de Refactoring - División de Routes

## Estructura Propuesta:

### `/server/routes/`
- `auth.routes.ts` - Autenticación y usuarios
- `kpis.routes.ts` - Gestión de KPIs
- `logistics.routes.ts` - Logística y envíos
- `treasury.routes.ts` - Tesorería y pagos
- `analytics.routes.ts` - Reportes y análisis
- `admin.routes.ts` - Administración del sistema
- `catalog.routes.ts` - Catálogos y configuración

### `/server/controllers/`
- `auth.controller.ts`
- `kpis.controller.ts`
- `logistics.controller.ts`
- `treasury.controller.ts`
- `analytics.controller.ts`
- `admin.controller.ts`

### `/server/services/`
- `auth.service.ts`
- `kpis.service.ts`
- `logistics.service.ts`
- `treasury.service.ts`
- `analytics.service.ts`
- `email.service.ts`

### `/server/middleware/`
- `auth.middleware.ts`
- `validation.middleware.ts`
- `rate-limit.middleware.ts`
- `security.middleware.ts`

## Beneficios:
- ✅ Código mantenible
- ✅ Desarrollo paralelo
- ✅ Testing individual
- ✅ Escalabilidad
- ✅ Onboarding rápido

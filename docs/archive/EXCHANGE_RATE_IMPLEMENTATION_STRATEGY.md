# 🚀 ESTRATEGIA DE IMPLEMENTACIÓN: Mejora del Módulo de Histórico de Tipos de Cambio

**Fecha:** 2025-11-05  
**Objetivo:** Desarrollo en staging/feature-flags con validación sin comprometer producción

---

## 📋 TABLA DE CONTENIDOS

1. [Estrategia de Feature Flags](#estrategia-de-feature-flags)
2. [Ambiente de Staging](#ambiente-de-staging)
3. [Plan de Desarrollo Incremental](#plan-de-desarrollo-incremental)
4. [Compatibilidad hacia Atrás](#compatibilidad-hacia-atrás)
5. [Rollback Strategy](#rollback-strategy)

---

## 🚩 ESTRATEGIA DE FEATURE FLAGS

### Sistema de Feature Flags

#### Opción 1: Feature Flag Simple (Recomendado para MVP)

**Implementación con Variable de Entorno:**

```typescript
// server/config/features.ts
export const FEATURES = {
  NEW_EXCHANGE_RATE_HISTORY: process.env.FEATURE_NEW_EXCHANGE_RATE_HISTORY === 'true',
  NEW_EXCHANGE_RATE_ENDPOINTS: process.env.FEATURE_NEW_EXCHANGE_RATE_ENDPOINTS === 'true',
} as const;

// client/src/hooks/useFeatureFlag.ts
export function useFeatureFlag(feature: keyof typeof FEATURES): boolean {
  // En producción, leer de variable de entorno o API
  // En desarrollo, usar localStorage para testing
  if (process.env.NODE_ENV === 'development') {
    const stored = localStorage.getItem(`feature:${feature}`);
    if (stored !== null) return stored === 'true';
  }
  
  // En producción, leer de variable de entorno
  return FEATURES[feature] ?? false;
}
```

#### Opción 2: Feature Flag Dinámico (Recomendado para Rollout Gradual)

**Implementación con API de Feature Flags:**

```typescript
// server/routes.ts - Endpoint para feature flags
app.get('/api/features', (req, res) => {
  const userId = req.user?.id;
  const userEmail = req.user?.email;
  
  // Feature flags basados en usuario, email, o porcentaje
  res.json({
    newExchangeRateHistory: shouldEnableFeature(userId, userEmail, 'new-exchange-rate-history'),
    newExchangeRateEndpoints: shouldEnableFeature(userId, userEmail, 'new-exchange-rate-endpoints'),
  });
});

function shouldEnableFeature(userId: number, email: string, feature: string): boolean {
  // Por defecto desactivado
  const defaultEnabled = false;
  
  // Activar para usuarios específicos (testing)
  const testUsers = ['admin@example.com', 'test@example.com'];
  if (testUsers.includes(email)) return true;
  
  // Rollout gradual por porcentaje (ej: 10% de usuarios)
  const rolloutPercentage = 10; // 10%
  const hash = (userId + feature).split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return Math.abs(hash) % 100 < rolloutPercentage;
}
```

### Feature Flags Necesarios

1. **`new-exchange-rate-history`**
   - **Tipo:** Frontend
   - **Propósito:** Activar nuevo componente de histórico
   - **Default:** `false`
   - **Rollout:** Gradual (10% → 50% → 100%)

2. **`new-exchange-rate-endpoints`**
   - **Tipo:** Backend
   - **Propósito:** Activar nuevos endpoints `/range` y `/stats`
   - **Default:** `false`
   - **Rollout:** Inmediato (una vez validado en staging)

3. **`enhanced-exchange-rate-filters`**
   - **Tipo:** Frontend
   - **Propósito:** Activar nuevos filtros (periodo, fuentes)
   - **Default:** `false`
   - **Rollout:** Gradual (junto con nuevo componente)

### Uso en Componentes

```typescript
// client/src/components/treasury/ExchangeRateHistory.tsx
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export function ExchangeRateHistory() {
  const useNewHistory = useFeatureFlag('new-exchange-rate-history');
  
  if (useNewHistory) {
    return <ExchangeRateHistoryV2 />;
  }
  
  return <ExchangeRateHistoryV1 />;
}
```

---

## 🧪 AMBIENTE DE STAGING

### Configuración de Staging

#### Variables de Entorno

```env
# .env.staging
NODE_ENV=staging
FEATURE_NEW_EXCHANGE_RATE_HISTORY=true
FEATURE_NEW_EXCHANGE_RATE_ENDPOINTS=true
FEATURE_ENHANCED_EXCHANGE_RATE_FILTERS=true

# Base de datos de staging (separada de producción)
DATABASE_URL=postgresql://user:pass@staging-db:5432/kpis_staging

# Feature flags activados en staging
FEATURE_FLAGS_ENABLED=true
```

#### Configuración de Deployment

1. **Staging Environment**
   - Branch: `staging` o `develop`
   - Deploy automático en push a staging
   - Base de datos separada (copia de producción periódica)

2. **Testing en Staging**
   - Acceso para equipo de QA
   - Acceso para usuarios beta
   - Monitoreo de errores y performance

### Checklist de Validación en Staging

- [ ] Endpoints nuevos funcionando correctamente
- [ ] Endpoints existentes no se rompen
- [ ] Componente nuevo renderiza correctamente
- [ ] Filtros funcionan como se espera
- [ ] Métricas se calculan correctamente
- [ ] Performance aceptable (tiempos de respuesta < 2s)
- [ ] No hay errores en consola
- [ ] Compatibilidad con navegadores principales
- [ ] Mobile responsive funciona
- [ ] Accesibilidad (a11y) validada

---

## 📦 PLAN DE DESARROLLO INCREMENTAL

### Fase 1: Backend - Nuevos Endpoints (Sin Feature Flag)

**Objetivo:** Implementar nuevos endpoints sin afectar los existentes

**Tareas:**
1. Crear endpoint `/api/treasury/exchange-rates/range`
2. Crear endpoint `/api/treasury/exchange-rates/stats`
3. Testing de nuevos endpoints en staging
4. Validar que no afectan endpoints existentes

**Criterios de Éxito:**
- ✅ Nuevos endpoints responden correctamente
- ✅ Endpoints existentes siguen funcionando
- ✅ Performance aceptable
- ✅ Tests pasando

**Rollout:**
- Desplegar en staging primero
- Validar en staging por 2-3 días
- Desplegar en producción (sin feature flag, pero no usados aún)

### Fase 2: Backend - Modificar Endpoints Existentes (Con Compatibilidad)

**Objetivo:** Agregar parámetros opcionales a endpoints existentes

**Tareas:**
1. Modificar `/api/treasury/exchange-rates/daily` (agregar `days`, `sources[]`)
2. Modificar `/api/treasury/exchange-rates/monthly` (agregar `months`, `sources[]`)
3. Validar compatibilidad hacia atrás (sin parámetros = comportamiento actual)
4. Testing de regresión

**Criterios de Éxito:**
- ✅ Endpoints funcionan sin parámetros (comportamiento actual)
- ✅ Endpoints funcionan con nuevos parámetros
- ✅ No hay breaking changes
- ✅ Tests de regresión pasando

**Rollout:**
- Desplegar en staging primero
- Validar compatibilidad en staging
- Desplegar en producción (comportamiento actual preservado)

### Fase 3: Frontend - Nuevos Componentes (Con Feature Flag)

**Objetivo:** Implementar nuevos componentes con feature flag desactivado

**Tareas:**
1. Crear componente `PeriodSelector`
2. Crear componente `SourceFilter`
3. Crear componente `ExchangeRateStats`
4. Modificar `ExchangeRateHistory` con feature flag
5. Testing de componentes individuales

**Criterios de Éxito:**
- ✅ Componentes nuevos renderizan correctamente
- ✅ Feature flag funciona (activa/desactiva)
- ✅ Componente viejo sigue funcionando cuando flag desactivado
- ✅ Tests pasando

**Rollout:**
- Desplegar en staging con flag desactivado
- Activar flag en staging para testing
- Validar en staging por 2-3 días
- Desplegar en producción con flag desactivado

### Fase 4: Frontend - Integración (Con Feature Flag)

**Objetivo:** Integrar nuevos componentes y funcionalidad

**Tareas:**
1. Integrar `PeriodSelector` en `ExchangeRateHistory`
2. Integrar `SourceFilter` en `ExchangeRateHistory`
3. Integrar `ExchangeRateStats` en `ExchangeRateHistory`
4. Actualizar queries React Query
5. Testing de integración

**Criterios de Éxito:**
- ✅ Filtros funcionan correctamente
- ✅ Queries se actualizan al cambiar filtros
- ✅ Gráficas se actualizan correctamente
- ✅ Performance aceptable
- ✅ Tests de integración pasando

**Rollout:**
- Desplegar en staging con flag activado
- Validar funcionalidad completa en staging
- Feedback de usuarios beta
- Desplegar en producción con flag desactivado

### Fase 5: Rollout Gradual (Producción)

**Objetivo:** Activar gradualmente para usuarios en producción

**Estrategia de Rollout:**

1. **Fase 5.1: Rollout 10% (1 semana)**
   - Activar flag para 10% de usuarios
   - Monitorear errores y performance
   - Recopilar feedback

2. **Fase 5.2: Rollout 50% (1 semana)**
   - Activar flag para 50% de usuarios
   - Monitorear errores y performance
   - Validar estabilidad

3. **Fase 5.3: Rollout 100% (1 semana)**
   - Activar flag para todos los usuarios
   - Monitorear errores y performance
   - Validar adopción

4. **Fase 5.4: Cleanup (1 semana después)**
   - Remover código legacy (componente viejo)
   - Remover feature flags
   - Documentar cambios finales

---

## 🔄 COMPATIBILIDAD HACIA ATRÁS

### Estrategia de Versionado

#### Backend - Endpoints Modificados

**Antes (Versión Actual):**
```typescript
// GET /api/treasury/exchange-rates/daily?rateType=buy
// Retorna: { hour: string, timestamp: string, santander?: number, monex?: number, dof?: number }[]
```

**Después (Con Compatibilidad):**
```typescript
// GET /api/treasury/exchange-rates/daily?rateType=buy
// GET /api/treasury/exchange-rates/daily?rateType=buy&days=7
// GET /api/treasury/exchange-rates/daily?rateType=buy&days=7&sources[]=monex&sources[]=santander

// Comportamiento:
// - Sin parámetros nuevos = comportamiento actual (1 día, todas las fuentes)
// - Con parámetros nuevos = nuevo comportamiento
```

**Implementación:**
```typescript
app.get("/api/treasury/exchange-rates/daily", jwtAuthMiddleware, async (req, res) => {
  const rateType = (req.query.rateType as string) || 'buy';
  const days = parseInt(req.query.days as string) || 1; // Default: 1 día (comportamiento actual)
  const sources = req.query.sources ? 
    (Array.isArray(req.query.sources) ? req.query.sources : [req.query.sources]) as string[] :
    null; // null = todas las fuentes (comportamiento actual)
  
  // Lógica que soporta ambos casos
  // ...
});
```

#### Frontend - Componente Modificado

**Estrategia: Componente Wrapper con Feature Flag**

```typescript
// ExchangeRateHistory.tsx (Wrapper)
export function ExchangeRateHistory() {
  const useNewHistory = useFeatureFlag('new-exchange-rate-history');
  
  if (useNewHistory) {
    return <ExchangeRateHistoryV2 />;
  }
  
  return <ExchangeRateHistoryV1 />;
}

// ExchangeRateHistoryV1.tsx (Componente actual - sin cambios)
// ExchangeRateHistoryV2.tsx (Nuevo componente con mejoras)
```

**Ventajas:**
- ✅ Cero breaking changes
- ✅ Rollback instantáneo (desactivar feature flag)
- ✅ Testing independiente de cada versión
- ✅ Rollout gradual posible

---

## 🔙 ROLLBACK STRATEGY

### Plan de Rollback por Fase

#### Fase 1-2: Backend (Rollback Inmediato)

**Si hay problemas:**
1. Desactivar nuevos endpoints (si es necesario)
2. Revertir cambios en endpoints modificados
3. Deploy de versión anterior

**Tiempo estimado:** 5-10 minutos

#### Fase 3-4: Frontend (Rollback con Feature Flag)

**Si hay problemas:**
1. Desactivar feature flag (`FEATURE_NEW_EXCHANGE_RATE_HISTORY=false`)
2. Usuarios vuelven automáticamente a versión anterior
3. No requiere deploy

**Tiempo estimado:** 1-2 minutos (cambio de variable de entorno)

#### Fase 5: Rollout Gradual (Rollback Gradual)

**Si hay problemas:**
1. Reducir porcentaje de rollout (ej: 50% → 10%)
2. Desactivar completamente si es crítico
3. Investigar y corregir problemas
4. Reiniciar rollout gradual

**Tiempo estimado:** 2-5 minutos

### Procedimiento de Rollback

1. **Identificar Problema**
   - Monitorear errores en Sentry/Logs
   - Validar reportes de usuarios
   - Confirmar impacto

2. **Decidir Rollback**
   - Evaluar severidad del problema
   - Determinar si es crítico o menor
   - Decidir rollback parcial o completo

3. **Ejecutar Rollback**
   - Desactivar feature flag (si aplica)
   - Revertir cambios (si aplica)
   - Deploy de versión anterior (si aplica)

4. **Validar Rollback**
   - Confirmar que usuarios vuelven a versión anterior
   - Validar que no hay errores nuevos
   - Confirmar estabilidad

5. **Post-Rollback**
   - Investigar causa raíz
   - Corregir problemas
   - Planificar nuevo rollout

---

## ✅ CHECKLIST DE VALIDACIÓN POR FASE

### Fase 1: Backend - Nuevos Endpoints

- [ ] Endpoints nuevos funcionan en staging
- [ ] Endpoints existentes no se rompen
- [ ] Performance aceptable
- [ ] Tests pasando
- [ ] Documentación actualizada

### Fase 2: Backend - Modificar Endpoints

- [ ] Compatibilidad hacia atrás validada
- [ ] Nuevos parámetros funcionan
- [ ] Sin parámetros = comportamiento actual
- [ ] Tests de regresión pasando
- [ ] Performance no degradada

### Fase 3: Frontend - Nuevos Componentes

- [ ] Componentes renderizan correctamente
- [ ] Feature flag funciona
- [ ] Componente viejo sigue funcionando
- [ ] Tests pasando
- [ ] Sin errores en consola

### Fase 4: Frontend - Integración

- [ ] Filtros funcionan correctamente
- [ ] Queries se actualizan
- [ ] Gráficas se actualizan
- [ ] Tests de integración pasando
- [ ] Performance aceptable

### Fase 5: Rollout Gradual

- [ ] Rollout 10% sin problemas
- [ ] Rollout 50% sin problemas
- [ ] Rollout 100% sin problemas
- [ ] Monitoreo activo
- [ ] Feedback positivo de usuarios

---

**Documento creado por:** Sistema de Auditoría  
**Última actualización:** 2025-11-05


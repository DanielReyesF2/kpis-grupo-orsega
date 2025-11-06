# 🚀 GUÍA DE DESPLIEGUE: Mejora del Módulo de Histórico de Tipos de Cambio

**Fecha:** 2025-11-05  
**Objetivo:** Despliegue incremental fase por fase con validación en cada etapa

---

## 📋 TABLA DE CONTENIDOS

1. [Pre-requisitos](#pre-requisitos)
2. [Estrategia de Despliegue](#estrategia-de-despliegue)
3. [Fase 1: Backend - Nuevos Endpoints](#fase-1-backend---nuevos-endpoints)
4. [Fase 2: Backend - Modificar Endpoints](#fase-2-backend---modificar-endpoints)
5. [Fase 3: Frontend - Componentes con Feature Flag](#fase-3-frontend---componentes-con-feature-flag)
6. [Fase 4: Frontend - Integración](#fase-4-frontend---integración)
7. [Fase 5: Rollout Gradual](#fase-5-rollout-gradual)
8. [Rollback Procedures](#rollback-procedures)
9. [Validación Post-Deploy](#validación-post-deploy)

---

## ✅ PRE-REQUISITOS

### Ambiente de Staging

- [ ] Ambiente de staging configurado y funcionando
- [ ] Base de datos de staging con datos de prueba
- [ ] Feature flags configurados en staging
- [ ] Monitoreo y logging configurados

### Testing

- [ ] Todos los tests pasando en local
- [ ] Tests de regresión ejecutados
- [ ] Tests de performance ejecutados
- [ ] Code review aprobado

### Documentación

- [ ] Documentación de cambios actualizada
- [ ] Changelog preparado
- [ ] Comunicación al equipo enviada

---

## 🎯 ESTRATEGIA DE DESPLIEGUE

### Principios

1. **Incremental:** Fase por fase, validar antes de avanzar
2. **Seguro:** Feature flags para rollback rápido
3. **Compatible:** Mantener funcionalidad existente
4. **Monitoreado:** Validar en cada etapa

### Timeline Estimado

- **Fase 1:** 1 día (Backend - Nuevos endpoints)
- **Fase 2:** 1 día (Backend - Modificar endpoints)
- **Fase 3:** 2 días (Frontend - Componentes)
- **Fase 4:** 2 días (Frontend - Integración)
- **Fase 5:** 1 semana (Rollout gradual)

**Total:** ~2 semanas

---

## 📦 FASE 1: BACKEND - NUEVOS ENDPOINTS

### Objetivo

Desplegar nuevos endpoints sin afectar los existentes.

### Tareas

1. **Deploy en Staging**
   ```bash
   # Branch: feature/exchange-rate-history-improvements
   git checkout feature/exchange-rate-history-improvements
   git pull origin feature/exchange-rate-history-improvements
   
   # Deploy a staging
   npm run deploy:staging
   ```

2. **Validar Endpoints en Staging**
   ```bash
   # Test nuevos endpoints
   curl -X GET "https://staging.example.com/api/treasury/exchange-rates/range?startDate=2025-01-01&endDate=2025-01-07&rateType=buy" \
     -H "Authorization: Bearer $TOKEN"
   
   curl -X GET "https://staging.example.com/api/treasury/exchange-rates/stats?startDate=2025-01-01&endDate=2025-01-07&rateType=buy" \
     -H "Authorization: Bearer $TOKEN"
   ```

3. **Validar Endpoints Existentes**
   ```bash
   # Verificar que endpoints existentes siguen funcionando
   curl -X GET "https://staging.example.com/api/treasury/exchange-rates/daily?rateType=buy" \
     -H "Authorization: Bearer $TOKEN"
   
   curl -X GET "https://staging.example.com/api/treasury/exchange-rates/monthly?year=2025&month=1&rateType=buy" \
     -H "Authorization: Bearer $TOKEN"
   ```

### Checklist de Validación

- [ ] Nuevos endpoints responden correctamente
- [ ] Endpoints existentes siguen funcionando
- [ ] Performance aceptable (< 2s para 1 semana)
- [ ] No hay errores en logs
- [ ] Tests pasando en staging

### Deploy a Producción

```bash
# Merge a main
git checkout main
git merge feature/exchange-rate-history-improvements
git push origin main

# Deploy a producción (automático o manual según configuración)
```

### Validación Post-Deploy

- [ ] Endpoints nuevos accesibles en producción
- [ ] Endpoints existentes siguen funcionando
- [ ] Monitoreo sin errores
- [ ] Performance aceptable

### Rollback (si es necesario)

```bash
# Revertir commit
git revert HEAD
git push origin main

# O rollback de deploy (según plataforma)
```

---

## 📦 FASE 2: BACKEND - MODIFICAR ENDPOINTS

### Objetivo

Agregar parámetros opcionales a endpoints existentes manteniendo compatibilidad.

### Tareas

1. **Deploy en Staging**
   ```bash
   # Continuar en mismo branch
   git checkout feature/exchange-rate-history-improvements
   git pull origin feature/exchange-rate-history-improvements
   
   # Deploy a staging
   npm run deploy:staging
   ```

2. **Validar Compatibilidad hacia Atrás**
   ```bash
   # Test sin parámetros nuevos (comportamiento actual)
   curl -X GET "https://staging.example.com/api/treasury/exchange-rates/daily?rateType=buy" \
     -H "Authorization: Bearer $TOKEN"
   
   # Test con parámetros nuevos
   curl -X GET "https://staging.example.com/api/treasury/exchange-rates/daily?rateType=buy&days=7&sources[]=monex" \
     -H "Authorization: Bearer $TOKEN"
   
   # Validar que respuestas son compatibles
   ```

3. **Validar Performance**
   ```bash
   # Test de performance con diferentes periodos
   time curl -X GET "https://staging.example.com/api/treasury/exchange-rates/daily?rateType=buy&days=7" \
     -H "Authorization: Bearer $TOKEN"
   ```

### Checklist de Validación

- [ ] Endpoints funcionan sin parámetros nuevos (comportamiento actual)
- [ ] Endpoints funcionan con parámetros nuevos
- [ ] Formato de respuesta compatible
- [ ] Performance no degradada
- [ ] Tests de regresión pasando

### Deploy a Producción

```bash
# Merge a main
git checkout main
git merge feature/exchange-rate-history-improvements
git push origin main
```

### Validación Post-Deploy

- [ ] Endpoints modificados funcionan correctamente
- [ ] Compatibilidad hacia atrás validada
- [ ] Monitoreo sin errores
- [ ] Performance aceptable

---

## 📦 FASE 3: FRONTEND - COMPONENTES CON FEATURE FLAG

### Objetivo

Desplegar nuevos componentes con feature flag desactivado.

### Tareas

1. **Configurar Feature Flag**
   ```env
   # .env.staging
   FEATURE_NEW_EXCHANGE_RATE_HISTORY=false
   FEATURE_ENHANCED_EXCHANGE_RATE_FILTERS=false
   ```

2. **Deploy en Staging**
   ```bash
   git checkout feature/exchange-rate-history-improvements
   git pull origin feature/exchange-rate-history-improvements
   
   # Deploy a staging
   npm run build
   npm run deploy:staging
   ```

3. **Validar Feature Flag Desactivado**
   - Acceder a staging
   - Verificar que componente viejo se renderiza
   - Validar que funcionalidad existente funciona

4. **Activar Feature Flag en Staging para Testing**
   ```env
   # .env.staging
   FEATURE_NEW_EXCHANGE_RATE_HISTORY=true
   FEATURE_ENHANCED_EXCHANGE_RATE_FILTERS=true
   ```
   - Re-deploy o restart servicio
   - Validar que componente nuevo se renderiza
   - Testing completo de nueva funcionalidad

### Checklist de Validación

- [ ] Componente viejo funciona con flag desactivado
- [ ] Componente nuevo funciona con flag activado
- [ ] Feature flag funciona correctamente
- [ ] No hay errores en consola
- [ ] Performance aceptable

### Deploy a Producción

```bash
# Merge a main
git checkout main
git merge feature/exchange-rate-history-improvements
git push origin main
```

**Importante:** Deploy con feature flag desactivado en producción.

### Validación Post-Deploy

- [ ] Feature flag desactivado en producción
- [ ] Componente viejo funciona correctamente
- [ ] No hay errores en logs
- [ ] Monitoreo sin problemas

---

## 📦 FASE 4: FRONTEND - INTEGRACIÓN

### Objetivo

Integrar nuevos componentes y funcionalidad completa.

### Tareas

1. **Deploy en Staging con Flag Activado**
   ```env
   # .env.staging
   FEATURE_NEW_EXCHANGE_RATE_HISTORY=true
   FEATURE_ENHANCED_EXCHANGE_RATE_FILTERS=true
   ```

2. **Testing Completo en Staging**
   - Testing de filtros (periodo, fuentes)
   - Testing de métricas y estadísticas
   - Testing de gráficas
   - Testing de performance
   - Testing de UX

3. **Feedback de Usuarios Beta**
   - Acceso para usuarios beta en staging
   - Recopilar feedback
   - Ajustar según feedback

### Checklist de Validación

- [ ] Filtros funcionan correctamente
- [ ] Métricas se calculan correctamente
- [ ] Gráficas se actualizan correctamente
- [ ] Performance aceptable
- [ ] UX validada
- [ ] Feedback positivo de usuarios beta

### Deploy a Producción

```bash
# Merge a main
git checkout main
git merge feature/exchange-rate-history-improvements
git push origin main
```

**Importante:** Deploy con feature flag desactivado en producción.

### Validación Post-Deploy

- [ ] Feature flag desactivado en producción
- [ ] Componente viejo funciona correctamente
- [ ] Código nuevo listo para activación

---

## 📦 FASE 5: ROLLOUT GRADUAL

### Objetivo

Activar gradualmente para usuarios en producción.

### Estrategia de Rollout

#### Paso 1: Rollout 10% (1 semana)

```typescript
// server/routes.ts
function shouldEnableFeature(userId: number, email: string, feature: string): boolean {
  // Activar para 10% de usuarios
  const rolloutPercentage = 10;
  const hash = (userId + feature).split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return Math.abs(hash) % 100 < rolloutPercentage;
}
```

**Monitoreo:**
- Errores en Sentry
- Performance (tiempos de respuesta)
- Feedback de usuarios

**Checklist:**
- [ ] 10% de usuarios con nueva funcionalidad
- [ ] Sin errores críticos
- [ ] Performance aceptable
- [ ] Feedback positivo

#### Paso 2: Rollout 50% (1 semana)

```typescript
const rolloutPercentage = 50; // 50%
```

**Monitoreo:**
- Errores en Sentry
- Performance
- Feedback de usuarios

**Checklist:**
- [ ] 50% de usuarios con nueva funcionalidad
- [ ] Sin errores críticos
- [ ] Performance estable
- [ ] Feedback positivo

#### Paso 3: Rollout 100% (1 semana)

```typescript
const rolloutPercentage = 100; // 100%
```

**Monitoreo:**
- Errores en Sentry
- Performance
- Adopción de funcionalidad

**Checklist:**
- [ ] 100% de usuarios con nueva funcionalidad
- [ ] Sin errores críticos
- [ ] Performance estable
- [ ] Adopción exitosa

#### Paso 4: Cleanup (1 semana después)

**Tareas:**
- Remover código legacy (componente viejo)
- Remover feature flags
- Actualizar documentación
- Comunicar cambios finales

**Checklist:**
- [ ] Código legacy removido
- [ ] Feature flags removidos
- [ ] Documentación actualizada
- [ ] Changelog finalizado

---

## 🔙 ROLLBACK PROCEDURES

### Rollback por Fase

#### Fase 1-2: Backend

**Tiempo estimado:** 5-10 minutos

```bash
# Opción 1: Revertir commit
git revert HEAD
git push origin main

# Opción 2: Rollback de deploy (según plataforma)
# Railway: Revertir a commit anterior
# Render: Revertir a deploy anterior
```

#### Fase 3-4: Frontend (Feature Flag)

**Tiempo estimado:** 1-2 minutos

```env
# Desactivar feature flag
FEATURE_NEW_EXCHANGE_RATE_HISTORY=false
FEATURE_ENHANCED_EXCHANGE_RATE_FILTERS=false
```

**Re-deploy o restart servicio**

#### Fase 5: Rollout Gradual

**Tiempo estimado:** 2-5 minutos

```typescript
// Reducir porcentaje de rollout
const rolloutPercentage = 0; // 0% = desactivado
```

**O desactivar completamente:**

```env
FEATURE_NEW_EXCHANGE_RATE_HISTORY=false
```

### Procedimiento de Rollback

1. **Identificar Problema**
   - Monitorear errores en Sentry
   - Validar reportes de usuarios
   - Confirmar impacto

2. **Decidir Rollback**
   - Evaluar severidad
   - Determinar si es crítico
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

## ✅ VALIDACIÓN POST-DEPLOY

### Checklist por Fase

#### Fase 1-2: Backend

- [ ] Endpoints nuevos accesibles
- [ ] Endpoints existentes funcionan
- [ ] Performance aceptable
- [ ] Sin errores en logs
- [ ] Monitoreo sin alertas

#### Fase 3-4: Frontend

- [ ] Feature flag funciona
- [ ] Componente viejo funciona (flag desactivado)
- [ ] Componente nuevo funciona (flag activado en staging)
- [ ] Sin errores en consola
- [ ] Performance aceptable

#### Fase 5: Rollout Gradual

- [ ] Rollout 10% sin problemas
- [ ] Rollout 50% sin problemas
- [ ] Rollout 100% sin problemas
- [ ] Monitoreo activo
- [ ] Feedback positivo

### Monitoreo Continuo

- **Errores:** Sentry / Logs
- **Performance:** Tiempos de respuesta API
- **Uso:** Analytics de funcionalidad
- **Feedback:** Encuestas / Reportes de usuarios

---

## 📊 MÉTRICAS DE ÉXITO

### KPIs de Despliegue

- **Tasa de Error:** < 0.1%
- **Tiempo de Respuesta:** < 2s (95th percentile)
- **Adopción:** > 50% de usuarios activos
- **Satisfacción:** > 4/5 en feedback

### Alertas

- **Errores:** > 10 errores/minuto
- **Performance:** > 5s tiempo de respuesta
- **Rollback:** Si tasa de error > 1%

---

**Documento creado por:** Sistema de Auditoría  
**Última actualización:** 2025-11-05


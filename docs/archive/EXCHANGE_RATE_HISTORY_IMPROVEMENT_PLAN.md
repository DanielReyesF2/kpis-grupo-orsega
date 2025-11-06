# 📊 PLAN DE MEJORA: Módulo de Histórico de Tipos de Cambio

**Fecha de Análisis:** 2025-11-05  
**Estado:** ✅ **APROBADO PARA IMPLEMENTACIÓN**  
**Componente:** `ExchangeRateHistory.tsx`  
**Condiciones de Mitigación:** Aprobadas y documentadas

---

## ⚠️ CONDICIONES DE MITIGACIÓN APROBADAS

Este plan ha sido aprobado bajo las siguientes condiciones de mitigación:

1. ✅ **Análisis de Impacto Previo** - Identificar dependencias y asegurar que otros módulos no se vean afectados
2. ✅ **Desarrollo en Staging/Feature-Flags** - Validar cambios sin comprometer producción
3. ✅ **Compatibilidad hacia Atrás** - Mantener versiones antiguas de endpoints durante transición
4. ✅ **Pruebas Exhaustivas** - Unitarias, integración y regresión para nuevo módulo y funcionalidades existentes
5. ✅ **Despliegue Incremental** - Fase por fase (backend → filtros → visualización) con validación en cada etapa
6. ✅ **Documentación Completa** - Documentar cambios y comunicar al equipo nuevos endpoints, filtros y componentes

**Ver documentos adicionales:**
- `EXCHANGE_RATE_IMPACT_ANALYSIS.md` - Análisis de impacto y dependencias
- `EXCHANGE_RATE_IMPLEMENTATION_STRATEGY.md` - Estrategia de implementación y feature flags
- `EXCHANGE_RATE_TESTING_PLAN.md` - Plan de pruebas exhaustivas
- `EXCHANGE_RATE_DEPLOYMENT_GUIDE.md` - Guía de despliegue incremental
- `EXCHANGE_RATE_CHANGELOG.md` - Documentación de cambios y comunicación

---

## 📋 TABLA DE CONTENIDOS

1. [Análisis del Estado Actual](#análisis-del-estado-actual)
2. [Requisitos de Mejora](#requisitos-de-mejora)
3. [Plan de Implementación por Fases](#plan-de-implementación-por-fases)
4. [Tareas Concretas](#tareas-concretas)
5. [Consideraciones Técnicas](#consideraciones-técnicas)

---

## 🔍 ANÁLISIS DEL ESTADO ACTUAL

### Estado Actual del Componente

**Archivo:** `client/src/components/treasury/ExchangeRateHistory.tsx`

#### Funcionalidades Existentes ✅

1. **Vista Diaria (24 horas)**
   - Muestra datos de las últimas 24 horas
   - Agrupa por hora (HH:mm)
   - Gráfica de líneas con múltiples fuentes

2. **Vista Mensual**
   - Permite seleccionar mes/año (últimos 12 meses)
   - Promedio diario por fuente
   - Gráfica de líneas con múltiples fuentes

3. **Filtros Disponibles**
   - Tipo de cambio: Compra (`buy`) / Venta (`sell`)
   - Selector de mes/año (solo para vista mensual)

4. **Fuentes de Datos**
   - **Santander** (verde #16a34a)
   - **MONEX** (azul #2563eb)
   - **DOF** (naranja #ea580c)

5. **Visualizaciones**
   - Gráficas de líneas con Recharts
   - Tooltips personalizados con variaciones porcentuales
   - Leyenda interactiva
   - Estados de carga y error

#### Endpoints Backend Existentes ✅

1. **`GET /api/treasury/exchange-rates/daily`**
   - Parámetros: `rateType` (buy/sell)
   - Retorna: Últimas 24 horas agrupadas por hora
   - Formato: `{ hour: string, timestamp: string, santander?: number, monex?: number, dof?: number }[]`

2. **`GET /api/treasury/exchange-rates/monthly`**
   - Parámetros: `year`, `month`, `rateType`
   - Retorna: Promedios diarios del mes seleccionado
   - Formato: `{ day: number, date: string, santander?: number, monex?: number, dof?: number }[]`

#### Estructura de Datos (Schema) ✅

**Tabla:** `exchange_rates`
```typescript
{
  id: number;
  date: Date;
  buyRate: number;    // Tipo de cambio compra
  sellRate: number;   // Tipo de cambio venta
  source: string;     // 'MONEX' | 'Santander' | 'DOF'
  notes?: string;
  createdBy: number;
  createdAt: Date;
}
```

#### Limitaciones Actuales ⚠️

1. **Periodos Fijos:**
   - Solo 24 horas (diario)
   - Solo 1 mes (mensual)
   - No hay opciones de 1 semana, 3 meses, 6 meses, 1 año

2. **Fuentes Fijas:**
   - No hay filtro para seleccionar/deseleccionar fuentes
   - Siempre muestra todas las fuentes disponibles

3. **Métricas Limitadas:**
   - Solo muestra valores en el gráfico
   - No hay estadísticas (promedio, máximo, mínimo, volatilidad)
   - No hay cálculo de spread entre fuentes
   - Tendencia solo en tooltip (variación porcentual)

4. **Agregación Fija:**
   - Diario: agrupación por hora (sin opción de diario)
   - Mensual: promedio diario (sin opción de agregación mensual)

5. **Sin Comparación de Periodos:**
   - No se puede comparar periodos diferentes
   - No hay vista de tendencias a largo plazo

---

## 🎯 REQUISITOS DE MEJORA

### Fase 1: Preparación de Requisitos

#### 1.1 Fuentes de Datos a Comparar

**Fuentes Disponibles:**
- ✅ **MONEX** (actualmente disponible)
- ✅ **Santander** (actualmente disponible)
- ✅ **Banco de México / DOF** (actualmente disponible)

**Estado:** ✅ **COMPLETO** - Las tres fuentes están disponibles en el backend y frontend.

#### 1.2 Periodos de Análisis

**Periodos Requeridos:**
- [ ] **1 semana** (7 días)
- [x] **1 mes** (30 días) - ✅ Ya existe
- [ ] **3 meses** (90 días)
- [ ] **6 meses** (180 días)
- [ ] **1 año** (365 días)

**Estado Actual:**
- ✅ 24 horas (diario) - existe
- ✅ 1 mes - existe
- ❌ 1 semana, 3 meses, 6 meses, 1 año - **NO EXISTEN**

#### 1.3 Métricas Clave a Mostrar

**Métricas Requeridas:**
- [ ] **Promedio del tipo de cambio** (por periodo)
- [ ] **Máximo** (valor más alto en el periodo)
- [ ] **Mínimo** (valor más bajo en el periodo)
- [ ] **Volatilidad** (desviación estándar o rango)
- [ ] **Spread entre fuentes** (diferencia entre máx y mín de todas las fuentes)
- [ ] **Tendencia** (sube/baja/estable) - ⚠️ Parcialmente implementado en tooltip

**Estado Actual:**
- ❌ Estadísticas no calculadas ni mostradas
- ⚠️ Tendencia solo en tooltip (variación porcentual)

#### 1.4 Filtros de Usuario

**Filtros Requeridos:**

1. **Tipo de cambio** ✅
   - [x] "Compra" vs "Venta" - ✅ Ya existe

2. **Fuente(s) seleccionadas** ❌
   - [ ] Selección múltiple de fuentes (MONEX, Santander, DOF)
   - [ ] Checkboxes o toggles para activar/desactivar cada fuente

3. **Período de análisis** ⚠️
   - [x] Mes/año (solo mensual) - ✅ Ya existe
   - [ ] Selector de periodo (1 semana, 1 mes, 3 meses, 6 meses, 1 año)
   - [ ] Selector de rango de fechas personalizado (opcional)

4. **Intervalo de agregación** ❌
   - [ ] Diario/Hora (para periodos cortos)
   - [ ] Mensual (para periodos largos)
   - [ ] Automático según el periodo seleccionado

**Estado Actual:**
- ✅ Tipo de cambio: Implementado
- ❌ Selección de fuentes: No implementado
- ⚠️ Periodos: Solo 24h y 1 mes
- ❌ Intervalo de agregación: No configurable

#### 1.5 Preparación de Datos Backend

**Endpoints Actuales:**
- ✅ `/api/treasury/exchange-rates/daily` - 24 horas
- ✅ `/api/treasury/exchange-rates/monthly` - 1 mes

**Endpoints Necesarios:**
- [ ] `/api/treasury/exchange-rates/range` - Rango de fechas personalizado
- [ ] `/api/treasury/exchange-rates/stats` - Estadísticas del periodo
- [ ] Modificar endpoints existentes para soportar múltiples periodos

**Consideraciones de Performance:**
- [ ] Índices en base de datos para consultas por fecha
- [ ] Paginación para periodos largos (1 año)
- [ ] Caché de consultas frecuentes
- [ ] Agregación eficiente en backend

---

## 📋 PLAN DE IMPLEMENTACIÓN POR FASES

### FASE 1: Preparación de Requisitos ✅

**Estado:** 🔄 **EN PROGRESO** (Análisis completado)

#### Tareas de Fase 1:

- [x] **T1.1** - Auditar estado actual del componente
- [x] **T1.2** - Documentar fuentes disponibles
- [x] **T1.3** - Identificar periodos actuales vs requeridos
- [x] **T1.4** - Listar métricas requeridas
- [x] **T1.5** - Documentar filtros actuales vs requeridos
- [x] **T1.6** - Analizar endpoints backend existentes
- [ ] **T1.7** - Validar disponibilidad de datos históricos en BD
- [ ] **T1.8** - Crear mockups/wireframes de la nueva UI

---

### FASE 2: Backend - Nuevos Endpoints

**Prioridad:** 🔴 Alta  
**Dependencias:** Fase 1 completada

#### Tareas de Fase 2:

- [ ] **T2.1** - Crear endpoint `/api/treasury/exchange-rates/range`
  - Parámetros: `startDate`, `endDate`, `rateType`, `sources[]`
  - Retorna: Datos agrupados según intervalo (hora/día/mes)
  - Validaciones: Rango máximo de 1 año, fechas válidas

- [ ] **T2.2** - Crear endpoint `/api/treasury/exchange-rates/stats`
  - Parámetros: `startDate`, `endDate`, `rateType`, `sources[]`
  - Retorna: `{ source: string, average: number, max: number, min: number, volatility: number, trend: 'up'|'down'|'stable' }[]`
  - Cálculo de volatilidad (desviación estándar)

- [ ] **T2.3** - Modificar endpoint `/api/treasury/exchange-rates/daily`
  - Agregar parámetro opcional `days` (default: 1, máximo: 7)
  - Permitir filtrado por fuentes específicas

- [ ] **T2.4** - Modificar endpoint `/api/treasury/exchange-rates/monthly`
  - Agregar parámetro opcional `months` (default: 1, máximo: 12)
  - Permitir filtrado por fuentes específicas

- [ ] **T2.5** - Optimizar consultas SQL
  - Agregar índices en columna `date` y `source`
  - Implementar agregación eficiente en BD
  - Agregar paginación para periodos largos

- [ ] **T2.6** - Agregar caché de consultas
  - Cachear estadísticas por periodo (TTL: 5 minutos)
  - Cachear rangos de fechas frecuentes

- [ ] **T2.7** - Testing de endpoints
  - Tests unitarios para nuevos endpoints
  - Tests de performance con datos reales
  - Validar límites y casos edge

---

### FASE 3: Frontend - Componentes de Filtros

**Prioridad:** 🔴 Alta  
**Dependencias:** Fase 2 completada

#### Tareas de Fase 3:

- [ ] **T3.1** - Crear componente `PeriodSelector`
  - Opciones: 1 semana, 1 mes, 3 meses, 6 meses, 1 año
  - Selector de rango de fechas personalizado (opcional)
  - Estado: `selectedPeriod: '1w' | '1m' | '3m' | '6m' | '1y' | 'custom'`

- [ ] **T3.2** - Crear componente `SourceFilter`
  - Checkboxes para cada fuente (MONEX, Santander, DOF)
  - Estado: `selectedSources: string[]`
  - Permite selección múltiple
  - Visualización con colores de cada fuente

- [ ] **T3.3** - Crear componente `AggregationSelector`
  - Opciones: Automático, Por Hora, Por Día, Por Mes
  - Estado: `aggregation: 'auto' | 'hour' | 'day' | 'month'`
  - Lógica automática según periodo seleccionado

- [ ] **T3.4** - Integrar filtros en `ExchangeRateHistory`
  - Agregar `PeriodSelector` antes del gráfico
  - Agregar `SourceFilter` junto al selector de tipo de cambio
  - Agregar `AggregationSelector` (opcional, puede ser automático)

- [ ] **T3.5** - Actualizar queries React Query
  - Modificar `queryKey` para incluir nuevos filtros
  - Actualizar `queryFn` para usar nuevos endpoints
  - Manejar invalidación de cache cuando cambian filtros

---

### FASE 4: Frontend - Métricas y Estadísticas

**Prioridad:** 🟡 Media  
**Dependencias:** Fase 3 completada

#### Tareas de Fase 4:

- [ ] **T4.1** - Crear componente `ExchangeRateStats`
  - Cards con métricas: Promedio, Máximo, Mínimo, Volatilidad
  - Una card por fuente seleccionada
  - Diseño responsive (grid)

- [ ] **T4.2** - Crear componente `SpreadIndicator`
  - Muestra diferencia entre fuente con mayor y menor valor
  - Indicador visual (barra o badge)
  - Color según magnitud del spread

- [ ] **T4.3** - Crear componente `TrendIndicator`
  - Badge con tendencia: "Alza", "Baja", "Estable"
  - Ícono y color según tendencia
  - Cálculo basado en comparación inicio vs fin del periodo

- [ ] **T4.4** - Integrar componentes de métricas
  - Agregar `ExchangeRateStats` antes del gráfico
  - Agregar `SpreadIndicator` en header o junto a stats
  - Agregar `TrendIndicator` en cada card de fuente

- [ ] **T4.5** - Agregar tooltip mejorado en gráfica
  - Mostrar todas las métricas en tooltip
  - Incluir información de spread y tendencia
  - Formato mejorado y más informativo

---

### FASE 5: Frontend - Visualizaciones Mejoradas

**Prioridad:** 🟡 Media  
**Dependencias:** Fase 4 completada

#### Tareas de Fase 5:

- [ ] **T5.1** - Mejorar gráfica de líneas
  - Agregar área sombreada para mostrar rango (mín-máx)
  - Líneas de referencia para promedio
  - Líneas de referencia para máximos y mínimos históricos

- [ ] **T5.2** - Agregar gráfica de barras para spreads
  - Gráfica adicional mostrando spread entre fuentes por periodo
  - Stacked bars o grouped bars
  - Colores diferenciados por fuente

- [ ] **T5.3** - Agregar gráfica de volatilidad
  - Gráfica de área o barras mostrando volatilidad a lo largo del tiempo
  - Indicador de periodos de alta/baja volatilidad

- [ ] **T5.4** - Mejorar responsividad
  - Ajustar gráficas para móviles
  - Tooltips adaptativos
  - Grid de métricas responsive

- [ ] **T5.5** - Agregar modo de comparación
  - Vista side-by-side para comparar periodos diferentes
  - Overlay de periodos anteriores
  - Toggle para activar/desactivar comparación

---

### FASE 6: Testing y Optimización

**Prioridad:** 🟢 Baja  
**Dependencias:** Fase 5 completada

#### Tareas de Fase 6:

- [ ] **T6.1** - Testing unitario de componentes
  - Tests para `PeriodSelector`, `SourceFilter`, `AggregationSelector`
  - Tests para componentes de métricas
  - Tests para cálculos de estadísticas

- [ ] **T6.2** - Testing de integración
  - Flujo completo: selección de filtros → carga de datos → visualización
  - Validación de queries React Query
  - Validación de actualización de cache

- [ ] **T6.3** - Testing de performance
  - Carga de datos con periodos largos (1 año)
  - Renderizado de gráficas con muchos datos
  - Optimización de re-renders

- [ ] **T6.4** - Testing de UX
  - Usabilidad de filtros
  - Claridad de visualizaciones
  - Accesibilidad (a11y)

- [ ] **T6.5** - Optimización final
  - Code splitting para componentes pesados
  - Lazy loading de gráficas
  - Memoización de cálculos costosos

---

## ✅ TAREAS CONCRETAS

### Resumen de Tareas por Prioridad

#### 🔴 Prioridad Alta (Crítico para MVP)

1. **Backend:**
   - T2.1 - Endpoint `/api/treasury/exchange-rates/range`
   - T2.2 - Endpoint `/api/treasury/exchange-rates/stats`
   - T2.3 - Modificar endpoint `/daily` para soportar múltiples días

2. **Frontend:**
   - T3.1 - Componente `PeriodSelector`
   - T3.2 - Componente `SourceFilter`
   - T3.4 - Integración de filtros en componente principal
   - T3.5 - Actualización de queries React Query

#### 🟡 Prioridad Media (Importante para funcionalidad completa)

1. **Frontend:**
   - T4.1 - Componente `ExchangeRateStats`
   - T4.3 - Componente `TrendIndicator`
   - T5.1 - Mejoras en gráfica de líneas
   - T2.5 - Optimización de consultas SQL

#### 🟢 Prioridad Baja (Mejoras y optimizaciones)

1. **Frontend:**
   - T5.2 - Gráfica de spreads
   - T5.3 - Gráfica de volatilidad
   - T5.5 - Modo de comparación
   - T6.1-6.5 - Testing y optimización

---

## 🔧 CONSIDERACIONES TÉCNICAS

### Backend

1. **Performance:**
   - Consultas de 1 año pueden ser pesadas → implementar paginación
   - Agregación en BD vs en memoria → preferir BD para eficiencia
   - Índices necesarios: `date`, `source`, `(date, source)`

2. **Escalabilidad:**
   - Caché de consultas frecuentes (Redis recomendado)
   - Rate limiting en endpoints nuevos
   - Considerar materialized views para periodos largos

3. **Validaciones:**
   - Validar rango máximo de fechas (ej: máximo 1 año)
   - Validar formatos de fecha
   - Validar fuentes permitidas

### Frontend

1. **Estado:**
   - Usar React Query para gestión de estado de datos
   - Estado local para filtros (useState)
   - Memoización de cálculos costosos (useMemo)

2. **Performance:**
   - Virtualización para gráficas con muchos puntos
   - Lazy loading de componentes pesados
   - Debounce en filtros que trigger queries

3. **UX:**
   - Loading states claros
   - Error handling robusto
   - Mensajes informativos cuando no hay datos

4. **Accesibilidad:**
   - Labels apropiados en filtros
   - ARIA labels en gráficas
   - Navegación por teclado

---

## 📊 ESTIMACIÓN DE ESFUERZO

### Por Fase

- **Fase 1:** ✅ Completada (análisis)
- **Fase 2 (Backend):** 3-5 días
- **Fase 3 (Frontend - Filtros):** 2-3 días
- **Fase 4 (Frontend - Métricas):** 2-3 días
- **Fase 5 (Frontend - Visualizaciones):** 3-4 días
- **Fase 6 (Testing):** 2-3 días

**Total Estimado:** 12-18 días de desarrollo

### MVP (Fases 1-3)

**Tiempo estimado:** 5-8 días

Incluye:
- Nuevos endpoints backend
- Filtros de periodo y fuentes
- Visualización básica mejorada

---

## 🎯 PRÓXIMOS PASOS

1. **Revisar y aprobar este plan** con el equipo
2. **Priorizar fases** según necesidades del negocio
3. **Asignar recursos** (backend vs frontend)
4. **Iniciar Fase 2** (Backend) mientras se valida diseño de Fase 3
5. **Crear tickets** en sistema de gestión de proyectos

---

## 📝 NOTAS ADICIONALES

- Este plan asume que los datos históricos están disponibles en la BD
- Si faltan datos históricos, agregar fase de migración/importación
- Considerar feedback de usuarios durante desarrollo
- Mantener retrocompatibilidad con funcionalidad existente

---

**Documento creado por:** Sistema de Auditoría  
**Última actualización:** 2025-11-05


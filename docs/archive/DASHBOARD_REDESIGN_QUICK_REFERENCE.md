# Referencia Rápida - Rediseño Dashboard Sección Bienvenida

## 📍 Ubicación de Componentes en Dashboard.tsx

```
Dashboard.tsx (líneas 216-365)
│
├── [216] <div className="relative mb-6..."> {/* Sección de Bienvenida */}
│   │
│   ├── [218] <h2>Hola {user?.name}...</h2>
│   │
│   ├── [223] <div className="grid..."> {/* Grid Dura/Orsega */}
│   │   │
│   │   ├── [224] <div> {/* Columna Dura */}
│   │   │   ├── [226] Logo Dura
│   │   │   ├── [243] <SalesMetricsCards companyId={1} />
│   │   │   │
│   │   │   ├── 🔵 [245-253] 🔵 INTEGRACIÓN PUNTO 1
│   │   │   │   <DualProgressBar companyId={1} />
│   │   │   │
│   │   │   └── [255] Botón "Ventas mensuales"
│   │   │
│   │   └── [259] <div> {/* Columna Orsega */}
│   │       ├── [261] Logo Orsega
│   │       ├── [288] <SalesMetricsCards companyId={2} />
│   │       │
│   │       ├── 🔵 [290-298] 🔵 INTEGRACIÓN PUNTO 2
│   │       │   <DualProgressBar companyId={2} />
│   │       │
│   │       └── [300] Botón "Ventas mensuales"
│   │
│   ├── 🔵 [316-326] 🔵 INTEGRACIÓN PUNTO 3
│   │   <MonthlyPerformanceSummary companyId={selectedChartCompany} />
│   │
│   ├── [328] <div className="mt-6"> {/* Gráfico de Ventas */}
│   │   └── [329] <SalesVolumeChart />
│   │
│   └── 🔵 [352-365] 🔵 INTEGRACIÓN PUNTO 4
│       <SmartInsights companyId={selectedChartCompany} />
│
└── [367] </div> {/* Fin sección bienvenida */}
```

## 🎯 Componentes a Crear

### 1. DualProgressBar.tsx
**Ubicación:** `client/src/components/dashboard/DualProgressBar.tsx`

**Props:**
```typescript
interface DualProgressBarProps {
  companyId: number;
  currentValue: number;
  targetValue: number;
  previousValue?: number;
  label?: string;
  unit?: string;
  showGrowth?: boolean;
}
```

**Datos:** Reutilizar de `SalesMetricsCards`
- `totalSales` → `currentValue`
- `totalTarget` → `targetValue`
- `growthRate` → `previousValue` (opcional)

---

### 2. MonthlyPerformanceSummary.tsx
**Ubicación:** `client/src/components/dashboard/MonthlyPerformanceSummary.tsx`

**Props:**
```typescript
interface MonthlyPerformanceSummaryProps {
  companyId: number;
  year?: number;
  showComparison?: boolean;
}
```

**Datos:** Nuevo query
- Endpoint: `/api/kpi-history/${kpiId}?months=12&companyId=${companyId}`
- Similar a `SalesMetricsCards` pero con desglose mensual

---

### 3. SmartInsights.tsx
**Ubicación:** `client/src/components/dashboard/SmartInsights.tsx`

**Props:**
```typescript
interface SmartInsightsProps {
  companyId: number;
  insights?: Insight[];
}
```

**Datos:** Múltiples fuentes
- `useQuery(['/api/kpis'])` → KPIs
- `SalesMetricsCards` → Ventas YTD
- KPI History → Tendencias

---

## 📦 Dependencias Requeridas

### Ya Importadas (✅)
- `Card`, `CardContent`, `CardHeader`, `CardTitle`
- `Badge`
- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
- Iconos: `ArrowUp`, `TrendingUp`, `TrendingDown`, `Target`, `Award`

### Nuevas Importaciones (⚠️)
- `Progress` de `@/components/ui/progress`
- `Lightbulb`, `AlertCircle` de `lucide-react`
- `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer` de `recharts` (si se usa)

---

## 🔄 Plan de Commits

### Commit 1: UI Base
```
feat(dashboard): add UI components for welcome section redesign
```
**Archivos:**
- `DualProgressBar.tsx` (nuevo)
- `MonthlyPerformanceSummary.tsx` (nuevo)
- `SmartInsights.tsx` (nuevo)
- `Dashboard.tsx` (solo comentarios)

---

### Commit 2: Integración de Datos
```
feat(dashboard): integrate real data into welcome section components
```
**Archivos:**
- `DualProgressBar.tsx` (con datos)
- `MonthlyPerformanceSummary.tsx` (con datos)
- `SmartInsights.tsx` (con datos)
- `Dashboard.tsx` (componentes descomentados)

---

### Commit 3: Algoritmo de Insights
```
feat(dashboard): implement smart insights algorithm
```
**Archivos:**
- `SmartInsights.tsx` (lógica completa)

---

## ⚠️ Puntos de Atención

1. **Performance:** Reutilizar queries existentes cuando sea posible
2. **Consistencia:** Centralizar lógica de cálculo en hooks compartidos
3. **Responsive:** Mantener patrones responsive existentes
4. **Compatibilidad:** No modificar rutas ni navegación

---

## 📝 Checklist de Verificación

Antes de implementar:
- [ ] Revisar `DASHBOARD_REDESIGN_ANALYSIS.md` completo
- [ ] Confirmar diseño visual del plan de rediseño
- [ ] Preparar datos mock para Fase 1

Durante implementación:
- [ ] Seguir estructura de commits propuesta
- [ ] Verificar que no se rompen funcionalidades existentes
- [ ] Testing en cada fase

Después de implementación:
- [ ] Testing de regresión completo
- [ ] Validación visual con diseño
- [ ] Documentación actualizada

---

**Última actualización:** 2025-01-XX


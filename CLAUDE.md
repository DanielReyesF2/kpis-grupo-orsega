# CLAUDE.md — KPIS DIGO (Grupo Orsega / Dura International)

> P0 PRODUCTION — Contrato activo, renovación anual ESR. Reglas globales en `~/.claude/CLAUDE.md`. Stack JS en `~/.claude/STACK.md`.

## Commands

```bash
npm run dev              # Express + Vite HMR dev server
npm run build            # Production build (Vite frontend + esbuild backend → dist/)
npm run build:clean      # Clear cache + rebuild (use when build fails locally)
npm run check            # TypeScript typecheck (tsc --noEmit)
npm run db:push          # Push schema changes to DB (drizzle-kit push)
npx vitest run           # Run unit tests
npx vitest run shared/__tests__  # KPI calculation tests only
```

IMPORTANT: Always run `npm run check` after changes across multiple files.

## Architecture

```
client/ (React + Vite)  →  server/ (Express)  →  Neon PostgreSQL
     ↑                         ↑
     └── shadcn/ui + Tremor    └── Drizzle ORM + Zod
```

- Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui + Tremor (charts)
- Backend: Node.js + Express
- Routing: Wouter (NOT React Router — never import from react-router-dom)
- State: TanStack React Query (never useState for server data)
- API calls: always `apiRequest()` from `client/src/lib/queryClient.ts`

## Key Files (Sizes Matter)

| File | Size | What it does |
|------|------|-------------|
| `shared/schema.ts` | **~57K lines** | Single source of truth — Drizzle schemas + Zod validators. Run `db:push` after changes |
| `server/DatabaseStorage.ts` | **~85K lines** | Monolithic DB abstraction. Read relevant section before editing |
| `server/routes.ts` | **~10K lines** | Main API routes (monolithic). Read relevant section first |
| `server/routes/sales-analytics.ts` | **~78K lines** | Sales analytics endpoints |
| `server/routes/kpi-values.ts` | **~44K lines** | KPI values endpoints |
| `shared/kpi-utils.ts` | — | Centralized KPI calculations. NEVER reimplement elsewhere |
| `server/sales-kpi-calculator.ts` | — | Dynamic KPI recalculation from sales_data |
| `server/index.ts` | — | Server entry point, Sentry init, boot diagnostics |
| `client/src/App.tsx` | — | Main router (Wouter, lazy-loaded pages) |
| `drizzle.config.ts` | — | Drizzle migration config |

## Critical Business Logic

### KPI System (break this = broken executive dashboard)
- Two companies: **Dura International** (`company_id=1`), **Grupo Orsega** (`company_id=2`). Hardcoded everywhere.
- Separate tables per company: `kpis_dura`/`kpi_values_dura` vs `kpis_orsega`/`kpi_values_orsega`. Always use correct table.
- Status thresholds: `complies` (≥100%), `alert` (≥90%), `not_compliant` (<90%)
- **"Lower is better" KPIs** detected by keywords: cobro, costos, tiempo, plazo, devoluciones, quejas, rechazos, rotación, merma, desperdicio, retraso, demora, gasto, churn, cancelacion, cartera vencida, descuento. Formula inverts: `(goal / value) * 100`
- When `goal = 0` → handle division-by-zero. Never let compliance become `Infinity` or `NaN`.
- **ALL KPI calculations go through `shared/kpi-utils.ts`**. Do not reimplement.

### Multi-Tenant (P0 — data leak = incident)
- Every company-scoped query MUST filter by `companyId`
- User records include `companyId` and `areaId` — use for row-level filtering
- Roles: `admin`, `viewer`, `executive`. Check role before admin endpoints.

## Code Style

- ES modules (`import`/`export`), `"type": "module"`
- Named exports (default only for page components)
- Drizzle ORM for all DB queries. Raw SQL only in `scripts/` and `migrations/`
- Zod schemas with `max()` on all strings
- Lucide React for icons only
- shadcn/ui components from `client/src/components/ui/`
- Path aliases: `@/*` → `client/src/`, `@shared/*` → `shared/`

## Gotchas

- The 4 monolithic files (schema 57K, DatabaseStorage 85K, routes 10K, sales-analytics 78K) — never edit blindly. Read the relevant section first.
- Frontend data refresh: invalidate → wait 100-200ms → explicit refetch. Set `staleTime: 0, gcTime: 0` for critical data.
- Local Vite build errors don't always reproduce on Railway. Use `npm run build:clean` first.
- Do NOT push to `main` without verifying build passes. Railway auto-deploys.
- Do NOT create new `.md` files in root — 30+ already exist. Use `docs/`.

## What NOT To Do

- Don't reimplement KPI calculation logic — use `shared/kpi-utils.ts`
- Don't query company-scoped data without `companyId` filter
- Don't edit DatabaseStorage.ts or routes.ts without reading the section first
- Don't use raw fetch — use `apiRequest()`
- Don't use useState for server data — use React Query
- Don't use react-router-dom — this project uses Wouter
- Don't skip Zod validation on POST/PATCH routes

## Production

- **URL**: kpisdigo.up.railway.app
- **DB**: Neon PostgreSQL
- **Deploy**: Railway auto-deploy from main
- **Repo**: /Users/danielreyes/kpis-grupo-orsega

# Commands

```bash
npm run dev          # Express + Vite HMR dev server
npm run build        # Production build (Vite frontend + esbuild backend → dist/)
npm run build:clean  # Clear cache + rebuild (use when build fails locally)
npm run check        # TypeScript typecheck (tsc --noEmit)
npm run db:push      # Push schema changes to DB (drizzle-kit push)
npx vitest run       # Run unit tests
npx vitest run shared/__tests__  # Run KPI calculation tests only
```

IMPORTANT: Always run `npm run check` after making changes across multiple files.

# Code Style

- Use ES modules (`import`/`export`). The project is `"type": "module"`.
- Use named exports; use default exports only for page components.
- Routing uses Wouter, NOT React Router. Never import from `react-router-dom`.
- Use `apiRequest()` from `client/src/lib/queryClient.ts` for all API calls. Never use raw `fetch`.
- Use TanStack React Query for server state. Never use `useState` to store data fetched from the API.
- Use Drizzle ORM for all database queries. Never write raw SQL in application code (raw SQL is only for `scripts/` and `migrations/`).
- Use Zod schemas from `shared/schema.ts` for all input validation. Always include `max()` length on strings.
- Use Lucide React for icons. Never import from other icon libraries.
- Use shadcn/ui components from `client/src/components/ui/`. Never build custom primitives that shadcn already provides.
- Path aliases: `@/*` → `client/src/`, `@shared/*` → `shared/`.

# KPI Business Logic

IMPORTANT: This is the most critical domain logic. Getting this wrong breaks the executive dashboard.

- Two companies: Dura International (`company_id=1`), Grupo Orsega (`company_id=2`). These IDs are hardcoded everywhere.
- KPI tables are split per company: `kpis_dura`/`kpi_values_dura` and `kpis_orsega`/`kpi_values_orsega`. Always use the correct table for the company.
- KPI status thresholds: `complies` (>=100%), `alert` (>=90% <100%), `not_compliant` (<90%).
- "Lower is better" KPIs are detected by name keywords: `cobro`, `costos`, `tiempo`, `plazo`, `devoluciones`, `quejas`, `rechazos`, `rotación`, `merma`, `desperdicio`, `retraso`, `demora`, `gasto`, `churn`, `cancelacion`, `cartera vencida`, `descuento`. For these, compliance = `(goal / value) * 100` instead of `(value / goal) * 100`.
- When `goal = 0`, handle division-by-zero explicitly. Never let compliance become `Infinity` or `NaN`.
- All KPI calculation functions live in `shared/kpi-utils.ts`. Use these centralized functions; do not reimplement calculation logic elsewhere.
- Backend recalculates KPIs dynamically from `sales_data` in `server/sales-kpi-calculator.ts`.

# Multi-Tenant

- IMPORTANT: Every database query that touches company-scoped data MUST filter by `companyId`. Missing this leaks data between tenants.
- User records include `companyId` and `areaId` — use these for row-level filtering.
- Roles: `admin`, `viewer`, `executive`. Check role before exposing admin endpoints.

# Gotchas

- `server/routes.ts` is ~10K lines and `server/DatabaseStorage.ts` is ~85K lines. These are monolithic. Be careful with large edits — read the relevant section first.
- `shared/schema.ts` (~41K lines) is the single source of truth for all Drizzle schemas and Zod validators. After modifying it, run `npm run db:push`.
- Frontend data refresh requires aggressive React Query invalidation: invalidate → wait 100-200ms → explicit refetch. Set `staleTime: 0, gcTime: 0` for critical data.
- Local Rollup/Vite build errors don't always reproduce on Railway. Use `npm run build:clean` first.
- Do NOT create new `.md` files in the project root. There are already 30+ documentation files there. Add to existing docs or use `docs/`.
- Do NOT push to `main` without verifying the build passes. Railway auto-deploys from `main`.

# Nova AI 2.0 Integration Spec — kpis-grupo-orsega

> **Purpose**: This document is the interface contract between `kpis-grupo-orsega` (client app) and `econova-ai-system` (Nova AI 2.0). It defines the API contract, database schema, business context, and page contexts that Nova AI must support to replace the local bypass.

---

## 1. API Contract: POST /chat

### Request

```
POST /chat
Content-Type: multipart/form-data | application/json
Authorization: Bearer <service-to-service-key>
X-Tenant-ID: grupo-orsega
Accept: text/event-stream | application/json
```

**JSON body** (when no files):
```json
{
  "message": "string (required, max 4000 chars)",
  "tenant_id": "grupo-orsega",
  "conversation_history": [{"role": "user|assistant", "content": "string"}],
  "page_context": "dashboard|sales|treasury|logistics|invoices|quality|trends-analysis",
  "user_id": "string",
  "company_id": "string (number as string, e.g. '1' or '2')",
  "additional_context": "string (optional, e.g. parsed file data)",
  "stream": false  // when Accept: application/json
}
```

**Multipart form-data** (when files present):
- `message` — string (required)
- `tenant_id` — string
- `conversation_history` — JSON string
- `page_context` — string
- `user_id` — string
- `company_id` — string
- `additional_context` — string
- `files` — File[] (0-5 files, max 10MB each)
  - Allowed MIME types: `application/pdf`, `text/xml`, `image/png`, `image/jpeg`, `image/webp`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`

### SSE Response (when Accept: text/event-stream)

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

Events:

```
event: token
data: {"text": "fragmento de texto"}

event: tool_start
data: {"tool": "query_database"}

event: tool_result
data: {"tool": "query_database", "success": true}

event: done
data: {"answer": "respuesta completa", "toolsUsed": ["query_database"], "source": "nova-ai-2.0"}

event: error
data: {"message": "descripcion del error"}
```

### JSON Response (when Accept: application/json or stream=false)

```json
{
  "answer": "string",
  "toolsUsed": ["string"],
  "source": "nova-ai-2.0"
}
```

### Error Responses

| Code | Meaning |
|------|---------|
| 400 | Validation failed (empty message, invalid files) |
| 401 | Bearer token invalid or missing |
| 429 | Rate limit exceeded |
| 500 | Internal error |

---

## 2. Health Check

```
GET /health
```

Expected response when fully connected:
```json
{
  "status": "ok",
  "checks": {
    "brain": "healthy",
    "database": "healthy"
  }
}
```

---

## 3. Database Schema (Neon PostgreSQL)

Nova AI must connect to the client's Neon database (same DB used by kpis-grupo-orsega). **Never migrate data to Nova — always query the client's DB.**

### companies
- id (PK), name, description, sector, logo, createdAt
- **company_id=1**: DURA International (chemical company, sells in KG, currency USD)
- **company_id=2**: Grupo ORSEGA (general distribution, sells in units, currency MXN)

### users
- id (PK), name, email, password, role (admin/manager/viewer), areaId, companyId, lastLogin, active

### sales_data
- id (PK), company_id (FK), client_name, product_name
- quantity (NUMERIC), unit (KG/UNIDADES/LITROS), unit_price, total_amount
- sale_year, sale_month, sale_date
- **company_id=1**: DURA International (KG, USD)
- **company_id=2**: Grupo ORSEGA (units, MXN)

### exchange_rates
- id (PK), source (DOF/MONEX/Santander), buy_rate, sell_rate, date

### kpis_dura / kpis_orsega
- id (PK), area, kpi_name, description, calculation_method, goal, annual_goal, unit, frequency, source, responsible, period, created_at

### kpi_values_dura / kpi_values_orsega
- id (PK), kpi_id (FK), month, year, value, compliance_percentage, status, comments, updated_by, created_at

### shipments
- id (PK), tracking_code, company_id, customer_id, customer_name, purchase_order
- destination, origin, product, quantity, unit
- departure_date, estimated_delivery_date, actual_delivery_date
- status (pending/in_transit/delayed/delivered/cancelled)
- carrier, distance, carbon_footprint

### shipment_items
- id (PK), shipment_id (FK), product, quantity, unit, description

### shipment_updates
- id (PK), shipment_id (FK), status, location, comments, updated_by, timestamp

### payment_vouchers
- id (PK), company_id, payer_company_id, client_id, client_name
- status (pago_programado/factura_pagada/pendiente_complemento/complemento_recibido/cierre_contable)
- voucher_file_url, invoice_file_url, complement_file_url
- extracted_amount, extracted_date, extracted_bank, extracted_reference, extracted_currency
- ocr_confidence, notes

### scheduled_payments
- id (PK), company_id, supplier_id, supplier_name, amount, currency
- due_date, status, reference, notes, source_type
- approved_at, approved_by, payment_date, paid_at

### invoices
- id (PK), company_id, supplier_name, amount, currency
- issue_date, due_date, status, rfc, uuid

### treasury_accounts
- id (PK), company_id, bank_name, account_number, currency, balance

### treasury_movements
- id (PK), account_id (FK), type (ingreso/egreso), amount, date, reference

### clients
- id (PK), name, email, phone, contact_person, company, address, payment_terms
- company_id, client_code, customer_type, is_active

### suppliers
- id (PK), name, short_name, email, location, company_id, is_active
- requires_rep, rep_frequency

### providers (transport)
- id (UUID PK), name, email, phone, contact_name, rating, is_active, company_id

### products
- id (PK), name, company_id, is_active

### areas
- id (PK), name, description, company_id

### notifications
- id (PK), user_id, title, message, type, from_user_id, to_user_id
- company_id, area_id, priority, read, created_at

---

## 4. Business Context for System Prompt

### Identity
Nova AI is the AI assistant for the KPIs system of **Grupo ORSEGA**. It helps users with data analysis, financial management, invoice processing, logistics, and data-driven decision making.

### Companies
- **DURA International** (company_id=1): Chemical company. Sells in **KG**. Main currency: **USD**. Industrial clients.
- **Grupo ORSEGA** (company_id=2): General distribution. Sells in **units**. Main currency: **MXN**.

### Business Areas & KPIs
- **Ventas (Sales)**: Volume, revenue, product mix, top clients, monthly trends
- **Tesoreria (Treasury)**: Cash flow, bank balances, scheduled payments, exchange rates
- **Logistica (Logistics)**: Active shipments, ETAs, container tracking
- **Calidad (Quality)**: Complaints, returns, satisfaction
- **Compras/Proveedores (Purchasing)**: Pending invoices, payment terms, history

### KPI Calculation Rules
- **Status thresholds**: `complies` (>=100%), `alert` (>=90% <100%), `not_compliant` (<90%)
- **"Lower is better" KPIs** detected by name keywords: `cobro`, `costos`, `tiempo`, `plazo`, `devoluciones`, `quejas`, `rechazos`, `rotacion`, `merma`, `desperdicio`, `retraso`, `demora`, `gasto`, `churn`, `cancelacion`, `cartera vencida`, `descuento`
  - For these: compliance = `(goal / value) * 100` (inverted)
  - For normal KPIs: compliance = `(value / goal) * 100`
- When `goal = 0`, handle division-by-zero explicitly. Never return `Infinity` or `NaN`.

### Format Rules
1. **Currency**: Always use `$1,234.56 MXN` or `$1,234.56 USD`
2. **Dates**: `DD/MM/YYYY` for display, `YYYY-MM-DD` in SQL queries
3. **Percentages**: 1 decimal (e.g. `85.3%`)
4. **Quantities**: DURA in KG with 2 decimals, ORSEGA in whole units
5. **Language**: Always respond in **Spanish**
6. **Tables**: Markdown tables, max 15 rows (summarize if more)

### Multi-Tenant Rule
**CRITICAL: Every database query MUST filter by `company_id`.** Missing this leaks data between tenants.

---

## 5. Page Contexts

The `page_context` field in requests tells Nova AI where the user currently is. This affects the system prompt focus.

### `dashboard`
User is on the main dashboard. Has access to: monthly sales summary, critical KPIs across all areas, current exchange rates, pending alerts. **Focus on**: executive summaries, quick comparisons, alerts.

### `sales`
User is on the sales page. Has access to: sales history by company (DURA and ORSEGA), Excel file uploads, trend charts. **Focus on**: sales analysis, trends, top clients/products, comparisons.
**IMPORTANT**: If the user attaches an Excel file and asks to upload/import sales, use the `process_sales_excel` tool with the file data. This processes the Excel and saves transactions, products, clients, and actions to the database.

### `treasury`
User is on the treasury page. Has access to: cash flow, bank balances, payment vouchers, pending invoices, payment scheduling, bank reconciliation. **Focus on**: cash flow, pending payments, reconciliation, due date alerts.

### `logistics`
User is on the logistics page. Has access to: shipment status, containers, ETAs, carrier tracking, route map. **Focus on**: shipment status, upcoming ETAs, delay alerts.

### `trends-analysis`
User is on the trends analysis page. Has access to: multi-period historical charts, year-over-year comparisons, projections. **Focus on**: explaining trends, projections, period comparisons.

### `invoices`
User is on the invoices page. Has access to: invoices to pay and paid, XML/PDF upload, CFDI detail, payment complements. **Focus on**: pending invoices, upcoming due dates, supplier analysis.

### `quality`
User is on the quality page. Has access to: quality KPIs, complaints, satisfaction indicators. **Focus on**: quality metrics and improvement trends.

---

## 6. Sales Excel Structure (process_sales_excel)

The sales Excel upload is a critical feature. The Excel has a very specific 4-sheet structure:

### Sheet 1: "VENTAS " (DI Transactions)
| Column | Field | Required |
|--------|-------|----------|
| 1 | Fecha (Date) | No |
| 2 | Folio | No |
| 3 | Cliente (Customer) | **Yes** |
| 4 | Producto (Product) | **Yes** |
| 5 | Cantidad (Quantity, KG) | **Yes, >0** |
| 6 | Precio Unitario (Unit Price, USD) | No |
| 7 | Importe (Amount, USD) | No |
| 8 | Ano (Year) | No |
| 9 | Mes (Month) | No |

- Header: Row 1
- Submodulo: `DI` (DURA International)
- Unit: KG, Currency: USD

### Sheet 2: "RESUMEN DI" (DI Summary)
| Column | Field | Required |
|--------|-------|----------|
| C (3) | Cliente | **Yes** |
| D (4) | Activo (0/1 flag) | No |
| F (6) | Kilos Totales 2024 | No |
| I (9) | Kilos Totales 2025 | No |
| J (10) | Diferencial (kg difference) | No |
| M (13) | USD Totales 2025 | No |
| N (14) | % Utilidad (profit margin) | No |
| S (19) | Acciones (notes) | No |
| T (20) | Responsable | No |

- Header: Row 6 (skip rows 1-5)
- Submodulo: `DI`

### Sheet 3: "VENTAS GO" (GO Transactions)
| Column | Field | Required |
|--------|-------|----------|
| 1 | Factura (Invoice) | No |
| 2 | Fecha (Date) | No |
| 3 | Cliente (Customer) | **Yes** |
| 4 | Producto (Product) | **Yes** |
| 5 | Familia del Producto | No |
| 6 | Cantidad (Quantity, units) | **Yes, >0** |
| 7 | USD (Amount in USD) | No |
| 8 | Tipo de Cambio (Exchange Rate) | No |
| 9 | Importe M.N. (Amount in MXN) | No |

- Header: Row 1
- Submodulo: `GO` (Grupo ORSEGA)
- Unit: unidades, Currencies: USD + MXN

### Sheet 4: "RESUMEN GO" (GO Summary)
| Column | Field | Required |
|--------|-------|----------|
| C (3) | Cliente | **Yes** |
| F (6) | Kilos Totales 2024 | No |
| I (9) | Kilos Totales 2025 | No |
| J (10) | Diferencial | No |
| S (19) | Accion (notes) | No |
| T (20) | Responsable | No |

- Header: Row 6 (skip rows 1-5)
- Submodulo: `GO`
- **Note**: No "Activo", "USD", or "Utilidad" columns (unlike DI)

### Number Parsing
- Strip `$`, commas, spaces
- Handle Spanish format: `1.524,00` -> `1524.00`
- Return null for unparseable

### Date Parsing
- Accept: Date objects, Excel serial numbers, `DD/MM/YY(YY)` strings
- 2-digit years: <50 -> 20xx, >=50 -> 19xx

### Import from Nova Chat

Cuando el usuario adjunta un Excel de ventas en el chat y pide análisis, Nova debe analizar el archivo y responder en español. **No es obligatorio** que Nova llame a un endpoint de kpis-grupo-orsega para importar: la importación la hace el cliente cuando el usuario pulsa "Confirmar importación" y el frontend reenvía el mismo Excel a:

- **Endpoint (kpis-grupo-orsega):** `POST /api/sales-data/import-from-nova`
- **Body:** `multipart/form-data`, campo `file` = mismo Excel subido al chat
- **Auth:** JWT (mismo que el chat)

**Convención "listo para importar":** Cuando Nova haya analizado el Excel y el usuario pueda confirmar la importación, Nova puede indicar en su respuesta algo como: *"Listo para importar cuando confirmes"* o *"Puedes confirmar la importación en el botón del chat."* Así el usuario sabe que puede usar el botón "Confirmar importación" (visible con modo datos GODINTAL activo).

Formatos soportados por el endpoint hoy: **IDRALL**, **LEGACY** (4 hojas). El formato **ACUMULADO 2026** (hoja "ACUMULADO 2026") se soportará en kpis-grupo-orsega una vez documentada la estructura; ver `docs/NOVA_CHAT_VENTAS_ENERO.md` y docs de formato ACUMULADO 2026.

---

## 7. Environment Variables (kpis-grupo-orsega side)

```
NOVA_AI_URL=https://econova-ai-platform-production.up.railway.app
NOVA_AI_API_KEY=<service-to-service-key>
NOVA_AI_TENANT_ID=grupo-orsega
```

When `NOVA_AI_URL` is not set, the app falls back to the local implementation (direct Anthropic SDK calls). This is the zero-risk rollback mechanism.

---

## 8. What Nova AI Needs to Implement

### Currently working
- `GET /health` -> returns brain healthy, database unavailable

### Currently broken (returns 405)
- All POST endpoints

### Must implement
1. **POST /chat** endpoint accepting JSON and multipart/form-data
2. **SSE streaming** response with events: `token`, `tool_start`, `tool_result`, `done`, `error`
3. **JSON response** mode (when `Accept: application/json` or `stream: false`)
4. **Service-to-service auth** via `Authorization: Bearer <key>`
5. **Tenant context** from `X-Tenant-ID` header -> loads DB connection and system prompt for that tenant
6. **Database connection** to client's Neon PostgreSQL (the `DATABASE_URL` from kpis-grupo-orsega)
7. **NL-to-SQL** capability (Nova AI's database agent) replacing the 10 real MCP tools that are just SQL queries
8. **File processing** for Excel uploads (using Nova AI's excel MCP or equivalent)
9. **Document processing** for PDF/XML invoices (using Nova AI's docs agent)

---

## 9. Testing Checklist

Once both sides are ready:

1. **Basic chat**: "Hola" -> streaming via Nova AI -> response in frontend
2. **SQL query**: "Ventas del mes de DURA" -> NL->SQL against Neon -> real data
3. **Multi-company**: "Compara ventas DURA vs ORSEGA" -> filters by company_id correctly
4. **Exchange rate**: "Tipo de cambio actual" -> queries exchange_rates table
5. **File upload**: Drag Excel -> Nova AI processes with excel capability
6. **Invoice**: PDF/XML CFDI -> Nova AI docs agent analyzes
7. **Auto-analysis**: Upload sales Excel -> `autoAnalyzeSalesUpload` fires via `novaAIClient.chat()`
8. **Page context**: On treasury page -> response focused on cash flow
9. **Rollback**: Remove `NOVA_AI_URL` env var -> everything reverts to local instantly

# REP Recordatorios Automáticos — Setup N8N

## Flujo

```
⏰ Cron 10 AM (L-V)
  → GET /api/treasury/pending-rep-reminders (vouchers 3+ días sin REP)
  → Por cada uno:
      → Code: arma HTML según tier (1er/2do/3er recordatorio)
      → Gmail: envía el email
      → POST /api/treasury/rep-reminder-sent (registra para no duplicar)
```

## Tiers automáticos

| Tier | Días | Tono |
|------|------|------|
| 1 | 3-6 días | Amable, naranja |
| 2 | 7-13 días | Firme, rojo |
| 3 | 14+ días | URGENTE, rojo oscuro |

El backend calcula el tier automáticamente según los días transcurridos.

## Importar

1. N8N → Workflows → Import from File → `rep-reminder-workflow.json`

## Configurar (3 cosas)

### 1. Variable `API_BASE_URL`
N8N → Settings → Variables → crear `API_BASE_URL`:
- Valor: la URL de tu app en Railway (ej: `https://kpis-orsega.up.railway.app`)

### 2. Credencial "KPIs API JWT"
N8N → Credentials → Add → **Header Auth**:
- Name: `KPIs API JWT`
- Header Name: `Authorization`
- Header Value: `Bearer <JWT>` (del localStorage de la app logueado como admin)

### 3. Credencial Gmail
Asigna tu cuenta Gmail existente al nodo "Gmail - Enviar Recordatorio".
Es la misma que ya usas en tu workflow actual de Tesorería.

## Probar

1. Click "Test Workflow" en N8N
2. Si hay vouchers en `pendiente_complemento` con 3+ días → envía emails
3. Si no hay → termina en "Sin pendientes hoy"

## Activar

Toggle "Active" arriba a la derecha. Listo.

## Idempotencia

Si se ejecuta 2 veces el mismo día, NO duplica emails.
El endpoint GET verifica `email_outbox` antes de retornar cada voucher.

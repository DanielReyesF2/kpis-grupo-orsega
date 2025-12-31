# Integración n8n - KPIs Grupo ORSEGA

## Flujos Incluidos

El archivo `ai-assistant-complete.json` contiene 4 flujos de trabajo:

### 1. AI Assistant Webhook
- **Trigger**: `POST /webhook/ai-assistant`
- **Función**: Procesa preguntas complejas con OpenAI y contexto de datos
- **Uso**: El frontend puede enviar preguntas a n8n para procesamiento avanzado

### 2. Alertas Inteligentes
- **Trigger**: Cada hora (configurable)
- **Función**: Detecta anomalías en ventas (desviaciones >20% del promedio)
- **Acción**: Envía email con análisis de la anomalía

### 3. Reporte Semanal Automático
- **Trigger**: Lunes 8:00 AM (configurable)
- **Función**: Genera reporte ejecutivo con OpenAI
- **Contenido**: Métricas de la semana, top clientes, tendencias, recomendaciones

### 4. Sistema de Memoria (Multi-Agente)
- **Trigger**: `POST /webhook/ai-memory`
- **Función**: Guarda y recupera historial de conversaciones
- **Uso**: Mantener contexto entre sesiones del AI

---

## Instalación

### Paso 1: Importar Workflow en n8n

1. Abre tu instancia de n8n
2. Ve a **Settings** > **Import from file**
3. Selecciona `ai-assistant-complete.json`
4. Click **Import**

### Paso 2: Configurar Credenciales

Necesitas configurar 3 credenciales en n8n:

#### OpenAI API
1. Ve a **Credentials** > **Add credential**
2. Busca "OpenAI"
3. Ingresa tu API Key de OpenAI
4. Nombra la credencial: `OpenAI API`

#### PostgreSQL
1. Ve a **Credentials** > **Add credential**
2. Busca "Postgres"
3. Configura:
   - Host: `tu-host.neon.tech` (o tu servidor PostgreSQL)
   - Database: `kpis_orsega`
   - User: tu usuario
   - Password: tu contraseña
   - SSL: Activado (para Neon)
4. Nombra la credencial: `PostgreSQL KPIs`

#### SMTP (para emails)
1. Ve a **Credentials** > **Add credential**
2. Busca "SMTP"
3. Configura tu servidor de correo
4. Nombra la credencial: `SMTP`

### Paso 3: Variables de Entorno en el Sistema

Agrega estas variables en tu servidor (Railway, etc.):

```env
# Token de seguridad para webhooks n8n
N8N_WEBHOOK_TOKEN=tu-token-secreto-aqui

# URL de tu instancia n8n (opcional, para llamadas desde el server)
N8N_WEBHOOK_URL=https://tu-n8n.com
```

### Paso 4: Ejecutar Migración de Base de Datos

Para habilitar la memoria del AI, ejecuta:

```sql
-- En tu base de datos PostgreSQL
\i migrations/0009_create_ai_conversations_table.sql
```

O copia el contenido del archivo y ejecútalo en tu cliente SQL.

---

## Uso

### Desde tu Aplicación

**Enviar pregunta al AI:**
```javascript
const response = await fetch('https://tu-n8n.com/webhook/ai-assistant', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: "¿Cuáles fueron las ventas de noviembre?",
    history: [] // Historial de mensajes previos (opcional)
  })
});
const data = await response.json();
console.log(data.answer);
```

**Guardar en memoria:**
```javascript
await fetch('https://tu-n8n.com/webhook/ai-memory', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: "user-123",
    sessionId: "session-abc",
    role: "user",
    content: "Mi pregunta..."
  })
});
```

### API Endpoints del Servidor

Tu aplicación expone estos endpoints para n8n:

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/n8n/webhook` | POST | Recibir callbacks de n8n |
| `/api/n8n/context` | GET | Obtener contexto de datos |
| `/api/n8n/query` | POST | Ejecutar queries SQL (solo SELECT) |

**Headers requeridos:**
```
x-n8n-token: tu-token-secreto
```

---

## Personalización

### Cambiar Frecuencia de Alertas
1. Abre el workflow en n8n
2. Click en "Schedule Alerts Check"
3. Modifica el intervalo (por defecto: cada hora)

### Cambiar Día/Hora del Reporte Semanal
1. Abre el workflow en n8n
2. Click en "Weekly Report Schedule"
3. Modifica el día y hora

### Modificar Umbral de Anomalías
En el nodo "Check Anomalies", cambia el `20` en la query:
```sql
... ABS(...) > 20  -- Cambia este valor
```

### Cambiar Destinatarios de Email
Edita los nodos "Send Alert Email" y "Send Weekly Report":
- `toEmail`: destinatarios (separa múltiples con coma)
- `fromEmail`: remitente

---

## Arquitectura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   n8n           │────▶│   OpenAI        │
│   (React)       │     │   Workflows     │     │   GPT-4o-mini   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   PostgreSQL    │
                        │   (Neon)        │
                        └─────────────────┘
```

---

## Troubleshooting

### El webhook no responde
1. Verifica que el workflow esté **activo** (toggle verde)
2. Revisa los logs en n8n (Executions)
3. Verifica que las credenciales estén configuradas

### Error de conexión a PostgreSQL
1. Verifica la URL de conexión
2. Asegúrate de que SSL esté habilitado (Neon lo requiere)
3. Verifica que la IP de n8n esté permitida

### OpenAI no responde
1. Verifica que la API key sea válida
2. Revisa los límites de tu cuenta OpenAI
3. Verifica el modelo (gpt-4o-mini debe estar disponible)

---

## Soporte

Para problemas con la integración:
1. Revisa los logs de ejecución en n8n
2. Verifica las credenciales
3. Contacta al equipo de desarrollo

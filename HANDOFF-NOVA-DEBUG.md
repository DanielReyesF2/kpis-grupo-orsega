# Nova AI File Upload — Handoff para Debugging

**Fecha:** 2026-02-03
**Estado:** El archivo Excel llega al backend pero el usuario no ve respuesta en el chat

---

## Arquitectura del flujo

```
Browser (React)
  → FormData con archivo Excel
  → POST /api/nova/chat (Express, multer)
    → multer acepta archivo en memoria
    → validateFileContent() verifica magic bytes
    → nova-client.ts convierte a base64 JSON
    → POST a EcoNova Gateway (Hono.js externo)
      → EcoNova reenvía a Brain (Python, Claude tool_use + openpyxl)
      → Brain responde SSE stream
    ← EcoNova devuelve SSE stream
  ← Express re-emite SSE al frontend
← Frontend (useNovaChat.ts) parsea SSE y renderiza en chat
```

---

## Que funciona (confirmado en logs de Railway)

1. **Multer recibe el archivo:** `Raw multer files: 1`
2. **Validacion bypaseada:** `Excel file accepted (MIME: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, size: 82944)`
3. **Archivo llega a nova-client:** `files: 1, novaAI: true`
4. **EcoNova responde 200:** `POST /api/nova/chat 200 in 30764ms`

## Que NO funciona

5. **El frontend no muestra respuesta** — el chat queda vacio despues del mensaje del usuario. No hay burbuja de asistente visible.

---

## Hipotesis principal

EcoNova devuelve data pero en un formato que el parser SSE de `nova-client.ts` no reconoce. El stream termina sin emitir tokens ni un `done` event con respuesta. El backend sintetiza un `done` con `answer: ""`, y el frontend lo ignora (porque `if (data.answer)` es falsy para string vacio).

**Evidencia:** 30 segundos de procesamiento (EcoNova claramente hizo algo), pero 0 tokens llegaron al frontend.

---

## Archivos clave

### Backend

- **`server/nova/nova-client.ts`** — HTTP proxy client. Hace POST a EcoNova y parsea SSE.
  - Linea 98-225: `streamChat()` — la funcion que envia a EcoNova y lee el stream
  - Linea 110-137: Payload JSON con `file_data` (base64), `file_name`, `file_media_type`
  - Linea 158-230: Parser SSE que lee chunks y busca `event: token`, `event: done`, etc.
  - **RECIEN AGREGADO (commit bfa11fac):** Debug logging que imprime los primeros 3 chunks crudos de EcoNova, eventos no reconocidos, lineas non-SSE, y JSON parse failures.

- **`server/nova/nova-routes.ts`** — Express route handler
  - Linea 165-336: POST `/api/nova/chat` — recibe multipart, valida, y llama a `novaAIClient.streamChat()`
  - Linea 258-270: Loop de validacion de archivos (Excel bypaseado en caller)
  - Linea 287-329: Invocacion de `streamChat()` con callbacks SSE

- **`server/nova/sse-utils.ts`** — `sanitizeSSE()` solo trunca strings a maxLen

### Frontend

- **`client/src/lib/econova-sdk/useNovaChat.ts`** — Hook React que hace fetch SSE
  - Linea 113-119: POST `/api/nova/chat` con FormData
  - Linea 133-230: Reader SSE del frontend (espejo del parser del backend)
  - Linea 139-142: Agrega mensaje asistente vacio al iniciar streaming
  - Linea 164-170: `token` events acumulan texto en `fullText`
  - Linea 181-207: `done` event actualiza mensaje final (solo si `data.answer` es truthy)

- **`client/src/components/ai/EcoNovaAssistant.tsx`** — UI del chat
  - Linea 525-530: Renderiza `message.content` con ReactMarkdown

### Config

- **`server/nova/nova-client.ts` linea 114-118:** Headers enviados a EcoNova:
  ```
  Authorization: Bearer ${apiKey}
  X-Tenant-ID: grupo-orsega
  Content-Type: application/json
  Accept: text/event-stream
  ```

- **Variables de entorno:** `NOVA_AI_URL`, `NOVA_AI_API_KEY`, `NOVA_AI_TENANT_ID`

---

## Que necesita revisarse

1. **Los debug logs del proximo deploy** — commit `bfa11fac`, build marker `[BUILD=nova-debug-sse-v3]`. Cuando el usuario suba un Excel, los logs van a mostrar los chunks crudos de EcoNova. Eso revela el formato real.

2. **Posibles causas:**
   - EcoNova devuelve JSON plano (no SSE) a pesar del header `Accept: text/event-stream`
   - EcoNova usa nombres de eventos diferentes (ej: `message` en vez de `token`, `complete` en vez de `done`)
   - EcoNova devuelve el texto directamente sin wrapear en JSON (`data: texto plano\n\n` en vez de `data: {"text":"..."}\n\n`)
   - El `content-type` de respuesta de EcoNova no es `text/event-stream` y Node fetch lo maneja diferente
   - EcoNova devuelve todo en un solo chunk al final (no streaming real) y el parser no lo procesa correctamente por el split de lineas

3. **Posible fix rapido si EcoNova no hace SSE:** Si EcoNova devuelve JSON plano, interceptar la respuesta como `.json()` en vez de leerla como stream, y emitir el `done` event directamente.

---

## Commits relevantes (en orden)

| Commit | Cambio |
|--------|--------|
| `e1fa2bf9` | nova-client.ts: JSON+base64 en vez de FormData multipart |
| `36908bdc` | nova-routes.ts: validateFileContent siempre retorna true para Excel |
| `272b8c38` | nova-routes.ts: bypass validacion en caller (el fix que SI funciono) |
| `bfa11fac` | nova-client.ts: debug logging del SSE parser (PENDIENTE DE TESTEAR) |

---

## Para reproducir

1. Login como usuario con acceso a Dura International (company_id=1)
2. Abrir el chat Nova AI (icono flotante o Cmd+K)
3. Escribir "Analiza el excel de ventas de Dura del enero 2026"
4. Adjuntar archivo Excel (.xlsx)
5. Enviar
6. Observar: el mensaje del usuario aparece, pero no hay respuesta del asistente
7. Revisar logs de Railway para ver los chunks de debug

---

## Pregunta clave para resolver

**Que formato exacto devuelve EcoNova cuando recibe un archivo Excel via JSON con base64?** Los debug logs del deploy `bfa11fac` van a responder esto.

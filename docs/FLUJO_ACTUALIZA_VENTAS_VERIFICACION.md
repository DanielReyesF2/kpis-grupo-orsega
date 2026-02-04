# Verificación: "Actualiza ventas enero 2026 de Dura" + archivo adjunto

Flujo de inicio a fin cuando el usuario escribe ese mensaje y sube un Excel en el chat de Nova.

---

## Escenario

- Usuario en la app KPIs, abre el chat de Nova (Cmd+K o botón).
- Escribe: **"actualiza ventas enero 2026 de Dura"**.
- Adjunta **un archivo Excel** (ej. ventas Dura IDRALL o 4 hojas).
- Pulsa enviar.

---

## Paso a paso (este repo)

### 1. Frontend — Envío del mensaje

**Archivo:** `client/src/components/ai/EcoNovaAssistant.tsx` → `handleSubmit`  
**Archivo:** `client/src/lib/econova-sdk/useNovaChat.ts` → `sendMessage`

1. Usuario envía; se construye el FormData con:
   - `message`: "actualiza ventas enero 2026 de Dura"
   - `conversationHistory`: array con ese mensaje (y anteriores si los hay)
   - `pageContext`: valor de la página actual (ej. `dashboard`)
   - `tenantId`: **`grupo-orsega`** (fijo en `EcoNovaAssistant`: `useNovaChat({ pageContext: page, tenantId: 'grupo-orsega' })`)
   - `conversationId`: **solo si ya existía** (primer mensaje de la conversación → no se envía)
   - `files`: el archivo Excel (multipart)

2. Si **modo datos está desbloqueado** (GODINTAL) y hay un Excel entre los adjuntos:
   - Se guarda ese Excel en `lastExcelForImportRef.current`
   - Se marca `lastExcelPending = true` para mostrar luego el bloque "Confirmar importación"

3. Se hace **POST `/api/nova/chat`** con ese FormData (JWT en cabecera).

**Nota:** Siempre se envía `tenantId: 'grupo-orsega'`. El texto "de Dura" no cambia el tenant; Nova recibe tenant y, si devuelve `conversationId`, lo usamos en los siguientes mensajes.

---

### 2. Backend KPIs — Proxy a Nova

**Archivo:** `server/nova/nova-routes.ts`

1. **Auth y multer:** JWT obligatorio; multer parsea `files` (hasta 5). El Excel queda en memoria (`req.files`).

2. **Body:** Se lee `message`, `conversationHistory`, `pageContext`, `conversationId`, `tenantId` del body (multer deja los campos de texto en `req.body`).

3. **Validación de archivos:** Se aceptan Excels por MIME; opcionalmente magic bytes. Los archivos válidos se pasan a Nova.

4. **Llamada a Nova:**  
   `novaAIClient.streamChat(message, filesToForward, { conversationHistory, pageContext, userId, companyId, conversationId, tenantId }, callbacks, signal)`  
   - Primer mensaje: `conversationId` es `undefined`.  
   - `tenantId` viene del body (o el backend usa env); aquí llega `grupo-orsega`.

---

### 3. Cliente Nova (backend) — Request al Gateway

**Archivo:** `server/nova/nova-client.ts` → `streamChat`

1. Se arma el payload JSON para **NOVA_AI_URL/chat**:
   - `message`, `tenant_id` (de `context.tenantId` o `NOVA_AI_TENANT_ID`), `conversation_history`, `page_context`, `user_id`, `company_id`, etc.
   - `conversation_id`: **solo si `context.conversationId` está definido** (en el primer mensaje no va).
   - Si hay archivos: **solo el primero** se envía en base64: `file_data`, `file_name`, `file_media_type`.

2. Se envía **POST** con `Accept: text/event-stream`. Nova AI (servicio externo) recibe mensaje, tenant, archivo y opcionalmente conversation_id.

---

### 4. Respuesta de Nova → SSE al cliente

**Archivo:** `server/nova/nova-client.ts` (parser SSE), `server/nova/nova-routes.ts` (callbacks)

1. Nova responde con stream SSE (eventos `token`, `tool_start`, `tool_result`, `done`, `error`).
2. El backend reenvía cada evento al navegador (mismo formato SSE).
3. En **event: done**:
   - Nova puede incluir `conversationId` (o `conversation_id`). El backend lo incluye en el `data` del evento `done` que envía al frontend.
   - El backend no modifica la respuesta de Nova; solo reenvía y añade `conversationId` al payload del `done` si Nova lo envió.

---

### 5. Frontend — Consumo del SSE y estado

**Archivo:** `client/src/lib/econova-sdk/useNovaChat.ts`

1. Se lee el stream SSE y se actualiza el mensaje del asistente con los tokens.
2. Al recibir **event: done**:
   - Se toma `data.conversationId` o `data.conversation_id` y se guarda en state y en `sessionStorage` (`novaConversationId`). **A partir de aquí, los siguientes mensajes de esta conversación enviarán ese `conversationId`.**
   - Si `data.toolsUsed` incluye `process_sales_excel`, `import_sales`, etc., se invalidan las queries de React Query (kpis, kpi-values, sales, sales-data, etc.) para que el dashboard muestre datos nuevos.
3. Si **modo datos estaba desbloqueado** y se había guardado un Excel en `lastExcelForImportRef`, se muestra el bloque **"Confirmar importación"**.

---

### 6. Dos formas de que las ventas se actualicen

#### A) Nova ejecuta import (herramienta en el repo Nova)

- En el **repo Nova**, si el Brain decide llamar a una herramienta tipo `import_sales` (u otra que escriba en la BD del cliente), esa herramienta es la que actualiza ventas/KPIs en la misma PostgreSQL que usa la app KPIs.
- En ese caso, la invalidación de queries en el paso 5 hace que, al ir al dashboard, se pidan de nuevo los datos y se vean las ventas actualizadas.
- **Condición:** Que Nova devuelva en `toolsUsed` el nombre de esa herramienta (ej. `import_sales`) para que el frontend invalide.

#### B) Usuario pulsa "Confirmar importación" (flujo en este repo)

- Solo aparece si **modo datos está desbloqueado** (GODINTAL) y se había adjuntado un Excel en ese envío.
- Al pulsar "Confirmar importación", el frontend hace **POST `/api/sales-data/import-from-nova`** con el archivo guardado en `lastExcelForImportRef` (mismo Excel que se envió a Nova).
- **Archivo:** `server/routes/sales-data.ts` → detecta formato (IDRALL / LEGACY / ACUM_GO_2026) y llama al handler correspondiente. Se usa `user.companyId` para el handler (ej. Dura = 1). Se escribe en `sales_data`; los KPIs se recalculan con la lógica existente.
- Tras éxito, el frontend invalida `sales-data`, `kpi-values`, `kpis`. El dashboard muestra los datos nuevos al refetch.

---

## Resumen

| Paso | Qué pasa |
|------|----------|
| 1 | Usuario envía "actualiza ventas enero 2026 de Dura" + Excel. Frontend envía tenantId `grupo-orsega`, conversationId solo si ya existía, y el archivo. Si hay modo datos, guarda el Excel para "Confirmar importación". |
| 2 | Backend recibe el multipart, lee conversationId y tenantId, valida el Excel. |
| 3 | Backend llama a Nova con message, tenant_id, (conversation_id si hay), y el primer archivo en base64. |
| 4 | Nova responde por SSE; en `done` puede devolver conversationId. Backend reenvía el SSE al navegador. |
| 5 | Frontend guarda conversationId para los siguientes mensajes, invalida queries si Nova usó herramientas de datos, y muestra "Confirmar importación" si aplica. |
| 6 | Las ventas se actualizan o bien porque Nova ejecutó import (A), o porque el usuario pulsó "Confirmar importación" (B). En ambos casos el dashboard se actualiza por la invalidación de queries. |

---

## Puntos a tener en cuenta

1. **Primer mensaje sin conversation_id:** Es correcto. Nova asigna la conversación y debe devolver `conversationId` en el primer `done`. Nosotros lo guardamos y lo enviamos en todos los mensajes siguientes.
2. **Solo un archivo a Nova:** El cliente Nova envía `files[0]`. Varios adjuntos en el chat: solo el primero llega al Gateway.
3. **tenant_id siempre "grupo-orsega":** En EcoNovaAssistant está fijo. Si en el futuro hubiera que distinguir por empresa (Dura vs Orsega) en el tenant de Nova, habría que derivar `tenantId` según `user.companyId` o contexto.
4. **"Confirmar importación" solo con modo datos:** Si el usuario no desbloquea con GODINTAL, no se guarda el Excel para import local ni se muestra el botón; la única vía de import sería la herramienta de Nova (A).
5. **Company en import-from-nova:** Al importar por "Confirmar importación", se usa `user.companyId` (Dura = 1, Orsega = 2). Para "ventas Dura" el usuario debe estar en la empresa Dura o el handler debe recibir de alguna forma que el archivo es de Dura; actualmente se usa la company del usuario logueado.

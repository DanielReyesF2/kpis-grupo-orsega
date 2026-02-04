# Conversación y archivos — Contrato sostenible con Nova AI

> **Objetivo:** Que el flujo "subir Excel → analizar → actualizar ventas" funcione y **siga funcionando**. La solución sostenible es que **este repo (KPIs)** envíe siempre `conversation_id` y `tenant_id` en cada mensaje del chat. No depender solo de prompts en el repo Nova.

---

## 1. Regla obligatoria en este repo (KPIs)

En **cada** request al chat de Nova (proxy `/api/nova/chat` → Nova AI), el cliente debe enviar:

| Campo | Cuándo | Descripción |
|-------|--------|-------------|
| **tenant_id** | Siempre | Ej. `grupo-orsega`. Identifica al tenant; Nova usa esto para Redis y datos extraídos. |
| **conversation_id** | Desde el 2.º mensaje | Mismo valor en toda la conversación. Nova lo usa para cargar historial y archivos (get_extracted_sales / import_sales). |

- **Primer mensaje:** No hay `conversation_id`. Nova devuelve `conversationId` en el evento SSE `event: done`. Este repo **debe guardarlo** (state + sessionStorage) y enviarlo en todos los mensajes siguientes.
- **Mensajes siguientes:** Siempre incluir el mismo `conversation_id` hasta que el usuario cierre o limpie la conversación.

Si algún cliente (este u otro) no envía el mismo `conversation_id` en los mensajes de la misma conversación, Nova no podrá recuperar el Excel ni ejecutar import_sales correctamente.

---

## 2. Dónde está implementado en KPIs

| Capa | Archivo | Qué hace |
|------|---------|----------|
| Frontend | `client/src/lib/econova-sdk/useNovaChat.ts` | Estado `conversationId`; lo persiste desde `event: done`; lo envía en FormData en cada mensaje; envía `tenantId` desde opciones. Comentario: "OBLIGATORIO tenant_id y conversation_id". |
| Frontend | `client/src/components/ai/EcoNovaAssistant.tsx` | Llama a `useNovaChat({ pageContext, tenantId: 'grupo-orsega' })`. |
| Backend | `server/nova/nova-routes.ts` | Lee `conversationId` y `tenantId` (o `conversation_id` / `tenant_id`) del body y los pasa a `novaAIClient.streamChat`. Reenvía `conversationId` en el evento `done` al cliente. |
| Backend | `server/nova/nova-client.ts` | Incluye `tenant_id` y header `X-Tenant-ID` en cada request; usa `context.tenantId` si viene, si no `NOVA_AI_TENANT_ID`. Incluye `conversation_id` en el payload cuando `context.conversationId` está definido. |

---

## 3. Mantenimiento

- **No quitar** el envío de `conversation_id` ni de `tenant_id` en las rutas anteriores. Cualquier refactor del chat debe seguir enviando ambos.
- En el **repo Nova** se mantienen los prompts estrictos y la doc (ej. CONVERSACION_Y_ARCHIVOS.md, CHECKLIST_KPIS_REPO.md) para que el Brain espere y use estos campos.
- **Sostenible:** Este repo garantiza los campos; Nova los usa. **No sostenible:** Confiar solo en prompts y no asegurar en KPIs el `conversation_id`.

---

## 4. Referencias

- Checklist flujo chat/import/dashboard: `docs/CHECKLIST_CHAT_IMPORT_DASHBOARD.md`
- Spec integración Nova: `docs/nova-ai-integration-spec.md`

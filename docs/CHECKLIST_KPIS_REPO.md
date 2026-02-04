# Checklist repo KPIs — Integración con Nova AI

Lista de lo que **este repo (kpis-grupo-orsega)** debe cumplir para que el flujo chat → analizar Excel → importar ventas funcione de forma sostenible con Nova AI.

---

## Obligatorio (solución sostenible)

- [x] **Enviar `tenant_id` en cada mensaje del chat**  
  Ej. `grupo-orsega`. El frontend envía `tenantId` en el FormData; el backend lo reenvía a Nova (o usa `NOVA_AI_TENANT_ID`). Ver `useNovaChat`, `nova-routes`, `nova-client`.

- [x] **Enviar `conversation_id` en cada mensaje a partir del segundo**  
  El primer mensaje no lo tiene; Nova devuelve `conversationId` en `event: done`. Este repo lo guarda (state + sessionStorage) y lo incluye en todos los mensajes siguientes. Ver `useNovaChat` (persistencia y FormData), `nova-routes` (lectura del body), `nova-client` (payload `conversation_id`).

- [x] **No depender solo de prompts de Nova**  
  La garantía viene de este repo: siempre enviar los dos campos anteriores. Ver doc de contrato: `docs/CONVERSACION_Y_ARCHIVOS.md`.

---

## Dónde se implementa

| Requisito | Archivos |
|-----------|----------|
| tenant_id + conversation_id en cada request | `client/src/lib/econova-sdk/useNovaChat.ts`, `server/nova/nova-routes.ts`, `server/nova/nova-client.ts` |
| Persistir conversationId desde evento done | `useNovaChat.ts` (event: done → setConversationId + sessionStorage) |
| Reenviar conversationId al cliente en done | `nova-routes.ts` (onDone → safe.conversationId), `nova-client.ts` (onDone response) |

---

## Referencias

- Contrato detallado: **`docs/CONVERSACION_Y_ARCHIVOS.md`**
- Flujo chat / import / dashboard: **`docs/CHECKLIST_CHAT_IMPORT_DASHBOARD.md`**
- Spec Nova: **`docs/nova-ai-integration-spec.md`**

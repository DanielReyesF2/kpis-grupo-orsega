# Checklist: Chat → analizar Excel → importar ventas → actualizar gráficas

Estado de cumplimiento en el repo KPIs (kpis-grupo-orsega) para el flujo de punta a punta.

---

## 1. Chat: enviar `conversation_id` y `tenant_id` en cada mensaje

**Estado: implementado**

- **Cada request a Nova** (vía proxy `/api/nova/chat`):
  - **conversationId:** El frontend (`useNovaChat`) guarda el valor devuelto por Nova en `event: done` (campo `conversationId` o `conversation_id`) en state y en `sessionStorage` (`novaConversationId`). En cada envío siguiente se incluye en el FormData como `conversationId`. El backend (`nova-routes`) lo lee de `req.body.conversationId` o `req.body.conversation_id` y lo pasa a `novaAIClient.streamChat`. El `nova-client` lo envía a Nova en el payload como `conversation_id`.
  - **tenant_id:** El backend envía siempre `tenant_id` y header `X-Tenant-ID` desde `NOVA_AI_TENANT_ID` (por defecto `grupo-orsega`). El frontend puede enviar además `tenantId` en el FormData (p. ej. `grupo-orsega` en `EcoNovaAssistant`); el backend no lo sobreescribe por ahora.

- **Primer mensaje:** No hay `conversation_id`. La respuesta de Nova (evento SSE `event: done`) puede traer `conversationId` en `data`. El frontend lo persiste y lo envía en los mensajes siguientes.

- **Si usas SSE:** En `useNovaChat.ts` al recibir `event: done` se hace `data.conversationId ?? data.conversation_id` y se guarda con `setConversationId` y `sessionStorage.setItem(NOVA_CONVERSATION_ID_KEY, ...)`.

- **Limpieza:** Al llamar a `clearMessages()` se borra `conversationId` del state y de `sessionStorage`.

**Dónde está:**  
- Frontend: `client/src/lib/econova-sdk/useNovaChat.ts` (state/conversationId, FormData, parsing de `done`, clearMessages).  
- Backend: `server/nova/nova-routes.ts` (lectura de `conversationId` del body, paso al context; reenvío de `conversationId` en el evento `done` al cliente).  
- Cliente Nova: `server/nova/nova-client.ts` (NovaAIChatContext.conversationId, payload `conversation_id`, y lectura de `conversationId` en el evento `done` de la respuesta).

---

## 2. Dashboard / gráficas: refetch para ver datos nuevos

**Estado: cubierto**

- **Al abrir o volver al dashboard:** React Query tiene `refetchOnWindowFocus: true` por defecto (`client/src/lib/queryClient.ts`). Las vistas de KPIs/ventas usan `staleTime` y en varios casos `refetchInterval` (p. ej. KpiControlCenter 30 s, SalesPage 30 s). Al montar o al recuperar foco, se refetch si los datos están stale.

- **Tras importar desde el chat:**  
  - Si Nova usa herramientas de datos (`process_sales_excel`, `process_invoice`, `schedule_payment`, `import_sales`), en `event: done` el frontend invalida: `/api/kpis`, `/api/kpi-values`, `/api/sales`, `/api/sales-data`, `/api/top-performers`, `/api/collaborators-performance`, `/api/payment-vouchers`, `/api/treasury`, `/api/treasury/payments`, `/api/scheduled-payments`.  
  - Si el usuario usa "Confirmar importación" en el chat (flujo local), se invalidan `/api/sales-data`, `/api/kpi-values`, `/api/kpis`.

- **API/BD:** El dashboard usa las mismas APIs/BD que el backend KPIs (Neon; tablas como `sales_data`, `kpis_dura`/`kpis_orsega`, `kpi_values_dura`/`kpi_values_orsega`). Si el data-actions-agent de Nova escribe en esa misma BD, el refetch/invalidación anterior mostrará los datos nuevos.

**Dónde está:**  
- Invalidación en `useNovaChat.ts` (evento `done` + `data.toolsUsed`).  
- Invalidación en `EcoNovaAssistant.tsx` (éxito de "Confirmar importación").  
- Configuración por defecto en `queryClient.ts`; opciones por query en páginas/dashboard (KpiControlCenter, SalesPage, etc.).

---

## 3. Resumen del flujo esperado

```
Usuario en Chat KPIs:
  1. Sube Excel de ventas
  2. Nova analiza y guarda datos en Redis (conversation_id + tenant_id)
  3. Usuario escribe "actualiza ventas" / "importa al dashboard"
  4. Nova llama import_sales → data-actions-agent escribe en ventas + recalculate_kpis
  5. Nova responde "Importación completada..."

Usuario va al Dashboard:
  6. Dashboard hace refetch (por focus, mount o invalidación tras toolsUsed)
  7. Gráficas muestran datos nuevos (ventas y kpi_values actualizados)
```

En el repo KPIs se cumple (1) envío y persistencia de `conversation_id` y `tenant_id`, y (2) refetch/invalidación para que el dashboard muestre datos nuevos tras importar desde el chat.

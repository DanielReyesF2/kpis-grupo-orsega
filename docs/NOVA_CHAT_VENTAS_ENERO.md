# Nova Chat + Excel de ventas (enero) — Flujo y preparación

> Objetivo: Mario suelta el Excel de ventas de enero en el chat de Nova, entra con contraseña GODINTAL, Nova analiza el documento y da resumen; usuario y Nova interactúan hasta quedar conformes; luego se confirma y Nova (o el sistema) actualiza backend, sales_data y KPIs.

---

## 1. Flujo deseado (paso a paso)

1. **Entrada a Nova**  
   Usuario abre el chat de Nova (Cmd+K o clic en asistente).  
   Opcional: si se usa “modo datos” (confirmar e importar), debe entrar la contraseña **GODINTAL** para desbloquearlo.

2. **Soltar el Excel**  
   Mario (o quien sea) adjunta el Excel de ventas de enero en el chat (arrastrar o clip) y escribe un mensaje tipo: “Analiza este Excel de ventas de enero”.

3. **Nova analiza**  
   Nova (Nova AI 2.0) recibe el archivo, lo parsea y empieza a dar:
   - Resumen del contenido (hojas, periodos, empresas).
   - Resumen de ventas (totales, por empresa, por mes si aplica).
   - Posibles anomalías o advertencias (columnas faltantes, fechas raras, etc.).

4. **Interacción hasta estar conformes**  
   Usuario y Nova siguen el diálogo: preguntas, aclaraciones, cambios de criterio (ej. “solo DURA”, “solo enero”, “excluir X”).  
   Nova puede ir recalculando y mostrando tablas o resúmenes actualizados.  
   Cuando ambos estén conformes con lo que se va a importar, se pasa al siguiente paso.

5. **Confirmación y actualización del backend**  
   Usuario confirma explícitamente (ej. “Sí, confirma e importa” o botón “Confirmar importación”).  
   El sistema:
   - Inserta/actualiza `sales_data` con los registros acordados.
   - Recalcula KPIs que dependen de ventas (igual que hoy tras un upload por la página de Ventas).
   - Opcional: notifica o muestra un resumen de lo importado y de KPIs actualizados.

---

## 2. Contraseña GODINTAL

- **Uso:** Desbloquear el “modo datos” en Nova: poder confirmar e importar ventas (y en el futuro otras acciones que modifiquen backend).
- **Dónde:** En el chat de Nova: campo opcional “Contraseña modo datos” (o similar); si se ingresa GODINTAL, se activa el modo que permite ver “Confirmar importación” y ejecutar la importación.
- **Configuración:** La contraseña se configura en backend vía variable de entorno `NOVA_DATA_PASSWORD` (valor por defecto o ejemplo: `GODINTAL`). No hardcodear en el front.
- **Alternativa futura:** Una ruta dedicada `/nova` donde solo se pida GODINTAL (sin login completo) y se abra el mismo chat; requeriría un token alternativo para `POST /api/nova/chat` (p. ej. `POST /api/nova/unlock` que devuelva token de sesión limitado).

---

## 3. Qué hay hoy vs qué falta

### Ya existe en kpis-grupo-orsega

- **Chat Nova:** EcoNovaAssistant, useNovaChat, `POST /api/nova/chat` con JWT, subida de archivos (Excel, PDF, etc.), SSE streaming.
- **Proxy a Nova AI 2.0:** nova-client envía mensaje + archivos a `NOVA_AI_URL/chat`.
- **Excel en chat:** Multer acepta `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` y `application/vnd.ms-excel`; se reenvían a Nova 2.0.
- **Auto-análisis post-upload (desde Ventas):** Tras subir Excel por la página de Ventas, se llama `autoAnalyzeSalesUpload` y Nova devuelve análisis; el cliente puede hacer poll a `GET /api/nova/analysis/:id`.
- **Importación de ventas:** En Ventas, upload de Excel → `handleIDRALLUpload` / `handleSalesUpload` → inserción en `sales_data`; los KPIs se recalculan vía lógica existente (sales_data como fuente).
- **Especificación:** `docs/nova-ai-integration-spec.md` (contrato POST /chat, hojas VENTAS DI/GO, etc.).

### Falta o hay que asegurar

1. **Nova AI 2.0 (externo)**  
   - Que `POST /chat` acepte multipart con Excel y no devuelva 405.  
   - Que analice el Excel (hojas DI/GO, estructura de ventas) y devuelva resumen en lenguaje natural.  
   - **Convención “listo para importar”:** Cuando Nova haya analizado el Excel y el usuario pueda confirmar, Nova puede indicar en su respuesta algo como: *“Listo para importar cuando confirmes”* o *“Puedes confirmar la importación en el botón del chat.”* Así el usuario sabe que puede usar el botón “Confirmar importación” (visible con modo datos activo).

2. **Flujo “todo desde el chat”** — **Implementado en kpis-grupo-orsega**  
   - El frontend guarda el último Excel enviado en el chat (cuando modo datos está activo).  
   - Se muestra el bloque “Confirmar importación” cuando hay un Excel pendiente y modo datos desbloqueado.  
   - Al confirmar, el frontend reenvía ese Excel a `POST /api/sales-data/import-from-nova` (multipart); el backend reutiliza `detectExcelFormat` → `handleIDRALLUpload` o `handleSalesUpload`.  
   - Nova **no** necesita llamar a nuestro backend para importar: la importación la hace este repo cuando el usuario pulsa “Confirmar importación”.

3. **GODINTAL en el producto** — **Implementado**  
   - Backend: `POST /api/nova/check-data-mode` con contraseña; variable `NOVA_DATA_PASSWORD`.  
   - Frontend: campo “Contraseña modo datos” en el chat; flag “modo datos activo” y botón “Confirmar importación”.

4. **Enero y formato**  
   - El Excel de enero debe cumplir el formato esperado (IDRALL o el de 4 hojas descrito en la spec) para que tanto Nova como nuestros handlers lo interpreten bien.  
   - Documentar en onboarding o en la spec que “enero” = `sale_year=2025`, `sale_month=1` (o el año que corresponda).

---

## 4. Diseño recomendado para “Confirmar e importar”

- **Fuente de verdad del import:** La misma que hoy: `handleIDRALLUpload` / `handleSalesUpload` (y validaciones asociadas). No duplicar lógica.
- **Desde el chat:**
  1. Usuario suelta Excel en Nova → backend lo recibe en `POST /api/nova/chat` y lo reenvía a Nova 2.0.
  2. Nova 2.0 analiza y responde (resumen, tablas, advertencias). Opcional: Nova 2.0 devuelve un `attachment` o `import_preview` con referencia al archivo (ej. `fileId` que nosotros guardamos en memoria o disco al recibir el multipart).
  3. Frontend, si está en “modo datos” (GODINTAL) y Nova indicó “listo para importar”, muestra un bloque tipo: “Nova analizó el Excel. [Vista previa]. ¿Confirmar importación?” con botón “Confirmar importación”.
  4. Al confirmar, el frontend llama a **`POST /api/sales-data/import-from-nova`** con el Excel en **multipart/form-data** (campo `file`). El backend reutiliza la misma ruta lógica que la página de Ventas (leer archivo → detectExcelFormat → handleIDRALLUpload o handleSalesUpload).  
   Así Nova no necesita llamarnos por “tool”; solo devuelve mensaje, y nosotros aplicamos el import con nuestra lógica ya probada.

---

## 5. Endpoint `POST /api/sales-data/import-from-nova`

- **Método:** POST  
- **Auth:** JWT (mismo que `/api/sales/upload`).  
- **Body:** `multipart/form-data` con un único archivo Excel en el campo `file` (mismo Excel que el usuario puede haber subido al chat).  
- **Comportamiento:** Detecta formato (IDRALL / LEGACY) y ejecuta el mismo flujo que la página de Ventas; no dispara auto-análisis Nova.  
- **Formatos soportados hoy:** IDRALL, LEGACY (4 hojas). El formato **ACUMULADO 2026** (hoja “ACUMULADO 2026” para GO - VENTAS 2026.xlsx) se soportará en este repo una vez documentada la estructura y añadido el parser (ver docs de formato ACUMULADO 2026).

---

## 6. Checklist para estar listos cuando Mario suelte el Excel

- [ ] **Nova AI 2.0:** POST /chat con multipart + Excel operativo; respuesta con análisis en español y, si aplica, indicación tipo “Listo para importar cuando confirmes”.
- [x] **kpis-grupo-orsega:** Variable `NOVA_DATA_PASSWORD` (ej. GODINTAL) en backend; pantalla GODINTAL en el chat y flag “modo datos” en frontend.
- [x] **kpis-grupo-orsega:** Endpoint `POST /api/sales-data/import-from-nova` que reutiliza handleIDRALLUpload/handleSalesUpload; frontend “Confirmar importación” que reenvía el último Excel.
- [x] **UX:** Bloque “Confirmar importación” en el chat cuando hay Excel pendiente y modo datos activo.
- [ ] **Excel enero:** Formato alineado con la spec (IDRALL o 4 hojas, o ACUMULADO 2026 cuando esté soportado); probar con el archivo real de Mario.
- [ ] **Comunicación:** Dejar claro a Mario: entrar a la app → abrir Nova (Cmd+K o asistente) → (opcional) escribir GODINTAL para modo datos → adjuntar Excel y pedir análisis → revisar con Nova → confirmar importación cuando estén conformes.

---

## 7. Referencias

- Contrato Nova: `docs/nova-ai-integration-spec.md`
- Estructura Excel ventas (hojas DI/GO): misma spec, sección 6.
- Chat y proxy: `server/nova/nova-routes.ts`, `server/nova/nova-client.ts`, `client/src/components/ai/EcoNovaAssistant.tsx`, `client/src/lib/econova-sdk/useNovaChat.ts`.
- Import ventas: `server/routes/sales-data.ts`, `server/sales-idrall-handler.ts`, `server/sales-upload-handler-NEW.ts`.

# 🔍 AUDITORÍA Y DIAGNÓSTICO COMPLETO: TreasuryPage.tsx

**Fecha:** 2025-01-XX  
**Archivo:** `client/src/pages/TreasuryPage.tsx`  
**Líneas de código:** ~2,519 líneas

---

## 📊 RESUMEN EJECUTIVO

`TreasuryPage.tsx` es el componente principal del módulo de Tesorería. Contiene **5 tabs/secciones principales** y **4 módulos de dashboard** que se integran en una vista unificada.

### Estructura General:
- **1 Dashboard** (vista principal con módulos)
- **4 Tabs completos** (payments, receipts, exchange-rates, providers)
- **4 Módulos de preview** (ReceiptsModule, FxModule, SuppliersModule, AlertsModule)
- **1 Componente Kanban completo** (PaymentVouchersKanban)

---

## 🏗️ ESTRUCTURA DE MÓDULOS

### 1. **DASHBOARD (Vista Principal)**
**Tab ID:** `dashboard`  
**Líneas:** 786-813

#### Componentes Integrados:
1. **ReceiptsModule** (lg:col-span-2)
2. **FxModule**
3. **SuppliersModule**
4. **AlertsModule**

#### Funcionalidad:
- Vista consolidada de todos los módulos
- Grid responsive (1 columna en móvil, 2 en tablet, 3 en desktop)
- Cada módulo muestra un preview y permite navegar al detalle

---

### 2. **TAB: INTEGRACIÓN IDRALL**
**Tab ID:** `payments`  
**Líneas:** 823-986

#### Funciones Principales:
1. **`handleIdrallUpload()`** (línea 430-445)
   - Valida que exista archivo Excel y empresa seleccionada
   - Ejecuta `idrallUploadMutation.mutate()`
   - Resetea formulario al completar

2. **`idrallUploadMutation`** (línea 389-428)
   - **Flujo:**
     - Crea FormData con archivo Excel, companyId, createAsPending
     - POST a `/api/idrall/upload`
     - Procesa Excel y crea pagos automáticamente
     - Muestra resumen (filas procesadas, válidos, creados, errores)
     - Invalida queries de pagos
     - Resetea formulario

#### Estado del Módulo:
- `selectedCompanyForIdrall`: ID de empresa (1=Dura, 2=Orsega)
- `idrallFile`: Archivo Excel seleccionado
- `createAsPending`: Boolean para crear pagos como pendientes
- `idrallResult`: Resultado del procesamiento con summary

#### UI Components:
- Selector de empresa
- Input file para Excel (.xlsx, .xls, .csv)
- Checkbox para "crear como pendiente"
- Botón de procesamiento con loading state
- Card de resultados con estadísticas

---

### 3. **TAB: MERCADO CAMBIARIO (Exchange Rates)**
**Tab ID:** `exchange-rates`  
**Líneas:** 988-1793

#### Funciones Principales:

1. **`handleCreateExchangeRate()`** (línea 301-308)
   - Valida formulario
   - Ejecuta `createExchangeRateMutation.mutate()`
   - Convierte strings a números (buyRate, sellRate)

2. **`createExchangeRateMutation`** (línea 273-295)
   - **Flujo:**
     - POST a `/api/treasury/exchange-rates`
     - Crea nuevo registro de tipo de cambio
     - Invalida queries de exchange-rates
     - Resetea formulario y cierra modal

3. **Filtros y Visualizaciones:**
   - `fxPeriodDays`: Periodo de análisis (7, 30, 60, 90 días)
   - `fxUsdMonthly`: Monto USD mensual para cálculos
   - `selectedFxSource`: Fuente seleccionada (MONEX, Santander, DOF)
   - `showMonex`, `showSantander`, `showDOF`: Toggles para gráfica comparativa

#### Queries de Datos:
- `fxComparison`: Comparativa de spreads entre fuentes
- `monexSeries`: Serie histórica de MONEX
- `santanderSeries`: Serie histórica de Santander
- `dofSeries`: Serie histórica de DOF

#### UI Components:
1. **Modal de Registro de Tipo de Cambio**
   - Inputs: Compra, Venta, Fuente, Notas
   - Botón "Registrar"

2. **Gráfica Histórica Principal**
   - LineChart con datos de fuente seleccionada
   - Líneas de referencia (apertura 9 AM, cierre 12 PM/5 PM)
   - Tendencia 7d y volatilidad 5d

3. **Tarjetas de Información**
   - Última actualización Compra
   - Última actualización Venta
   - Tendencia (Alza/Baja/Estable)

4. **Gráfica Comparativa de Fuentes**
   - Líneas múltiples para comparar MONEX, Santander, DOF
   - Toggles para mostrar/ocultar cada fuente
   - Colores diferenciados por fuente

5. **Tabla Comparativa de Spreads**
   - Compara: Compra, Venta, Spread, Tendencia, Volatilidad, Estado
   - Badges de estado (favorable/normal/alerta)

---

### 4. **TAB: COMPROBANTES (Payment Vouchers)**
**Tab ID:** `receipts`  
**Líneas:** 1795-2107

#### Funciones Principales:

1. **`handleUploadVoucher()`** (línea 526-556)
   - **Validaciones:**
     - Verifica archivo, cliente y empresa pagadora
     - Si notify=true, valida emails o cliente con email
   - **Flujo:**
     - Ejecuta `uploadVoucherMutation.mutate()`
     - Pasa: file, clientId, payerCompanyId, notes, notify, emailTo, emailCc, emailMessage

2. **`uploadVoucherMutation`** (línea 456-524)
   - **Flujo Completo:**
     - Crea FormData con voucher, payerCompanyId, clientId, notes
     - Si notify=true: agrega notify, emailTo, emailCc, emailMessage
     - POST a `/api/payment-vouchers/upload`
     - Backend:
       - Guarda archivo en `/uploads/comprobantes/{year}/{month}/`
       - Ejecuta OCR con OpenAI Vision
       - Extrae: monto, banco, fecha, clave rastreo, beneficiario, cuentas
       - Determina estado inicial: `VALIDADO` o `PENDIENTE_VALIDACIÓN`
       - Intenta vincular con factura (por monto o UUID)
       - Si encuentra match: `CERRADO`
       - Si no match: `PENDIENTE_ASOCIACIÓN`
       - Si pago parcial: `PENDIENTE_COMPLEMENTO`
       - Si notify=true: envía email y registra en `email_outbox`
     - Frontend:
       - Guarda `uploadAnalysis` con datos extraídos
       - Invalida queries de vouchers
       - Resetea formulario
       - Muestra toast con estado inicial

3. **`handleVoucherFileChange()`** (línea 558-580)
   - Valida tipo de archivo (PDF, PNG, JPG, JPEG)
   - Valida tamaño máximo (10MB)
   - Actualiza `voucherFile` state

#### Estado del Módulo:
- `isUploadModalOpen`: Controla modal de upload
- `payerCompanyId`: Empresa pagadora (1=Dura, 2=Orsega)
- `selectedClientForVoucher`: Cliente/beneficiario seleccionado
- `voucherFile`: Archivo del comprobante
- `voucherNotes`: Notas opcionales
- `notifyClient`: Boolean para enviar correo
- `emailTo`: Emails destinatarios (separados por comas)
- `emailCc`: Emails en copia (separados por comas)
- `emailMessage`: Mensaje personalizado
- `uploadAnalysis`: Resultado del análisis OCR
- `voucherMonth`, `voucherYear`: Filtros de fecha
- `showAllVouchers`: Boolean para mostrar todos o solo mes actual

#### Queries:
- `paymentVouchers`: Lista de todos los comprobantes
- `clients`: Lista de clientes (filtrada por payerCompanyId)

#### UI Components:
1. **Modal de Upload de Comprobante**
   - Selector de empresa pagadora
   - Selector de cliente/beneficiario (autocomplete, filtrado por empresa)
   - Input file para comprobante
   - Checkbox "Enviar comprobante por correo"
   - Si notify=true:
     - Input email destinatarios
     - Input email CC
     - Textarea mensaje personalizado
   - Input notas opcionales
   - Card de resultado del análisis (monto, banco, referencia, estado, confianza OCR)

2. **Barra de Herramientas**
   - Selector de mes (1-12)
   - Selector de año (2024-2026)
   - Toggle "Ver Todos" / "Mes Actual"
   - Estadísticas compactas (total, pendiente complemento)

3. **PaymentVouchersKanban**
   - Kanban completo con 7 columnas de estado
   - Drag & drop funcional
   - Actualización de estado al mover tarjetas

#### Estados del Kanban (7 columnas):
1. `pendiente_validacion`: Pendiente Validación
2. `validado`: Validado
3. `pendiente_asociacion`: Pendiente Asociación
4. `pendiente_complemento`: Pendiente Complemento
5. `complemento_recibido`: Complemento Recibido
6. `cerrado`: Cerrado
7. `cierre_contable`: Cierre Contable

---

### 5. **TAB: PROVEEDORES (Suppliers)**
**Tab ID:** `providers`  
**Líneas:** 2109-2512

#### Funciones Principales:

1. **`handleSaveProvider()`** (línea 650-675)
   - Valida nombre y email requeridos
   - Prepara datos para crear/actualizar
   - Si `editingProvider` existe: ejecuta `updateSupplierMutation`
   - Si no: ejecuta `createSupplierMutation`

2. **`createSupplierMutation`** (línea 583-613)
   - **Flujo:**
     - POST a `/api/suppliers`
     - Crea nuevo proveedor
     - Invalida queries de suppliers
     - Cierra modal y resetea formulario

3. **`updateSupplierMutation`** (línea 615-632)
   - **Flujo:**
     - PATCH a `/api/suppliers/${id}`
     - Actualiza proveedor existente
     - Invalida queries de suppliers
     - Cierra modal y resetea `editingProvider`

4. **`deleteSupplierMutation`** (línea 634-648)
   - **Flujo:**
     - DELETE a `/api/suppliers/${id}`
     - Elimina proveedor
     - Invalida queries de suppliers

5. **`handleEditProvider()`** (línea 677-693)
   - Carga datos del proveedor en formulario
   - Establece `editingProvider`
   - Abre modal

6. **`handleDeleteProvider()`** (línea 695-699)
   - Confirma con window.confirm
   - Ejecuta `deleteSupplierMutation`

7. **`handleOpenNewProvider()`** (línea 701-717)
   - Resetea `editingProvider` a null
   - Resetea formulario a valores iniciales
   - Abre modal

#### Estado del Módulo:
- `isProviderModalOpen`: Controla modal de proveedor
- `editingProvider`: Proveedor en edición (null si es nuevo)
- `showAllSuppliers`: Boolean para mostrar todos o solo 5
- `supplierCompanyFilter`: Filtro por empresa ("all", "1", "2")
- `providerForm`: Objeto con campos del formulario:
  - name, shortName, email, phone, contactName
  - companyId, location (NAC/EXT)
  - requiresRep, repFrequency, reminderEmail, notes

#### Queries:
- `suppliers`: Lista de todos los proveedores
- `filteredSuppliers`: Proveedores filtrados por empresa

#### UI Components:
1. **Header con Gradiente**
   - Título "Gestión de Proveedores"
   - Botón "Nuevo Proveedor"

2. **Filtros**
   - Selector de empresa (Todas, Dura, Orsega)
   - Contador de proveedores mostrados

3. **Tabla de Proveedores**
   - Columnas: Empresa, Proveedor, Contacto, Ubicación, REP, Frecuencia, Acciones
   - Badges para empresa (Dura/Orsega)
   - Avatares con iniciales
   - Badges para REP (Activo/Inactivo)
   - Botones de editar y eliminar
   - Paginación con "Ver más" / "Ver menos"

4. **Modal de Proveedor**
   - Campos: Empresa, Ubicación, Nombre Completo, Nombre Corto
   - Contacto: Email, Teléfono, Persona de Contacto
   - Sección REP: Checkbox activar, Frecuencia (días), Email para recordatorios
   - Textarea de Notas
   - Botones: Cancelar, Guardar/Actualizar

---

## 📦 MÓDULOS DE DASHBOARD (Preview Cards)

### 1. **ReceiptsModule**
**Archivo:** `client/src/components/treasury/modules/ReceiptsModule.tsx`

#### Funciones:
- Muestra preview de comprobantes con 7 estados
- Kanban simplificado con drag & drop
- Estadísticas por estado
- Botón para subir comprobante
- Botón para ver módulo completo

#### Props:
- `vouchers`: Array de comprobantes
- `isLoading`: Boolean de carga
- `onUpload`: Callback para abrir modal de upload

#### Flujo:
1. Agrupa vouchers por estado
2. Muestra 7 columnas con contadores
3. Permite drag & drop entre columnas
4. Al hacer drop: actualiza estado via API
5. Navega a `/treasury?tab=receipts` para ver completo

---

### 2. **FxModule**
**Archivo:** `client/src/components/treasury/modules/FxModule.tsx`

#### Funciones:
- Muestra último tipo de cambio de fuente seleccionada
- Calcula tendencia 24h (Alza/Baja/Estable)
- Sparkline de últimas 7 actualizaciones
- Badge de tendencia con icono
- Botón para ver detalle completo

#### Props:
- `exchangeRates`: Array de tipos de cambio
- `isLoading`: Boolean de carga
- `onViewDetail`: Callback para navegar a exchange-rates tab

#### Flujo:
1. Filtra rates por fuente (DOF por defecto)
2. Obtiene último y penúltimo para calcular tendencia
3. Genera sparkline con últimos 7 registros
4. Muestra tarjetas de Compra y Venta
5. Al hacer click en "Ver detalle": navega a `exchange-rates` tab

---

### 3. **SuppliersModule**
**Archivo:** `client/src/components/treasury/modules/SuppliersModule.tsx`

#### Funciones:
- Muestra total de proveedores registrados
- Estadísticas: REP activo, REP inactivo
- Lista de 5 proveedores más recientes
- Botón para crear nuevo proveedor

#### Props:
- `suppliers`: Array de proveedores
- `isLoading`: Boolean de carga
- `onCreateSupplier`: Callback para abrir modal de proveedor

#### Flujo:
1. Calcula estadísticas (total, REP activo/inactivo)
2. Ordena proveedores por fecha de creación
3. Muestra top 5 más recientes
4. Muestra badges de estado REP
5. Al hacer click en "Nuevo proveedor": ejecuta `onCreateSupplier`

---

### 4. **AlertsModule**
**Archivo:** `client/src/components/treasury/modules/AlertsModule.tsx`

#### Funciones:
- Detecta pagos vencidos
- Calcula completados vs pendientes del mes
- Genera sparkline de seguimiento mensual (últimos 10 días)
- Badge de alertas activas
- Botón para ver detalles

#### Props:
- `payments`: Array de pagos
- `isLoading`: Boolean de carga
- `onViewAlerts`: Callback para navegar a payments tab

#### Flujo:
1. Filtra pagos vencidos (due_date < now y status != paid)
2. Calcula pagos del mes actual (completados y pendientes)
3. Genera buckets por día para sparkline
4. Muestra badge de alertas (si hay vencidos)
5. Gráfica de área con completados vs pendientes
6. Al hacer click en "Ver detalles": navega a `payments` tab

---

## 🔄 FLUJOS DE TRABAJO PRINCIPALES

### Flujo 1: Subir Comprobante Bancario

```
1. Usuario hace click en "Subir Comprobante"
2. Se abre modal de upload
3. Usuario selecciona:
   - Empresa pagadora (Dura/Orsega)
   - Cliente/Beneficiario (autocomplete filtrado por empresa)
   - Archivo (PDF, PNG, JPG)
   - Opcional: Notas
   - Opcional: Enviar por correo (con emails y mensaje)
4. Usuario hace click en "Subir y Analizar"
5. Frontend valida campos requeridos
6. POST a /api/payment-vouchers/upload con FormData
7. Backend:
   a. Guarda archivo en /uploads/comprobantes/{year}/{month}/
   b. Ejecuta OCR con OpenAI Vision
   c. Extrae datos: monto, banco, fecha, clave rastreo, beneficiario, cuentas
   d. Calcula confianza OCR
   e. Determina estado inicial:
      - Si confianza alta y datos críticos OK → VALIDADO
      - Si falta información → PENDIENTE_VALIDACIÓN
   f. Intenta vincular con factura:
      - Busca por monto (tolerancia ±5%)
      - Busca por UUID
      - Si match completo → CERRADO
      - Si match parcial → PENDIENTE_COMPLEMENTO
      - Si no match → PENDIENTE_ASOCIACIÓN
   g. Si notify=true:
      - Construye email con datos extraídos
      - Envía email (Resend/SendGrid) con archivo adjunto
      - Registra en email_outbox (PENDING → SENT/FAILED)
8. Frontend recibe respuesta con análisis
9. Muestra card de resultado (monto, banco, referencia, estado, confianza)
10. Invalida queries de vouchers
11. Usuario puede cerrar modal o ver en kanban
```

### Flujo 2: Mover Comprobante en Kanban

```
1. Usuario arrastra tarjeta de comprobante
2. @dnd-kit detecta drag start
3. Usuario suelta tarjeta en nueva columna
4. @dnd-kit detecta drag end
5. Frontend valida que nuevo estado sea válido
6. PUT a /api/payment-vouchers/:id/status
   Body: { status: "nuevo_estado" }
7. Backend actualiza estado en DB
8. Frontend invalida queries de vouchers
9. UI se actualiza automáticamente
```

### Flujo 3: Procesar Excel IDRALL

```
1. Usuario navega a tab "payments" (IDRALL)
2. Selecciona empresa (Dura/Orsega)
3. Selecciona archivo Excel (.xlsx, .xls, .csv)
4. Opcional: Marca "Crear como pendiente"
5. Click en "Procesar Excel de IDRALL"
6. POST a /api/idrall/upload con FormData
7. Backend:
   a. Lee Excel con xlsx
   b. Valida formato y columnas
   c. Parsea cada fila
   d. Valida datos requeridos
   e. Crea pagos en DB (status: pending si createAsPending=true)
   f. Retorna summary: { totalRows, validPayments, createdPayments, errors }
8. Frontend muestra card de resultados
9. Invalida queries de payments
10. Pagos aparecen en tablero Kanban
```

### Flujo 4: Registrar Tipo de Cambio

```
1. Usuario navega a tab "exchange-rates"
2. Click en "Registrar Tipo de Cambio"
3. Se abre modal
4. Usuario ingresa:
   - Compra (número)
   - Venta (número)
   - Fuente (MONEX/Santander/DOF/Otro)
   - Notas (opcional)
5. Click en "Registrar"
6. POST a /api/treasury/exchange-rates
7. Backend crea registro en DB
8. Frontend invalida queries de exchange-rates
9. Gráficas se actualizan automáticamente
10. Modal se cierra
```

### Flujo 5: Crear/Editar Proveedor

```
1. Usuario hace click en "Nuevo Proveedor" o edita existente
2. Se abre modal de proveedor
3. Usuario completa formulario:
   - Empresa, Ubicación
   - Nombre Completo, Nombre Corto
   - Email, Teléfono, Persona de Contacto
   - Configuración REP (activo, frecuencia, email)
   - Notas
4. Click en "Guardar Proveedor"
5. Si es nuevo: POST a /api/suppliers
   Si es edición: PATCH a /api/suppliers/:id
6. Backend guarda en DB
7. Frontend invalida queries de suppliers
8. Tabla se actualiza automáticamente
9. Modal se cierra
```

---

## 🐛 PROBLEMAS IDENTIFICADOS

### 1. **PROBLEMA CRÍTICO: Texto No Visible en Módulo de Tesorería**

**Síntoma:** El usuario reporta que "no se notan las letras de todo el módulo de tesorería"

**Causa Raíz:**
- Los módulos de dashboard (`ReceiptsModule`, `FxModule`, `SuppliersModule`, `AlertsModule`) usan colores de texto que no tienen suficiente contraste
- Específicamente:
  - `text-muted-foreground` en fondos oscuros
  - `text-white/70` con opacidades bajas
  - Falta de soporte explícito para modo claro/oscuro

**Archivos Afectados:**
- `client/src/components/treasury/modules/ReceiptsModule.tsx` ✅ (Ya corregido parcialmente)
- `client/src/components/treasury/modules/FxModule.tsx` ⚠️ (Necesita corrección)
- `client/src/components/treasury/modules/SuppliersModule.tsx` ⚠️ (Necesita corrección)
- `client/src/components/treasury/modules/AlertsModule.tsx` ⚠️ (Necesita corrección)

**Solución Aplicada:**
- Se actualizó `ReceiptsModule.tsx` con:
  - `text-gray-900 dark:text-white` para títulos
  - `text-gray-600 dark:text-gray-300` para descripciones
  - `font-semibold` y `font-bold` para mejor legibilidad
  - Colores específicos para modo claro y oscuro

**Pendiente:**
- Aplicar misma corrección a `FxModule`, `SuppliersModule`, `AlertsModule`

---

### 2. **PROBLEMA: Botones No Funcionales en ReceiptsModule**

**Síntoma:** "no funciona nada en este div" (referido al estado vacío)

**Causa:**
- Los botones no tenían `e.stopPropagation()`
- Eventos se propagaban a elementos padre
- Falta de fallback cuando `onUpload` no está definido

**Solución Aplicada:**
- Agregado `e.stopPropagation()` a todos los botones
- Fallback para navegar al módulo completo si no hay `onUpload`
- Agregado `z-index` para asegurar que botones sean clickeables

---

### 3. **PROBLEMA POTENCIAL: Performance**

**Observaciones:**
- `TreasuryPage.tsx` tiene 2,519 líneas (archivo muy grande)
- Múltiples queries que se ejecutan simultáneamente
- Múltiples componentes pesados (gráficas, tablas, kanban)

**Recomendaciones:**
- Considerar code splitting por tab
- Lazy loading de componentes pesados
- Memoización de cálculos complejos

---

## 📋 RESUMEN DE MUTACIONES Y QUERIES

### Queries (useQuery):
1. `/api/treasury/payments` - Pagos programados
2. `/api/treasury/exchange-rates` - Tipos de cambio
3. `/api/treasury/payments/:id/receipts` - Comprobantes de pago
4. `/api/treasury/complements` - Complementos
5. `/api/payment-vouchers` - Comprobantes bancarios
6. `/api/clients-db` - Clientes (para selección en upload)
7. `/api/suppliers` - Proveedores
8. `/api/fx/compare` - Comparativa de spreads
9. `/api/fx/source-series` - Series históricas por fuente

### Mutaciones (useMutation):
1. `createPaymentMutation` - Crear pago programado
2. `markAsPaidMutation` - Marcar pago como pagado
3. `createExchangeRateMutation` - Registrar tipo de cambio
4. `uploadReceiptMutation` - Subir comprobante de pago
5. `sendReceiptsMutation` - Enviar comprobantes por email
6. `createComplementMutation` - Crear complemento
7. `idrallUploadMutation` - Procesar Excel IDRALL
8. `uploadVoucherMutation` - Subir y analizar comprobante bancario
9. `createSupplierMutation` - Crear proveedor
10. `updateSupplierMutation` - Actualizar proveedor
11. `deleteSupplierMutation` - Eliminar proveedor

---

## ✅ RECOMENDACIONES

1. **Inmediatas:**
   - ✅ Corregir contraste de texto en `ReceiptsModule` (HECHO)
   - ⚠️ Corregir contraste en `FxModule`, `SuppliersModule`, `AlertsModule`
   - ✅ Arreglar botones no funcionales (HECHO)

2. **Corto Plazo:**
   - Implementar loading states más claros
   - Mejorar manejo de errores en mutaciones
   - Agregar validaciones más robustas en formularios

3. **Mediano Plazo:**
   - Code splitting del componente principal
   - Optimización de queries (selectivas por tab)
   - Mejora de performance en gráficas grandes

4. **Largo Plazo:**
   - Refactorización modular del componente
   - Separación de lógica de negocio
   - Tests unitarios y de integración

---

**Fin del Diagnóstico**


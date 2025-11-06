# 👥 Guía de Permisos y Funcionalidades por Rol de Usuario

**Sistema:** KPIs Grupo Orsega
**Fecha:** 2025-01-06
**Versión:** 1.0

---

## 📋 Roles Disponibles

El sistema tiene **4 roles principales**:

| Rol | Nombre | Descripción | Acceso |
|-----|--------|-------------|--------|
| 🔴 `admin` | Administrador | Acceso completo al sistema | Sin restricciones |
| 🟠 `manager` | Gerente | Gestión de KPIs y operaciones | Casi completo |
| 🟢 `user` | Usuario | Operaciones estándar | Normal |
| 🔵 `viewer` | Visualizador | Solo lectura | Solo lectura |

**Nota especial:** El usuario **"Mario Reynoso"** tiene acceso de admin independientemente de su rol.

---

## 🎯 Funcionalidades por Rol

### 🔴 ADMINISTRADOR (`admin`)

**Acceso:** TODO el sistema sin restricciones

#### Funcionalidades Exclusivas de Admin

##### Sistema y Diagnóstico
- ✅ Ver configuración del servidor (`/env-check`)
- ✅ Ver health checks del sistema
- ✅ Importar datos históricos masivos
- ✅ Ejecutar scripts de seeding

##### Usuarios
- ✅ Resetear contraseña de cualquier usuario
- ✅ Enviar emails de activación masivos
- ✅ Crear, editar y eliminar usuarios sin restricciones

##### Ventas/KPIs
- ✅ **Cerrar mes manualmente** (con override de validaciones)
- ✅ **Auto-cerrar mes** (automatización)
- ✅ Corregir metas de KPIs
- ✅ **Actualizar ventas en periodos cerrados** (con flag `adminOverride`)
- ✅ Crear, editar y eliminar KPIs
- ✅ Ver KPIs de todas las empresas

##### Tesorería
- ✅ Importar tipos de cambio históricos de Banxico
- ✅ Gestionar todos los pagos sin restricciones
- ✅ Ver tesorería de todas las empresas

##### Logística
- ✅ Crear, editar y eliminar envíos de cualquier empresa
- ✅ Ver todos los envíos sin filtros

##### Otros
- ✅ Gestionar múltiples empresas simultáneamente
- ✅ Ver datos de cualquier empresa (multi-tenant sin restricciones)

---

### 🟠 GERENTE (`manager`)

**Acceso:** Casi completo, con restricciones en operaciones críticas de sistema

#### Lo Que PUEDE Hacer

##### KPIs
- ✅ **Crear nuevos KPIs**
- ✅ **Editar KPIs existentes**
- ✅ **Eliminar KPIs**
- ✅ Actualizar valores de KPIs
- ✅ Ver KPIs de su empresa

##### Ventas
- ✅ Actualizar ventas semanalmente
- ✅ Actualizar ventas mensuales (si el mes no está cerrado)
- ✅ Ver historial de ventas

##### Tesorería
- ✅ Gestionar pagos programados
- ✅ Subir comprobantes
- ✅ Marcar pagos como pagados
- ✅ Crear solicitudes de compra de dólares
- ✅ Registrar tipos de cambio manualmente

##### Logística
- ✅ Crear nuevos envíos
- ✅ Editar envíos existentes
- ✅ Actualizar estado de envíos
- ✅ Agregar/eliminar items de envíos

##### Catálogos
- ✅ Crear nuevos proveedores
- ✅ Crear nuevos clientes
- ✅ Crear nuevos productos
- ✅ Editar productos

##### Usuarios
- ✅ Crear nuevos usuarios (de su empresa)
- ✅ Editar usuarios
- ✅ Eliminar usuarios

#### Lo Que NO PUEDE Hacer

- ❌ Cerrar mes manualmente
- ❌ Auto-cerrar mes (automatización)
- ❌ Actualizar ventas en periodos cerrados
- ❌ Resetear contraseñas de otros usuarios
- ❌ Importar datos históricos masivos
- ❌ Ver diagnósticos del sistema
- ❌ Ver datos de otras empresas (tiene restricción multi-tenant)

---

### 🟢 USUARIO (`user`)

**Acceso:** Operaciones estándar del día a día

#### Lo Que PUEDE Hacer

##### Ventas/KPIs
- ✅ **Actualizar sus propios KPIs semanalmente**
- ✅ **Actualizar sus valores mensuales** (si el mes no está cerrado)
- ✅ Ver su historial de KPIs
- ✅ Ver KPIs de su equipo
- ✅ Ver dashboard de su área

##### Tesorería
- ✅ **Subir comprobantes de pago**
- ✅ **Crear pagos programados**
- ✅ Marcar pagos como pagados
- ✅ Ver tipos de cambio
- ✅ Solicitar compra de dólares
- ✅ Registrar tipos de cambio manualmente
- ✅ Enviar comprobantes por email

##### Logística
- ✅ **Crear nuevos envíos**
- ✅ **Editar envíos** (de su empresa)
- ✅ **Actualizar estado de envíos**
- ✅ Agregar items a envíos
- ✅ Eliminar items de envíos
- ✅ Ver historial de envíos

##### Catálogos
- ✅ **Crear nuevos clientes**
- ✅ **Crear nuevos productos**
- ✅ Editar productos
- ✅ Ver catálogo de proveedores

##### General
- ✅ Ver notificaciones
- ✅ Actualizar su perfil
- ✅ Ver actividad del equipo

#### Lo Que NO PUEDE Hacer

- ❌ Crear, editar o eliminar KPIs (definiciones)
- ❌ Actualizar ventas en periodos cerrados
- ❌ Cerrar mes
- ❌ Ver KPIs de otras empresas
- ❌ Ver envíos de otras empresas
- ❌ Gestionar usuarios
- ❌ Importar datos masivos
- ❌ Resetear contraseñas

---

### 🔵 VISUALIZADOR (`viewer`)

**Acceso:** Solo lectura (default para nuevos usuarios)

#### Lo Que PUEDE Hacer

##### General
- ✅ Ver dashboard de su empresa
- ✅ Ver KPIs de su área
- ✅ Ver historial de KPIs
- ✅ Ver envíos de su empresa
- ✅ Ver tipos de cambio
- ✅ Ver catálogos (clientes, productos, proveedores)
- ✅ Ver notificaciones

#### Lo Que NO PUEDE Hacer

- ❌ **NO puede editar NADA**
- ❌ NO puede actualizar ventas
- ❌ NO puede crear envíos
- ❌ NO puede subir comprobantes
- ❌ NO puede crear clientes/productos/proveedores
- ❌ NO puede marcar notificaciones como leídas

**Nota:** Este rol es ideal para:
- Ejecutivos que solo necesitan ver reportes
- Personal externo con acceso limitado
- Usuarios en periodo de prueba

---

## 📊 Matriz de Permisos Detallada

### Módulo: Ventas y KPIs

| Acción | Admin | Manager | User | Viewer |
|--------|-------|---------|------|--------|
| Ver KPIs | ✅ Todas las empresas | ✅ Su empresa | ✅ Su empresa | ✅ Su empresa |
| Crear KPI | ✅ | ✅ | ❌ | ❌ |
| Editar KPI | ✅ | ✅ | ❌ | ❌ |
| Eliminar KPI | ✅ | ✅ | ❌ | ❌ |
| Actualizar ventas semanal | ✅ | ✅ | ✅ | ❌ |
| Actualizar ventas mensual | ✅ | ✅ | ✅ | ❌ |
| Actualizar en periodo cerrado | ✅ Con override | ❌ | ❌ | ❌ |
| Cerrar mes | ✅ | ❌ | ❌ | ❌ |
| Auto-cerrar mes | ✅ | ❌ | ❌ | ❌ |

### Módulo: Tesorería

| Acción | Admin | Manager | User | Viewer |
|--------|-------|---------|------|--------|
| Ver pagos programados | ✅ Todas | ✅ Su empresa | ✅ Su empresa | ✅ Su empresa |
| Crear pago | ✅ | ✅ | ✅ | ❌ |
| Marcar como pagado | ✅ | ✅ | ✅ | ❌ |
| Subir comprobante | ✅ | ✅ | ✅ | ❌ |
| Ver tipos de cambio | ✅ | ✅ | ✅ | ✅ |
| Registrar tipo de cambio | ✅ | ✅ | ✅ | ❌ |
| Solicitar compra de dólares | ✅ | ✅ | ✅ | ❌ |
| Importar históricos Banxico | ✅ | ❌ | ❌ | ❌ |

### Módulo: Logística/Envíos

| Acción | Admin | Manager | User | Viewer |
|--------|-------|---------|------|--------|
| Ver envíos | ✅ Todos | ✅ Su empresa | ✅ Su empresa | ✅ Su empresa |
| Crear envío | ✅ | ✅ | ✅ | ❌ |
| Editar envío | ✅ | ✅ | ✅ | ❌ |
| Actualizar estado | ✅ | ✅ | ✅ | ❌ |
| Agregar items | ✅ | ✅ | ✅ | ❌ |
| Eliminar items | ✅ | ✅ | ✅ | ❌ |
| Rastrear envío | ✅ | ✅ | ✅ | ✅ |

### Módulo: Catálogos (Clientes, Productos, Proveedores)

| Acción | Admin | Manager | User | Viewer |
|--------|-------|---------|------|--------|
| Ver catálogos | ✅ | ✅ | ✅ | ✅ |
| Crear cliente | ✅ | ✅ | ✅ | ❌ |
| Crear producto | ✅ | ✅ | ✅ | ❌ |
| Editar producto | ✅ | ✅ | ✅ | ❌ |
| Eliminar producto | ✅ | ✅ | ❌ | ❌ |
| Crear proveedor | ✅ | ✅ | ✅ | ❌ |

### Módulo: Usuarios

| Acción | Admin | Manager | User | Viewer |
|--------|-------|---------|------|--------|
| Ver usuarios | ✅ Todos | ✅ Su empresa | ✅ Su empresa | ❌ |
| Crear usuario | ✅ | ✅ | ❌ | ❌ |
| Editar usuario | ✅ | ✅ | ❌ | ❌ |
| Eliminar usuario | ✅ | ✅ | ❌ | ❌ |
| Resetear contraseña | ✅ | ❌ | ❌ | ❌ |
| Enviar activación masiva | ✅ | ❌ | ❌ | ❌ |

---

## 🔐 Restricciones Multi-Tenant

### ¿Qué es Multi-Tenant?

El sistema tiene **aislamiento por empresa**. Esto significa que:

- ✅ Los usuarios solo ven datos de **su propia empresa**
- ✅ No pueden ver envíos, ventas, o tesorería de otras empresas
- ✅ Cada empresa tiene sus propios KPIs y configuraciones

### Excepciones Multi-Tenant

**Administradores (`admin`):**
- ✅ Pueden ver datos de **todas las empresas**
- ✅ Pueden cambiar entre empresas en el filtro global
- ✅ Sin restricciones de tenant

**Nota:** Esta es una medida de seguridad importante implementada en **VUL-001** para prevenir fugas de información.

---

## 🚨 Funcionalidades Críticas con Validaciones Especiales

### 1. Cierre de Mes (Ventas)

**Solo Admin puede:**
- Ejecutar cierre manual de mes
- Ejecutar auto-cierre automático
- Actualizar ventas en periodos cerrados (con flag `adminOverride`)

**Validaciones:**
- ✅ Verifica que todas las ventas del mes estén completas
- ✅ Calcula automáticamente totales mensuales
- ✅ Marca el periodo como cerrado
- ✅ Envía notificaciones al equipo

### 2. Actualización de Ventas Semanales

**Todos los usuarios autenticados pueden actualizar sus ventas, PERO:**

- ✅ Solo pueden actualizar la semana actual
- ❌ No pueden actualizar semanas pasadas si el mes está cerrado
- ✅ Admin puede usar `adminOverride` para forzar actualización

**Restricción de semana:**
```
Ejemplo: Si estamos en Semana 3 de Enero
- ✅ Puede actualizar Semana 3
- ⚠️ Puede actualizar Semana 2 (si enero no está cerrado)
- ❌ No puede actualizar Semana 1 (si enero está cerrado)
```

### 3. Subida de Comprobantes (Tesorería)

**Rate Limiting aplicado:**
- 🔒 Máximo **20 archivos por hora** por usuario
- 🤖 Cada archivo usa OpenAI API para análisis
- 💰 Protección contra uso excesivo de API

### 4. Gestión de Envíos

**Notificaciones automáticas:**
- 📧 Al crear envío → Notifica al equipo de logística
- 📧 Al actualizar estado → Notifica al cliente (si tiene emails)
- 📧 Al marcar como entregado → Notifica cierre administrativo

---

## ⚠️ Vulnerabilidades y Consideraciones de Seguridad

### 🔴 Problemas Identificados

1. **Endpoint público sin auth**: `/api/debug-database`
   - ⚠️ Expone información de la base de datos
   - **Recomendación:** Agregar auth o deshabilitar en producción

2. **Fuga de información**: `/api/user-kpi-history/:userId`
   - ⚠️ No requiere autenticación
   - **Recomendación:** Agregar `jwtAuthMiddleware`

3. **Acceso universal a clientes**: `/api/clients-db`
   - ⚠️ Permite ver clientes de todas las empresas
   - **Recomendación:** Implementar filtro por `companyId`

### 🟢 Medidas de Seguridad Implementadas

1. ✅ **Rate limiting** en login (5 intentos / 15 min)
2. ✅ **Rate limiting** en registro (3 registros / hora)
3. ✅ **Rate limiting** en uploads (20 archivos / hora)
4. ✅ **Validación multi-tenant** en operaciones de KPIs
5. ✅ **JWT con expiración** para todas las sesiones
6. ✅ **Sanitización de passwords** en respuestas

---

## 📝 Casos de Uso Comunes

### Caso 1: Usuario de Ventas Actualiza sus Números

**Escenario:** María (rol: `user`, área: Ventas) quiere actualizar sus ventas de la semana

1. ✅ María hace login
2. ✅ Va a Dashboard → KPIs
3. ✅ Click en "Actualizar Ventas Semanales"
4. ✅ Ingresa sus números de la semana actual
5. ✅ El sistema valida que el mes no esté cerrado
6. ✅ Se guarda la actualización
7. ✅ Notificación enviada a su supervisor

**Restricciones:**
- ❌ No puede actualizar ventas de semanas anteriores si el mes está cerrado
- ❌ No puede actualizar ventas de otros usuarios
- ❌ No puede cerrar el mes

---

### Caso 2: Gerente Crea Nuevo Envío

**Escenario:** Omar (rol: `manager`) necesita registrar un nuevo envío

1. ✅ Omar hace login
2. ✅ Va a Logística → Nuevo Envío
3. ✅ Completa el formulario:
   - Cliente (busca de catálogo)
   - Productos (agrega items)
   - Detalles de envío
   - Emails de notificación
4. ✅ El sistema valida `companyId` (multi-tenant)
5. ✅ Se crea el envío con estado "Pendiente"
6. ✅ Email automático al equipo de logística

---

### Caso 3: Usuario Sube Comprobante de Pago

**Escenario:** Thalia (rol: `user`) necesita subir un comprobante XML de SAT

1. ✅ Thalia hace login
2. ✅ Va a Tesorería → Subir Comprobante
3. ✅ Arrastra archivo XML
4. ✅ El sistema:
   - Valida rate limit (max 20/hora)
   - Envía a OpenAI para análisis
   - Extrae RFC, monto, fecha
   - Asocia al proveedor automáticamente
5. ✅ Comprobante visible en Kanban de tesorería

---

### Caso 4: Admin Cierra el Mes

**Escenario:** Daniel (rol: `admin`) necesita cerrar Enero 2025

1. ✅ Daniel hace login
2. ✅ Va a KPIs → Cerrar Mes
3. ✅ El sistema:
   - Valida que todas las ventas estén completas
   - Calcula totales mensuales
   - Marca enero como cerrado
4. ✅ Notificación enviada a todo el equipo
5. ✅ Ahora nadie puede editar ventas de enero (excepto admin con override)

---

## 🎓 Recomendaciones de Uso

### Para Administradores

- ⚠️ Usar `adminOverride` solo cuando sea absolutamente necesario
- 📊 Revisar logs de cambios en periodos cerrados
- 🔒 Rotar credenciales cada 90 días
- 👥 Auditar usuarios periódicamente

### Para Gerentes

- ✅ Mantener catálogos actualizados (clientes, productos)
- ✅ Revisar envíos pendientes diariamente
- ✅ Validar comprobantes antes de marcar como pagado
- ✅ Cerrar mes antes del día 5 del siguiente mes

### Para Usuarios

- ✅ Actualizar ventas semanalmente (no esperar al cierre)
- ✅ Subir comprobantes en el momento que se reciben
- ✅ Mantener emails de contacto actualizados en envíos
- ✅ Reportar envíos retrasados inmediatamente

---

## 📞 Soporte

Si necesitas cambiar el rol de un usuario o tienes dudas sobre permisos:

1. Contactar al administrador del sistema
2. O revisar este documento para verificar permisos

**Última actualización:** 2025-01-06
**Versión del documento:** 1.0
**Auditoría realizada por:** Claude AI Assistant

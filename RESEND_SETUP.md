# 📧 Configuración de Resend para Grupo Orsega

## 🎯 Proceso de Configuración

### 1. **Crear Cuenta en Resend**
- Ir a: https://resend.com
- Registrarse con email de Econova
- Verificar email de confirmación

### 2. **Verificar Dominio de Grupo Orsega**
**Estado Actual:** El dominio `grupoorsega.com` está registrado pero con estado "Not Started" - necesita verificación DNS.

**Pasos para verificar:**
1. En el dashboard de Resend: "Domains" → Click en `grupoorsega.com`
2. Verás una lista de registros DNS que necesitas agregar a tu proveedor de DNS
3. Los registros típicamente incluyen:
   - **Tipo:** TXT (DKIM)
   - **Nombre:** `resend._domainkey` o `@`
   - **Valor:** Una cadena larga proporcionada por Resend
4. Agregar los registros DNS en tu proveedor de dominio (GoDaddy, Namecheap, Cloudflare, etc.)
5. Esperar propagación DNS (puede tardar de minutos a horas)
6. Una vez propagado, Resend mostrará el estado como "Verified"

**⚠️ IMPORTANTE:** 
- Mientras el dominio no esté verificado, los emails NO se enviarán desde `@grupoorsega.com`
- Para pruebas, el sistema usa automáticamente `onboarding@resend.dev` (no requiere verificación)
- Cuando el dominio esté verificado, cambiará automáticamente a usar `@grupoorsega.com`

### 3. **Configurar Emails del Cliente**
Una vez verificado el dominio, configurar:
- `lolita@grupoorsega.com` (Tesorería)
- `thalia@grupoorsega.com` (Logística)  
- `sistema@grupoorsega.com` (Sistema)

### 4. **Obtener API Key**
- En Resend: "API Keys" → "Create API Key"
- Copiar la key generada
- Actualizar `.env`:
  ```env
  RESEND_API_KEY=re_xxxxxxxxxxxxx
  ```

### 5. **Configurar en el Código**
Los emails se enviarán desde:
- **Tesorería:** `Lolita - Tesorería <lolita@grupoorsega.com>`
- **Logística:** `Thalia - Logística <thalia@grupoorsega.com>`

## ✅ Ventajas para Econova

- **Control total** del sistema de emails
- **Una sola API key** para todos los clientes
- **Emails personalizados** con nombres del equipo
- **Más confiable** que SendGrid
- **Fácil mantenimiento** y escalabilidad

## 🔄 Para Otros Clientes

El mismo proceso se repite:
1. Verificar dominio del cliente
2. Configurar emails específicos
3. Usar la misma API key de Econova
4. Cambiar solo los nombres de dominio en el código

## 📋 Checklist de Implementación

- [x] Crear cuenta Resend ✅
- [x] Agregar dominio Grupo Orsega ✅ (grupoorsega.com)
- [ ] **VERIFICAR dominio con registros DNS** ⚠️ **PENDIENTE - Estado: "Not Started"**
- [ ] Configurar emails (Lolita/Thalia) - Se hace después de verificar
- [x] Obtener API key ✅
- [x] Actualizar .env ✅
- [x] Probar envío de emails (usando onboarding@resend.dev) ✅
- [ ] Cambiar a dominio verificado cuando esté listo

## 🔧 Configuración Actual

**Estado del Dominio:** `grupoorsega.com` está registrado pero **NO verificado**
**Solución Temporal:** El sistema usa `onboarding@resend.dev` para pruebas (funciona sin verificación)
**Variable .env:** `USE_RESEND_TEST_EMAIL=true` (opcional, por defecto ya usa test email)

**Para usar el dominio cuando esté verificado:**
1. Verificar dominio en Resend (agregar registros DNS)
2. Una vez verificado, remover `USE_RESEND_TEST_EMAIL=true` del .env (o cambiarlo a `false`)
3. Configurar `CLIENT_DOMAIN=grupoorsega.com` en .env
4. El sistema cambiará automáticamente a usar `dolores@grupoorsega.com` y `thalia@grupoorsega.com`



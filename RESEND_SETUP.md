# 📧 Configuración de Resend para Grupo Orsega

## 🎯 Proceso de Configuración

### 1. **Crear Cuenta en Resend**
- Ir a: https://resend.com
- Registrarse con email de Econova
- Verificar email de confirmación

### 2. **Verificar Dominio de Grupo Orsega**
- En el dashboard de Resend: "Domains" → "Add Domain"
- Ingresar: `grupoorsega.com.mx` (o el dominio real del cliente)
- Configurar registros DNS:
  ```
  Tipo: TXT
  Nombre: @
  Valor: resend._domainkey.grupoorsega.com.mx
  ```

### 3. **Configurar Emails del Cliente**
Una vez verificado el dominio, configurar:
- `lolita@grupoorsega.com.mx` (Tesorería)
- `thalia@grupoorsega.com.mx` (Logística)  
- `sistema@grupoorsega.com.mx` (Sistema)

### 4. **Obtener API Key**
- En Resend: "API Keys" → "Create API Key"
- Copiar la key generada
- Actualizar `.env`:
  ```env
  RESEND_API_KEY=re_xxxxxxxxxxxxx
  ```

### 5. **Configurar en el Código**
Los emails se enviarán desde:
- **Tesorería:** `Lolita - Tesorería <lolita@grupoorsega.com.mx>`
- **Logística:** `Thalia - Logística <thalia@grupoorsega.com.mx>`

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

- [ ] Crear cuenta Resend
- [ ] Verificar dominio Grupo Orsega
- [ ] Configurar emails (Lolita/Thalia)
- [ ] Obtener API key
- [ ] Actualizar .env
- [ ] Probar envío de emails
- [ ] Implementar en producción


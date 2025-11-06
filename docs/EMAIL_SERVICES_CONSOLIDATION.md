# Consolidación de Servicios de Email

## 📧 Situación Actual

El proyecto tiene **múltiples servicios de email** que necesitan consolidarse:

### Servicios Actuales

| Archivo | Biblioteca | Estado | Uso | Descripción |
|---------|-----------|--------|-----|-------------|
| `email-service.ts` | **Resend** | ✅ **Activo/Recomendado** | 4 instancias | Servicio moderno con mejor API |
| `email-logistics.ts` | SendGrid | ✅ Activo | Específico | Emails de logística/transporte |
| `email.ts` | SendGrid | ⚠️ **Deprecated** | 2 instancias | Servicio básico SendGrid |
| `sendgrid.ts` | SendGrid | ⚠️ **Deprecated** | 1 instancia | SendGrid con templates |

## 🎯 Plan de Consolidación

### Fase 1: Marcar como Deprecated ✅ COMPLETADO
- [x] Agregar comentarios `@deprecated` a `email.ts` y `sendgrid.ts`
- [x] Documentar plan de migración

### Fase 2: Migración a Resend (Pendiente)

#### 2.1 Actualizar `email-service.ts`
```typescript
// Agregar soporte para templates
export interface EmailTemplate {
  name: string;
  subject: string;
  html: (data: any) => string;
}

// Agregar templates existentes
const templates = {
  teamMessage: createTeamMessageTemplate,
  shipmentStatus: getShipmentStatusEmailTemplate,
  paymentReceipt: getPaymentReceiptEmailTemplate,
};
```

#### 2.2 Migrar uso en `routes.ts`

**Línea 2180** - Team messages
```typescript
// ANTES:
const emailSent = await sendEmail({...});

// DESPUÉS:
const emailSent = await emailService.sendEmail({...});
```

**Línea 2956** - Similar al anterior
```typescript
// Migrar de sendEmail a emailService.sendEmail
```

**Línea 4478** - Shipment status
```typescript
// ANTES:
await sendGridEmail({...});

// DESPUÉS:
await emailService.sendEmail({...});
```

### Fase 3: Testing (Pendiente)
- [ ] Probar envío de emails en desarrollo
- [ ] Verificar que templates se rendericen correctamente
- [ ] Probar casos de error (API key faltante, etc.)

### Fase 4: Limpieza (Pendiente)
- [ ] Remover `email.ts`
- [ ] Remover `sendgrid.ts`
- [ ] Remover `@sendgrid/mail` de `package.json`
- [ ] Actualizar documentación

## 🔧 Servicios a Mantener

### `email-service.ts` (Resend) - Principal ✅
**Por qué:**
- API más moderna y fácil de usar
- Mejor documentación
- Mayor confiabilidad
- React Email templates support (futuro)

**Continuar usando para:**
- Todos los nuevos emails
- Migración gradual de emails existentes

### `email-logistics.ts` (SendGrid) - Mantener ✅
**Por qué:**
- Específico para logística
- No duplica funcionalidad
- Usa `routes-logistics.ts`

**Acción:** Ninguna (mantener como está)

## ⚠️ Consideraciones

### Configuración de Variables de Entorno
```env
# Resend (principal)
RESEND_API_KEY=re_xxxxx

# SendGrid (legacy/logistics)
SENDGRID_API_KEY=SG.xxxxx  # Solo para email-logistics.ts
```

### Migración de Templates

Los templates actuales en `email.ts` y `sendgrid.ts` necesitan ser portados a funciones que generen HTML compatible con Resend:

```typescript
// email.ts: createTeamMessageTemplate
// sendgrid.ts: getShipmentStatusEmailTemplate
// sendgrid.ts: getPaymentReceiptEmailTemplate
```

## 📊 Beneficios de la Consolidación

- ✅ Menos dependencias (remover `@sendgrid/mail` excepto para logistics)
- ✅ Código más mantenible
- ✅ API consistente
- ✅ Mejor manejo de errores
- ✅ Reducción de complejidad

## 🚀 Próximos Pasos

1. **Inmediato:** Documentación completada ✅
2. **Corto plazo:** Migrar 1-2 usos de email.ts a email-service.ts y probar
3. **Mediano plazo:** Completar migración de todos los emails
4. **Largo plazo:** Considerar React Email para templates más complejos

## 📝 Notas Adicionales

- El servicio `email-logistics.ts` puede permanecer en SendGrid si es necesario
- Considerar usar Resend Templates API en el futuro
- Documentar cualquier limitación encontrada durante la migración

# 📋 HANDOFF PARA CLAUDE CODE

## 🎯 OBJETIVO
Corregir el problema de que los datos no se actualizan en el frontend después de guardar.

## 📂 ARCHIVOS IMPORTANTES

### Documentos de Handoff:
1. **`INSTRUCCIONES-CLAUDE-CODE.md`** ⭐ **EMPEZAR AQUÍ**
   - Instrucciones concisas y específicas
   - Soluciones rápidas si falla
   - Checklist de verificación

2. **`HANDOFF-CLAUDE-CODE-URGENTE.md`**
   - Handoff técnico completo
   - Diagnóstico detallado
   - Todas las tareas pendientes

3. **`AUDITORIA-ACTUALIZACION-DATOS.md`**
   - Auditoría técnica completa
   - Causas raíz identificadas
   - Soluciones implementadas

### Archivos de Código Modificados:
- `client/src/components/kpis/KpiUpdateModal.tsx`
- `client/src/components/kpis/KpiHistoryBulkEditModal.tsx`
- `server/routes.ts`
- `server/DatabaseStorage.ts`

## 🚀 PASOS INMEDIATOS

1. **Leer:** `INSTRUCCIONES-CLAUDE-CODE.md`
2. **Probar:** Actualizar un objetivo anual y verificar si se muestra
3. **Revisar:** Consola del navegador y logs del servidor
4. **Corregir:** Según el diagnóstico en los documentos

## ⏰ TIEMPO RESTANTE
**1 HORA** para presentación

## ✅ ESTADO ACTUAL
- ✅ Backend: Calcula `goal = annualGoal / 12` automáticamente
- ✅ Frontend: Invalidación agresiva de queries implementada
- ⚠️ Problema: Los datos no se muestran inmediatamente después de guardar
- 🔍 Pendiente: Verificar por qué el refetch no actualiza la UI

## 🐛 ERRORES CONOCIDOS
1. El objetivo anual no se muestra después de actualizar
2. El historial no se muestra después del bulk edit
3. Errores de linter en `server/DatabaseStorage.ts` (no críticos)

## 📞 SI NECESITAS AYUDA
- Revisar los logs en la consola del navegador
- Revisar los logs del servidor (`server.log`)
- Verificar que el backend devuelva los datos correctos
- Verificar que el frontend reciba los datos actualizados

---

**ÚLTIMA ACTUALIZACIÓN:** Ahora
**PRIORIDAD:** CRÍTICA


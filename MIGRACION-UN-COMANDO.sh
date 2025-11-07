#!/bin/bash

# ═══════════════════════════════════════════════════
# 🚀 MIGRACIÓN EN UN SOLO COMANDO
# ═══════════════════════════════════════════════════

echo ""
echo "═══════════════════════════════════════════════════"
echo "   🚀 APLICAR MIGRACIÓN RAILWAY (SIMPLIFICADO)"
echo "═══════════════════════════════════════════════════"
echo ""
echo "Este script usa npx (no requiere instalar nada)"
echo ""

# Verificar que npx existe
if ! command -v npx &> /dev/null; then
  echo "❌ Error: npx no está disponible"
  echo "   Instala Node.js desde: https://nodejs.org"
  exit 1
fi

echo "✅ npx disponible"
echo ""

# PASO 1: Login (interactivo - abre browser)
echo "📋 PASO 1/3: Autenticación en Railway"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Se abrirá tu browser para autorizar Railway..."
echo "Presiona ENTER cuando estés listo..."
read -r

npx @railway/cli@latest login

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Error en autenticación"
  exit 1
fi

echo ""
echo "✅ Autenticado correctamente"
echo ""

# PASO 2: Vincular proyecto (interactivo)
echo "📋 PASO 2/3: Vincular proyecto"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Verificar si ya está vinculado
if npx @railway/cli@latest status &> /dev/null; then
  echo "✅ Proyecto ya vinculado"
else
  echo "Selecciona el proyecto 'kpis-grupo-orsega' de la lista..."
  echo ""
  npx @railway/cli@latest link
  
  if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Error al vincular proyecto"
    exit 1
  fi
fi

echo ""

# PASO 3: Aplicar migración
echo "📋 PASO 3/3: Aplicando migración"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npx @railway/cli@latest run bash scripts/apply-migration-railway.sh

if [ $? -eq 0 ]; then
  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "   ✅ ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!"
  echo "═══════════════════════════════════════════════════"
  echo ""
  echo "📋 Próximos pasos:"
  echo ""
  echo "1. ✅ Ir a tu app en Railway"
  echo "2. ✅ Treasury → Upload Payment Voucher"
  echo "3. ✅ Subir un archivo PDF"
  echo "4. ✅ El error 500 debe haber desaparecido"
  echo ""
else
  echo ""
  echo "❌ Error al aplicar migración"
  echo ""
  echo "Intenta manualmente:"
  echo "  npx @railway/cli@latest run psql -f migrations/0001_add_scheduled_payments_columns.sql"
  exit 1
fi

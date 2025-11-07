#!/bin/bash

# ═══════════════════════════════════════════════════
# 🚀 SCRIPT PARA APLICAR MIGRACIÓN EN RAILWAY
# ═══════════════════════════════════════════════════
#
# IMPORTANTE: Ejecuta este script desde TU TERMINAL LOCAL
# (No desde Claude Code)
#
# Uso:
#   bash EJECUTAR-MIGRACION-AHORA.sh
#
# ═══════════════════════════════════════════════════

set -e  # Exit on error

echo ""
echo "═══════════════════════════════════════════════════"
echo "   🚀 APLICAR MIGRACIÓN EN RAILWAY"
echo "═══════════════════════════════════════════════════"
echo ""

# ============================================
# PASO 1: Verificar Railway CLI
# ============================================
echo "📋 PASO 1/5: Verificando Railway CLI..."
echo ""

if ! command -v railway &> /dev/null; then
  echo "⚠️  Railway CLI no está instalado"
  echo ""
  echo "Instalando Railway CLI..."
  npm install -g @railway/cli

  if [ $? -eq 0 ]; then
    echo "✅ Railway CLI instalado"
  else
    echo "❌ Error al instalar Railway CLI"
    echo ""
    echo "Intenta manualmente:"
    echo "  npm install -g @railway/cli"
    exit 1
  fi
else
  echo "✅ Railway CLI ya está instalado: $(railway --version)"
fi

echo ""

# ============================================
# PASO 2: Login en Railway
# ============================================
echo "📋 PASO 2/5: Verificando autenticación..."
echo ""

# Intentar ver si ya está logueado
if railway whoami &> /dev/null; then
  echo "✅ Ya estás autenticado en Railway: $(railway whoami)"
else
  echo "🔐 Necesitas autenticarte en Railway"
  echo ""
  echo "Se abrirá tu browser para autorizar..."
  sleep 2

  railway login

  if [ $? -eq 0 ]; then
    echo "✅ Autenticación exitosa"
  else
    echo "❌ Error en autenticación"
    exit 1
  fi
fi

echo ""

# ============================================
# PASO 3: Vincular proyecto
# ============================================
echo "📋 PASO 3/5: Verificando proyecto vinculado..."
echo ""

if railway status &> /dev/null; then
  echo "✅ Proyecto vinculado:"
  railway status
else
  echo "⚠️  Proyecto no vinculado"
  echo ""
  echo "Vinculando proyecto..."
  railway link

  if [ $? -eq 0 ]; then
    echo "✅ Proyecto vinculado"
  else
    echo "❌ Error al vincular proyecto"
    exit 1
  fi
fi

echo ""

# ============================================
# PASO 4: Aplicar migración
# ============================================
echo "📋 PASO 4/5: Aplicando migración..."
echo ""

echo "🔍 Verificando estado ANTES de la migración:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
railway run psql -c "SELECT COUNT(*) as total_payments FROM scheduled_payments;" 2>&1 || echo "Tabla no accesible o error"
echo ""

echo "🔄 Aplicando migración SQL..."
railway run psql -f migrations/0001_add_scheduled_payments_columns.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migración aplicada exitosamente"
  echo ""
else
  echo ""
  echo "❌ Error al aplicar migración"
  echo ""
  echo "Posibles causas:"
  echo "  1. La migración ya fue aplicada antes"
  echo "  2. Permisos insuficientes"
  echo "  3. Problema de conexión"
  echo ""
  echo "Verificando si columnas ya existen..."
  railway run psql -c "SELECT column_name FROM information_schema.columns WHERE table_name='scheduled_payments' AND column_name='source_type';"

  if [ $? -eq 0 ]; then
    echo ""
    echo "⚠️  La columna source_type YA existe - migración ya aplicada"
    echo "✅ No hay problema, puedes continuar"
  fi
fi

echo ""

# ============================================
# PASO 5: Verificar resultado
# ============================================
echo "📋 PASO 5/5: Verificando resultado..."
echo ""

echo "🔍 Columnas agregadas:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
railway run psql -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'scheduled_payments' AND column_name IN ('supplier_id', 'source_type', 'hydral_file_url', 'hydral_file_name', 'approved_at', 'approved_by', 'payment_scheduled_at', 'voucher_id') ORDER BY column_name;"

echo ""
echo "🔍 Total de registros (debe ser igual que antes):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
railway run psql -c "SELECT COUNT(*) as total_payments_after FROM scheduled_payments;"

echo ""
echo "═══════════════════════════════════════════════════"
echo "   ✅ ¡MIGRACIÓN COMPLETADA!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "📋 Próximos pasos:"
echo ""
echo "1. ✅ Ir a la app en Railway"
echo "2. ✅ Treasury → Upload Payment Voucher"
echo "3. ✅ Subir un archivo PDF"
echo "4. ✅ Verificar que NO muestra error 500"
echo ""
echo "🎉 El error 'column source_type does not exist' debe haber desaparecido"
echo ""

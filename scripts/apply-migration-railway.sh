#!/bin/bash

# ============================================
# Script para aplicar migración en Railway
# ============================================
# Uso: DATABASE_URL="postgresql://..." bash scripts/apply-migration-railway.sh
# O en Railway CLI: railway run bash scripts/apply-migration-railway.sh

set -e  # Exit on error

echo "🚀 Aplicando migración: 0001_add_scheduled_payments_columns.sql"
echo ""

# Verificar que DATABASE_URL está configurado
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL no está configurado"
  echo ""
  echo "Opciones:"
  echo "1. Exportar localmente:"
  echo "   export DATABASE_URL='postgresql://user:pass@host:port/db'"
  echo "   bash scripts/apply-migration-railway.sh"
  echo ""
  echo "2. O usar Railway CLI:"
  echo "   railway run bash scripts/apply-migration-railway.sh"
  echo ""
  exit 1
fi

echo "✅ DATABASE_URL configurado"
echo ""

# Verificar que psql está disponible
if ! command -v psql &> /dev/null; then
  echo "❌ ERROR: psql no está instalado"
  echo ""
  echo "Instalar psql:"
  echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
  echo "  macOS: brew install postgresql"
  echo "  Alpine (Railway): apk add postgresql-client"
  echo ""
  exit 1
fi

echo "✅ psql disponible: $(psql --version)"
echo ""

# Mostrar preview de la migración
echo "📋 Preview de la migración:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
head -30 migrations/0001_add_scheduled_payments_columns.sql
echo "..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Preguntar confirmación (skip si estamos en CI/CD)
if [ -t 0 ]; then  # Si es terminal interactivo
  read -p "¿Aplicar esta migración en Railway? (yes/no): " -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy](es)?$ ]]; then
    echo "⏸️  Migración cancelada"
    exit 0
  fi
fi

# Backup: Contar registros antes
echo "📊 Estado ANTES de la migración:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
psql "$DATABASE_URL" -c "SELECT COUNT(*) as total_payments FROM scheduled_payments;" 2>&1 || echo "Tabla no existe o error"
echo ""

# Aplicar migración
echo "🔄 Aplicando migración..."
psql "$DATABASE_URL" -f migrations/0001_add_scheduled_payments_columns.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migración aplicada exitosamente"
  echo ""

  # Verificar columnas
  echo "📊 Estado DESPUÉS de la migración:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  psql "$DATABASE_URL" -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'scheduled_payments' AND column_name IN ('supplier_id', 'source_type', 'hydral_file_url', 'hydral_file_name', 'approved_at', 'approved_by', 'payment_scheduled_at', 'voucher_id') ORDER BY column_name;"
  echo ""

  # Contar registros después
  psql "$DATABASE_URL" -c "SELECT COUNT(*) as total_payments_after FROM scheduled_payments;"
  echo ""

  echo "✅ Verificación completada"
  echo ""
  echo "🎉 ¡Migración exitosa!"
  echo ""
  echo "📝 Próximos pasos:"
  echo "1. Verificar que la app funciona correctamente"
  echo "2. Probar subir un payment voucher"
  echo "3. El error 'column source_type does not exist' debe desaparecer"
else
  echo ""
  echo "❌ Error al aplicar migración"
  echo "Revisa los logs arriba para más detalles"
  exit 1
fi

#!/bin/bash
# Script para aplicar la migración a PRODUCTION
# IMPORTANTE: Este script debe ejecutarse CON LA DATABASE_URL DE PRODUCTION

echo "🚀 Aplicando migración a PRODUCTION..."
echo ""

# Verificar que tenemos la DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL no está configurada"
  echo "   Por favor, configura la variable de entorno con la URL de PRODUCTION"
  exit 1
fi

echo "📊 Database URL: ${DATABASE_URL:0:40}..."
echo ""

# Ejecutar el SQL
echo "📝 Ejecutando SQL de migración..."
psql "$DATABASE_URL" -f scripts/production-migration.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migración completada exitosamente!"
  echo ""
  echo "📋 Próximo paso:"
  echo "   Ve a la pestaña 'Publishing' y haz clic en 'Republish'"
else
  echo ""
  echo "❌ Error al aplicar la migración"
  echo "   Revisa los errores arriba"
  exit 1
fi

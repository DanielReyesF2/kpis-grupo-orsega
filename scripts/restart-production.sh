#!/bin/bash

echo "🔄 Reiniciando servidor con configuración de producción..."

# Matar procesos existentes
echo "🛑 Deteniendo servidor actual..."
pkill -9 -f "tsx.*server/index" 2>/dev/null || true
sleep 2

# Verificar que el puerto esté libre
if lsof -ti:8080 >/dev/null 2>&1; then
    echo "⚠️ Puerto 8080 aún en uso, forzando liberación..."
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    sleep 2
fi

# Verificar configuración de base de datos
echo "🔍 Verificando configuración de base de datos..."
if grep -q "ep-lively-leaf" .env; then
    echo "✅ Configuración de producción detectada"
else
    echo "❌ ERROR: No se detectó configuración de producción en .env"
    echo "   Asegúrate de que DATABASE_URL apunte a ep-lively-leaf-ae3nrrao"
    exit 1
fi

# Iniciar servidor
echo "🚀 Iniciando servidor con configuración de producción..."
cd /Users/danielreyes/Downloads/kpis-grupo-orsega
npm run dev
















